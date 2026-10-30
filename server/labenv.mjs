#!/usr/bin/env node
// labenv.mjs — 模式 B：站点自带的一次性 Docker 演练环境
//
// 目标：让用户「零准备」也能做实操营的破坏性题目。站点在部署机上起一个
// 可丢弃的容器（数据库题：MySQL / PostgreSQL / SQL Server；服务器题：sshd），
// 把端口与随机口令只回显给浏览器一次，演练结束或超时后销毁容器、释放端口。
//
// 约束：
//   - 只操作本脚本自己创建的容器（名字前缀 mes-lab-），绝不碰现网服务；
//   - 端口从固定区间里挑「当前能 bind 的」并显式避开现网端口；
//   - 口令随机生成、不落盘、不写日志、不进仓库与文档；环境状态可由容器名还原；
//   - 就绪探测以「容器内服务真的能连」为准，超时即销毁并报错（可重试）。
import { spawnSync } from "node:child_process"
import crypto from "node:crypto"
import net from "node:net"

const CONTAINER_PREFIX = "mes-lab-"
const DB_PORT_RANGE = [14200, 14249]
const SSH_PORT_RANGE = [14300, 14349]
/** 现网与常见服务端口，一律不碰 */
const RESERVED_PORTS = new Set([
  22, 80, 443, 1433, 3306, 5432, 6379, 8080, 8090, 8091, 8099, 27017, 3307,
])
const TTL_MS = 2 * 60 * 60 * 1000
const READY_TIMEOUT_MS = { mysql: 150000, postgres: 90000, sqlserver: 300000, sshd: 120000 }

function out(obj) {
  process.stdout.write(JSON.stringify(obj))
  process.exit(0)
}
function fail(error, native) {
  out({ ok: false, error, native: native ? String(native).slice(0, 400) : undefined })
}

function run(cmd, args, timeout = 120000) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout, maxBuffer: 8 * 1024 * 1024 })
  return { code: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "", error: r.error }
}
function docker(args, timeout = 120000) {
  return run("docker", args, timeout)
}
function randToken(len = 16) {
  return crypto.randomBytes(len).toString("base64url")
}
function envId() {
  return "labenv-" + Date.now().toString(36) + "-" + crypto.randomBytes(3).toString("hex")
}
function containerName(id) {
  return CONTAINER_PREFIX + id
}

/** 端口是否空闲：本进程试着 bind 一下，能 bind 就是空闲 */
export function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once("error", () => resolve(false))
    srv.once("listening", () => srv.close(() => resolve(true)))
    srv.listen(port, "127.0.0.1")
  })
}

export async function pickPort(range, taken = []) {
  for (let i = 0; i < range[1] - range[0] + 1; i++) {
    const port = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1))
    if (RESERVED_PORTS.has(port)) continue
    if (taken.includes(port)) continue
    if (await isPortFree(port)) return port
  }
  return null
}

function containerExists(name) {
  const r = docker(["ps", "-a", "--filter", `name=^/${name}$`, "--format", "{{.Names}}"])
  return r.stdout.trim() === name
}

/** 容器创建时间（毫秒）；取不到按 0 处理 */
function containerCreatedMs(name) {
  const r = docker(["inspect", "-f", "{{.Created}}", name], 20000)
  const t = Date.parse((r.stdout || "").trim())
  return Number.isFinite(t) ? t : 0
}

function removeContainer(name) {
  if (!containerExists(name)) return false
  docker(["rm", "-f", name], 60000)
  return true
}

/** 扫掉超时未销毁的一次性环境 */
function sweepExpired() {
  const r = docker(["ps", "-a", "--filter", `name=${CONTAINER_PREFIX}`, "--format", "{{.Names}}"], 30000)
  const names = (r.stdout || "").split("\n").map((s) => s.trim()).filter(Boolean)
  const now = Date.now()
  const removed = []
  for (const name of names) {
    const created = containerCreatedMs(name)
    if (created && now - created > TTL_MS) {
      removeContainer(name)
      removed.push(name.replace(CONTAINER_PREFIX, ""))
    }
  }
  return removed
}

function waitFor(msec, step = 1500) {
  return new Promise((resolve) => setTimeout(resolve, msec))
}

/** 就绪探测：以容器内服务真的能连为准 */
async function waitReady(name, kind, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    let ok = false
    if (kind === "mysql") {
      const r = docker(["logs", name], 20000)
      ok = /ready for connections/i.test(r.stdout + r.stderr)
    } else if (kind === "postgres") {
      const r = docker(["exec", name, "pg_isready", "-U", "lab", "-d", "lab"], 20000)
      ok = r.code === 0
    } else if (kind === "sqlserver") {
      const r = docker(["logs", name], 20000)
      ok = /SQL Server is now ready/i.test(r.stdout + r.stderr)
    } else if (kind === "sshd") {
      const r = docker(["logs", name], 20000)
      ok = /sshd is listening/i.test(r.stdout + r.stderr)
    }
    if (ok) return true
    await waitFor(1500)
  }
  return false
}

/** 端口真的能连上（从部署机本地探一下） */
function portReachable(port, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const done = (v) => {
      socket.destroy()
      resolve(v)
    }
    socket.setTimeout(timeoutMs)
    socket.once("connect", () => done(true))
    socket.once("timeout", () => done(false))
    socket.once("error", () => done(false))
    socket.connect(port, "127.0.0.1")
  })
}

/**
 * 把内置练习库灌进一次性数据库容器。
 *
 * 数据库实操营的题目都跑在站内练习库的那 8 张表上；模式 B 的容器是空的，
 * 不灌同一份确定性数据的话题目脚本会直接报表不存在，判分口径也对不上。
 */
async function seedDatabase(engine, connection) {
  if (engine !== "mysql" && engine !== "postgres") return 0
  const { exportPracticeSql } = await import("./seed-practice-db.mjs")
  const { ddl, inserts } = exportPracticeSql(engine === "postgres" ? "postgres" : "mysql")
  if (engine === "mysql") {
    const mysql = (await import("mysql2/promise")).default
    const conn = await mysql.createConnection({
      host: connection.host,
      port: connection.port,
      user: connection.username,
      password: connection.password,
      database: connection.database,
      charset: "utf8mb4",
    })
    try {
      for (const stmt of ddl) await conn.query(stmt)
      for (const stmt of inserts) await conn.query(stmt)
    } finally {
      await conn.end().catch(() => {})
    }
    return inserts.length
  }
  const { Client } = await import("pg")
  const client = new Client({
    host: connection.host,
    port: connection.port,
    user: connection.username,
    password: connection.password,
    database: connection.database,
  })
  await client.connect()
  try {
    for (const stmt of ddl) await client.query(stmt)
    for (const stmt of inserts) await client.query(stmt)
  } finally {
    await client.end().catch(() => {})
  }
  return inserts.length
}

async function createDbEnv(dbType) {
  const engine = ["mysql", "postgres", "sqlserver"].includes(dbType) ? dbType : "mysql"
  const port = await pickPort(DB_PORT_RANGE)
  if (!port) return fail("本机 14200-14249 端口段没有空闲端口，无法创建一次性数据库环境")
  const id = envId()
  const name = containerName(id)
  const password = randToken(12)
  let args
  let connection
  if (engine === "mysql") {
    args = ["run", "-d", "--name", name, "-e", `MYSQL_ROOT_PASSWORD=${password}`, "-e", "MYSQL_DATABASE=lab",
      "-p", `127.0.0.1:${port}:3306`, "mysql:8.0"]
    connection = { type: "mysql", host: "127.0.0.1", port, database: "lab", username: "root", password }
  } else if (engine === "postgres") {
    args = ["run", "-d", "--name", name, "-e", `POSTGRES_PASSWORD=${password}`, "-e", "POSTGRES_USER=lab",
      "-e", "POSTGRES_DB=lab", "-p", `127.0.0.1:${port}:5432`, "postgres:16-alpine"]
    connection = { type: "postgres", host: "127.0.0.1", port, database: "lab", username: "lab", password }
  } else {
    args = ["run", "-d", "--name", name, "-e", "ACCEPT_EULA=Y", "-e", `MSSQL_SA_PASSWORD=${password}`,
      "-p", `127.0.0.1:${port}:1433`, "mcr.microsoft.com/mssql/server:2022-latest"]
    connection = { type: "sqlserver", host: "127.0.0.1", port, database: "master", username: "sa", password }
  }
  const r = docker(args, 300000)
  if (r.code !== 0) {
    removeContainer(name)
    return fail("创建一次性数据库容器失败（可重试）", r.stderr || r.stdout)
  }
  const ready = await waitReady(name, engine, READY_TIMEOUT_MS[engine])
  if (!ready) {
    removeContainer(name)
    return fail(`一次性 ${engine} 容器在 ${Math.round(READY_TIMEOUT_MS[engine] / 1000)} 秒内没有就绪，已自动销毁，可重试`)
  }
  const reachable = await portReachable(port)
  if (!reachable) {
    removeContainer(name)
    return fail("容器内服务已就绪，但端口连不上，已自动销毁，可重试")
  }
  // MySQL 容器的初始化脚本会先起一个临时实例（日志里也会出现 ready for connections），
  // 随后重启成正式实例——所以灌数据要带重试，否则会被临时实例断连。
  let seededRows = 0
  let lastErr = null
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      seededRows = await seedDatabase(engine, connection)
      lastErr = null
      break
    } catch (e) {
      lastErr = e
      await waitFor(5000)
    }
  }
  if (lastErr) {
    removeContainer(name)
    return fail("一次性数据库容器灌入练习库数据失败，已自动销毁，可重试", lastErr?.message || lastErr)
  }
  return out({
    ok: true,
    env: {
      id, kind: "db", engine, status: "ready",
      host: "127.0.0.1", port, container: name,
      createdAt: new Date().toISOString(),
      seededRows,
      connection,
    },
  })
}

async function createServerEnv() {
  const port = await pickPort(SSH_PORT_RANGE)
  if (!port) return fail("本机 14300-14349 端口段没有空闲端口，无法创建一次性服务器环境")
  const id = envId()
  const name = containerName(id)
  const password = randToken(12)
  const username = "lab"
  const args = ["run", "-d", "--name", name, "-e", `USER_NAME=${username}`, "-e", `USER_PASSWORD=${password}`,
    "-e", "TEXT_PASSWORD=yes", "-e", "PASSWORD_ACCESS=true", "-e", "SUDO_ACCESS=true",
    "-p", `127.0.0.1:${port}:2222`, "linuxserver/openssh-server:latest"]
  const r = docker(args, 300000)
  if (r.code !== 0) {
    removeContainer(name)
    return fail("创建一次性 sshd 容器失败（可重试）", r.stderr || r.stdout)
  }
  const ready = await waitReady(name, "sshd", READY_TIMEOUT_MS.sshd)
  if (!ready) {
    removeContainer(name)
    return fail("一次性 sshd 容器没有在预期时间内就绪，已自动销毁，可重试")
  }
  const reachable = await portReachable(port)
  if (!reachable) {
    removeContainer(name)
    return fail("sshd 已就绪但端口连不上，已自动销毁，可重试")
  }
  // 演练账号给免密 sudo：站点自己建的一次性容器里，非 root 账号要能建目录、看服务状态。
  // 必须在容器就绪之后再写 —— 镜像的初始化脚本会在启动阶段重建 sudoers 配置。
  docker(["exec", name, "sh", "-c", "printf 'lab ALL=(ALL) NOPASSWD: ALL\\n' > /etc/sudoers.d/lab && chmod 440 /etc/sudoers.d/lab"], 30000)
  return out({
    ok: true,
    env: {
      id, kind: "server", engine: "sshd", status: "ready",
      host: "127.0.0.1", port, container: name,
      createdAt: new Date().toISOString(),
      connection: { host: "127.0.0.1", port, username, password },
    },
  })
}

function statusAll() {
  const r = docker(["ps", "-a", "--filter", `name=${CONTAINER_PREFIX}`, "--format", "{{.Names}}\t{{.State}}\t{{.Status}}"], 30000)
  const envs = (r.stdout || "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [name, state, statusText] = line.split("\t")
    const created = containerCreatedMs(name)
    return {
      id: name.replace(CONTAINER_PREFIX, ""),
      container: name,
      state,
      status: state === "running" ? "ready" : state === "exited" ? "stopped" : state,
      detail: statusText || "",
      createdAt: created ? new Date(created).toISOString() : "",
      expired: created ? Date.now() - created > TTL_MS : false,
    }
  })
  return envs
}

async function main() {
  let req
  try {
    req = JSON.parse(process.argv[2])
  } catch (e) {
    return fail("请求解析失败", e)
  }
  const { action } = req
  try {
    if (action === "create") {
      sweepExpired()
      if (req.kind === "server") return await createServerEnv()
      return await createDbEnv(req.dbType)
    }
    if (action === "destroy") {
      const id = String(req.id || "")
      if (!id) return fail("缺少环境 id")
      const name = containerName(id)
      const existed = containerExists(name)
      removeContainer(name)
      return out({ ok: true, status: "destroyed", existed, id })
    }
    if (action === "status") {
      const swept = sweepExpired()
      return out({ ok: true, envs: statusAll(), swept })
    }
    return fail("未知 action: " + action)
  } catch (e) {
    return fail(e?.message || String(e), e?.stack)
  }
}

const invokedDirectly = process.argv[1] && /labenv\.mjs$/.test(process.argv[1])
if (invokedDirectly) main()
