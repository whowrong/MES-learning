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
import fs from "node:fs"
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

function run(cmd, args, timeout = 120000, env) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    timeout,
    maxBuffer: 8 * 1024 * 1024,
    ...(env ? { env } : {}),
  })
  return { code: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "", error: r.error }
}
/**
 * 调 docker。extraEnv 里的变量只进子进程的环境，**不进 argv**。
 * 演练环境的口令（数据库 root/sa 口令、sshd 账号口令）一律走这条路：
 * `docker run -e VAR`（不写 =值）时 docker 会从客户端环境取值，
 * 于是 `ps` 看到的命令行里不会有任何明文口令。
 */
function docker(args, timeout = 120000, extraEnv) {
  const env = extraEnv ? { ...process.env, ...extraEnv } : undefined
  return run("docker", args, timeout, env)
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

/**
 * 销毁一次性环境时用的 docker 参数。
 *
 * 必须带 -v：mysql / postgres / openssh-server 三个镜像都自带 VOLUME 声明
 * （/var/lib/mysql、/var/lib/postgresql/data、/config），docker run 每次都会
 * 生成一个匿名卷；只 `rm -f` 容器的话卷会留在磁盘上——实测一次模式 B 数据库
 * 演练就漏一个约 200MB 的卷，一轮 E2E 能攒下 4.7GB。`-v` 在删容器的同时删掉
 * 它的匿名卷；具名卷不受影响（本项目不使用具名卷）。
 *
 * 这里不用 `docker run --rm`：--rm 会让容器一退出就被守护进程抹掉，
 * 「就绪失败 → 读 docker logs 定位 → 再销毁」的排查链路会因此拿不到日志，
 * TTL 清扫与离页兜底销毁也会和守护进程的自动删除撞车、报 no such container。
 * 用 `rm -fv` 则容器生命周期仍由本模块显式掌控（作业通道、2 小时 TTL 清扫、
 * 离页兜底销毁都走这一个销毁入口），而容器无论还在跑还是已退出，卷都会被一并回收。
 */
export function removeArgs(name) {
  const n = String(name || "")
  // 只允许销毁本模块自己创建的容器，绝不碰现网服务
  if (!n.startsWith(CONTAINER_PREFIX)) return null
  return ["rm", "-fv", n]
}

/** 销毁一次性环境（含其匿名卷）。返回容器此前是否存在。 */
export function removeContainer(name) {
  const args = removeArgs(name)
  if (!args) return false
  const existed = containerExists(name)
  // 容器可能已被守护进程或人工删掉，此时 rm 会报 no such container；
  // 无所谓：卷已经不在了，继续忽略错误即可。
  docker(args, 60000)
  return existed
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
  if (engine !== "mysql" && engine !== "postgres" && engine !== "sqlserver") return 0
  const { exportPracticeSql } = await import("./seed-practice-db.mjs")
  const { ddl, inserts } = exportPracticeSql(engine === "postgres" ? "postgres" : engine === "sqlserver" ? "sqlserver" : "mysql")
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
  if (engine === "postgres") {
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
  // SQL Server
  const mssql = (await import("mssql")).default
  const pool = await mssql.connect({
    server: connection.host,
    port: connection.port,
    user: connection.username,
    password: connection.password,
    database: connection.database,
    options: { trustServerCertificate: true },
    connectionTimeout: 30000,
    requestTimeout: 60000,
  })
  try {
    // 建表 + 灌数据放进同一个事务：要么全成、要么全回滚。
    // 这样「灌库失败后重试」不会撞上「表已存在」或「主键重复」。
    const tx = new mssql.Transaction(pool)
    await tx.begin()
    try {
      for (const stmt of ddl) await tx.request().query(stmt)
      for (const stmt of inserts) await tx.request().query(stmt)
      await tx.commit()
    } catch (e) {
      await tx.rollback().catch(() => {})
      throw e
    }
  } finally {
    await pool.close().catch(() => {})
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
  // 口令只经子进程环境传递，不出现在 docker 命令行里
  let secretEnv = null
  if (engine === "mysql") {
    args = ["run", "-d", "--name", name, "-e", "MYSQL_ROOT_PASSWORD", "-e", "MYSQL_DATABASE=lab",
      "-p", `127.0.0.1:${port}:3306`, "mysql:8.0"]
    secretEnv = { MYSQL_ROOT_PASSWORD: password }
    connection = { type: "mysql", host: "127.0.0.1", port, database: "lab", username: "root", password }
  } else if (engine === "postgres") {
    args = ["run", "-d", "--name", name, "-e", "POSTGRES_PASSWORD", "-e", "POSTGRES_USER=lab",
      "-e", "POSTGRES_DB=lab", "-p", `127.0.0.1:${port}:5432`, "postgres:16-alpine"]
    secretEnv = { POSTGRES_PASSWORD: password }
    connection = { type: "postgres", host: "127.0.0.1", port, database: "lab", username: "lab", password }
  } else {
    // SQL Server 的 sa 口令有复杂度要求：必须含大写、小写、数字、符号
    const mssqlPassword = "Aa1!" + password
    args = ["run", "-d", "--name", name, "-e", "ACCEPT_EULA=Y", "-e", "MSSQL_SA_PASSWORD",
      "-p", `127.0.0.1:${port}:1433`, "mcr.microsoft.com/mssql/server:2022-latest"]
    secretEnv = { MSSQL_SA_PASSWORD: mssqlPassword }
    connection = { type: "sqlserver", host: "127.0.0.1", port, database: "master", username: "sa", password: mssqlPassword }
  }
  const r = docker(args, 300000, secretEnv)
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
  const args = ["run", "-d", "--name", name, "-e", `USER_NAME=${username}`, "-e", "USER_PASSWORD",
    "-e", "TEXT_PASSWORD=yes", "-e", "PASSWORD_ACCESS=true", "-e", "SUDO_ACCESS=true",
    "-p", `127.0.0.1:${port}:2222`, "linuxserver/openssh-server:latest"]
  // 账号口令只经子进程环境传递，不出现在 docker 命令行里
  const r = docker(args, 300000, { USER_PASSWORD: password })
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
  // 容器就绪之后再做两件事（镜像的初始化脚本会在启动阶段重建 sudoers 配置，所以要等它跑完）：
  //   1) 给演练账号免密 sudo：非 root 账号要能建目录、看服务状态；
  //   2) 预建 /data/archive 并交给演练账号：磁盘类题目（inode 打满、备份清理）直接用这个路径。
  const provision = docker(
    ["exec", name, "sh", "-c", [
      "printf 'lab ALL=(ALL) NOPASSWD: ALL\\n' > /etc/sudoers.d/lab && chmod 440 /etc/sudoers.d/lab",
      "grep -q '^lab ALL=(ALL) NOPASSWD: ALL$' /etc/sudoers || printf 'lab ALL=(ALL) NOPASSWD: ALL\\n' >> /etc/sudoers",
      "mkdir -p /data/archive && chown -R lab:users /data 2>/dev/null || chown -R lab /data",
      "id lab",
    ].join("; ")],
    30000,
  )
  const sudoReady = /uid=.*lab/.test(provision.stdout || "")
  return out({
    ok: true,
    env: {
      id, kind: "server", engine: "sshd", status: "ready",
      host: "127.0.0.1", port, container: name,
      createdAt: new Date().toISOString(),
      sudoReady,
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

/**
 * 请求体来源：argv[2] 直接给 JSON，或以 @ 开头时从文件读（作业通道用文件传参，
 * 避免口令出现在进程命令行里）。
 */
export function readRequestJson(arg = process.argv[2] ?? "") {
  if (arg.startsWith("@")) {
    try {
      return fs.readFileSync(arg.slice(1), "utf8")
    } catch {
      return ""
    }
  }
  return arg
}

async function main() {
  let req
  try {
    req = JSON.parse(readRequestJson() || "{}")
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
