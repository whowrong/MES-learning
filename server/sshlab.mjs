#!/usr/bin/env node
// sshlab.mjs — 真实服务器 SSH 代理执行器（由 pb_hooks 经 $os.cmd 调用）
// 输入: argv[2] = JSON 字符串  输出: stdout 单行 JSON，永远 exit 0（错误也在 JSON 里）
// action: list / save / delete / test / exec / upload
// 凭据文件: LAB_DATA/server-connections.json —— 明文只落此文件（仓库外，chmod 600）
import fs from "node:fs"
import path from "node:path"
import { Client } from "ssh2"
import { asciiSafeJson } from "./asciiJson.mjs"

const LAB_DATA = process.env.MES_LAB_DATA || "/workspace/pocketbase-bin/lab-data"
const CONN_FILE = path.join(LAB_DATA, "server-connections.json")
const CONNECT_TIMEOUT = 15000
const EXEC_TIMEOUT = 60000

function out(obj) {
  process.stdout.write(asciiSafeJson(obj))
  process.exit(0)
}
function fail(error, native) {
  out({ ok: false, error, native: native ? String(native).slice(0, 2000) : undefined })
}

function loadConns() {
  try {
    return JSON.parse(fs.readFileSync(CONN_FILE, "utf8"))
  } catch {
    return {}
  }
}
function saveConns(map) {
  fs.mkdirSync(LAB_DATA, { recursive: true })
  fs.writeFileSync(CONN_FILE, JSON.stringify(map, null, 2), { mode: 0o600 })
}
function maskConn(c) {
  return {
    id: c.id,
    label: c.label,
    host: c.host,
    port: c.port,
    username: c.username,
    authType: c.privateKey ? "key" : "password",
    hasSecret: Boolean(c.password || c.privateKey),
    createdAt: c.createdAt,
  }
}

function translateSshError(msg) {
  const m = String(msg)
  if (/ECONNREFUSED/i.test(m)) return "连接被拒绝：检查主机、端口（默认22），以及服务器 sshd 是否运行、防火墙是否放行"
  if (/ETIMEDOUT|timed? ?out/i.test(m)) return "连接超时：网络不通，或云安全组/防火墙未放行 SSH 端口"
  if (/ENOTFOUND|getaddrinfo/i.test(m)) return "主机名解析失败：检查主机地址拼写"
  if (/All configured authentication methods failed|authentication/i.test(m)) return "认证失败：用户名、密码或私钥不正确"
  if (/EHOSTUNREACH|Network is unreachable/i.test(m)) return "主机不可达：检查网络路由"
  return m.slice(0, 300)
}

function connect(conn) {
  return new Promise((resolve, reject) => {
    const c = new Client()
    const cfg = {
      host: conn.host,
      port: Number(conn.port || 22),
      username: conn.username,
      readyTimeout: CONNECT_TIMEOUT,
      keepaliveInterval: 10000,
    }
    if (conn.privateKey) cfg.privateKey = conn.privateKey
    else cfg.password = conn.password
    const timer = setTimeout(() => {
      c.end()
      reject(new Error("连接超时"))
    }, CONNECT_TIMEOUT + 3000)
    c.on("ready", () => {
      clearTimeout(timer)
      resolve(c)
    }).on("error", (e) => {
      clearTimeout(timer)
      reject(e)
    }).connect(cfg)
  })
}

function execOn(c, command, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("命令执行超时（" + timeoutMs / 1000 + "s）")), timeoutMs)
    c.exec(command, (err, stream) => {
      if (err) {
        clearTimeout(timer)
        return reject(err)
      }
      let stdout = ""
      let stderr = ""
      stream
        .on("close", (code) => {
          clearTimeout(timer)
          resolve({ stdout: stdout.slice(0, 200000), stderr: stderr.slice(0, 50000), code })
        })
        .on("data", (d) => {
          stdout += d.toString()
        })
        .stderr.on("data", (d) => {
          stderr += d.toString()
        })
    })
  })
}

/**
 * 请求体来源：argv[2] 直接给 JSON，或以 @ 开头时从文件读（作业通道用文件传参，
 * 避免口令出现在进程命令行里）。
 */
function readRequestJson() {
  const arg = process.argv[2] ?? ""
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
    if (action === "list") return out({ ok: true, connections: Object.values(loadConns()).map(maskConn) })

    if (action === "save") {
      const c = req.connection || {}
      if (!c.label || !c.host || !c.username) return fail("缺少服务器名称、主机或用户名")
      const map = loadConns()
      const id = c.id || "srv-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
      const prev = map[id]
      map[id] = {
        id,
        label: String(c.label).slice(0, 60),
        host: String(c.host).slice(0, 200),
        port: Number(c.port) || 22,
        username: String(c.username).slice(0, 100),
        password: c.password !== undefined && c.password !== "" ? String(c.password) : prev?.password ?? "",
        privateKey: c.privateKey !== undefined && c.privateKey !== "" ? String(c.privateKey) : prev?.privateKey ?? "",
        createdAt: prev?.createdAt || new Date().toISOString(),
      }
      if (!map[id].password && !map[id].privateKey) return fail("密码与私钥至少填一项")
      saveConns(map)
      return out({ ok: true, connection: maskConn(map[id]) })
    }

    if (action === "delete") {
      const map = loadConns()
      delete map[req.id]
      saveConns(map)
      return out({ ok: true })
    }

    // test / exec / upload：解析连接
    let conn
    if (req.connectionId) {
      conn = loadConns()[req.connectionId]
      if (!conn) return fail("服务器连接不存在或已删除")
    } else if (req.connection) {
      conn = req.connection
    } else {
      return fail("缺少连接信息")
    }

    const c = await connect(conn)
    try {
      if (action === "test") {
        const r = await execOn(c, "echo ok && hostname && uname -a", 10000)
        return out({ ok: true, message: "连接成功", stdout: r.stdout })
      }
      if (action === "exec") {
        const command = String(req.command || "").trim()
        if (!command) return fail("命令为空")
        const r = await execOn(c, command, Number(req.timeoutMs) || EXEC_TIMEOUT)
        return out({ ok: true, ...r })
      }
      if (action === "upload") {
        const remotePath = String(req.remotePath || "").trim()
        const content = String(req.content ?? "")
        if (!remotePath.startsWith("/") && !remotePath.startsWith("~/")) return fail("远程路径必须是绝对路径（/ 或 ~/ 开头）")
        await new Promise((resolve, reject) => {
          c.sftp((err, sftp) => {
            if (err) return reject(err)
            const ws = sftp.createWriteStream(remotePath)
            ws.on("close", resolve).on("error", reject)
            ws.end(content, "utf8")
          })
        })
        const verify = await execOn(c, `ls -l ${JSON.stringify(remotePath)}`, 10000)
        return out({ ok: true, message: "上传成功", stdout: verify.stdout })
      }
      return fail("未知 action: " + action)
    } finally {
      c.end()
    }
  } catch (e) {
    return fail(translateSshError(e?.message || String(e)), e?.message || e)
  }
}

main()
