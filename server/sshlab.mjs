#!/usr/bin/env node
// 真实服务器连接执行器：SSH、Instabox CLI 与仅人工网页终端。
// 凭据仅写入仓库外 LAB_DATA/server-connections.json (0600)，永不由 list/save 返回。
import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"
import { Client } from "ssh2"
import { asciiSafeJson } from "./asciiJson.mjs"

const LAB_DATA = process.env.MES_LAB_DATA || "/workspace/pocketbase-bin/lab-data"
const CONN_FILE = path.join(LAB_DATA, "server-connections.json")
const CONNECT_TIMEOUT = 15000
const EXEC_TIMEOUT = 60000
const SUPPORTED_PLATFORMS = new Set(["generic", "instabox", "cloady", "bohrium", "uppcoder"])

function out(obj) {
  process.stdout.write(asciiSafeJson(obj))
  process.exit(0)
}
function fail(error, native, code) {
  out({ ok: false, error, native: native ? String(native).slice(0, 2000) : undefined, code })
}
const STORE_VERSION = 2
function readConnStore() {
  try { return JSON.parse(fs.readFileSync(CONN_FILE, "utf8")) } catch { return {} }
}
function writeConnStore(store) {
  fs.mkdirSync(LAB_DATA, { recursive: true })
  fs.writeFileSync(CONN_FILE, JSON.stringify(store, null, 2), { mode: 0o600 })
  try { fs.chmodSync(CONN_FILE, 0o600) } catch {}
}
function hasEntries(value) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0
}
function loadConns(ownerId, migrateLegacy = false) {
  const raw = readConnStore()
  const owner = String(ownerId || "")
  if (!owner) return {}
  if (raw?.version === STORE_VERSION && raw.owners && typeof raw.owners === "object") {
    const store = { version: STORE_VERSION, owners: raw.owners, legacyUnassigned: raw.legacyUnassigned || {} }
    // The PB hook allows this only while exactly one MES app account exists.
    // Unassigned legacy rows are never exposed to an arbitrary first requester.
    if (migrateLegacy && Object.keys(store.owners).length === 0 && hasEntries(store.legacyUnassigned)) {
      store.owners[owner] = store.legacyUnassigned
      store.legacyUnassigned = {}
      writeConnStore(store)
    }
    return store.owners[owner] || {}
  }
  if (!hasEntries(raw)) return {}
  if (migrateLegacy) {
    writeConnStore({ version: STORE_VERSION, owners: { [owner]: raw }, legacyUnassigned: {} })
    return raw
  }
  return {}
}
function saveConns(ownerId, map, migrateLegacy = false) {
  const owner = String(ownerId || "")
  if (!owner) throw new Error("authenticated MES account required")
  const raw = readConnStore()
  let store
  if (raw?.version === STORE_VERSION && raw.owners && typeof raw.owners === "object") {
    store = { version: STORE_VERSION, owners: raw.owners, legacyUnassigned: raw.legacyUnassigned || {} }
  } else if (hasEntries(raw)) {
    store = migrateLegacy
      ? { version: STORE_VERSION, owners: { [owner]: raw }, legacyUnassigned: {} }
      : { version: STORE_VERSION, owners: {}, legacyUnassigned: raw }
  } else {
    store = { version: STORE_VERSION, owners: {}, legacyUnassigned: {} }
  }
  if (migrateLegacy && Object.keys(store.owners).length === 0 && hasEntries(store.legacyUnassigned)) {
    store.owners[owner] = store.legacyUnassigned
    store.legacyUnassigned = {}
  }
  store.owners[owner] = map
  writeConnStore(store)
}
function redactSecret(text, conn) {
  let value = String(text ?? "")
  for (const secret of [conn?.apiKey, conn?.password, conn?.privateKey]) {
    if (typeof secret === "string" && secret.length >= 4) value = value.split(secret).join("[已隐藏]")
  }
  return value
}
function sanitizeResult(result, conn) {
  if (typeof result === "string") return redactSecret(result, conn)
  if (Array.isArray(result)) return result.map((item) => sanitizeResult(item, conn))
  if (result && typeof result === "object") return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, sanitizeResult(value, conn)]))
  return result
}
function normalizeConn(c) {
  // 旧记录没有分类字段时一律视为普通直连 SSH，不丢旧值。
  return { ...c, connType: c.connType || "ssh", platform: c.platform || "generic", transport: c.transport || "direct" }
}
function capabilities(c) {
  if (c.connType === "manual") return { canExec: false, canUpload: false, persistence: "网页终端 · 仅人工" }
  if (c.platform === "instabox") return { canExec: true, canUpload: true, persistence: "持久盘 /data" }
  if (c.platform === "cloady") return { canExec: true, canUpload: true, persistence: "临时层 · 任何重启即失" }
  if (c.platform === "bohrium") return { canExec: true, canUpload: true, persistence: "按容器/挂载卷配置" }
  if (c.platform === "uppcoder") return { canExec: true, canUpload: true, persistence: "按 Stack 工作区配置" }
  return { canExec: true, canUpload: true, persistence: "未声明 · 以平台配置为准" }
}
function maskConn(raw) {
  const c = normalizeConn(raw)
  return {
    id: c.id, label: c.label, host: c.host || "", port: Number(c.port || 0), username: c.username || "",
    authType: c.authType || (c.privateKey ? "key" : c.password ? "password" : "none"),
    hasSecret: Boolean(c.password || c.privateKey || c.apiKey), createdAt: c.createdAt,
    connType: c.connType, platform: c.platform, transport: c.transport,
    machine: c.machine || "", cliPath: c.cliPath || "", panelUrl: c.panelUrl || "",
    jump: c.jump ? { host: c.jump.host || "", port: Number(c.jump.port || 22), username: c.jump.username || "", secretRef: c.jump.secretRef || "" } : undefined,
    ...capabilities(c),
  }
}

const PLATFORM_ERRORS = {
  cloady: (message) => /EHOSTUNREACH|ENETUNREACH|EAFNOSUPPORT|Network is unreachable|Address family not supported/i.test(message)
    ? "Cloady 的 ssh.cloady.io 仅支持 IPv6；当前服务器网络没有可用 IPv6 出口，不能据此判断密码错误。"
    : null,
  instabox: (message) => /paused|sleep|cooldown|cooling|machine.*not.*running|machine.*stopped/i.test(message)
    ? "Instabox 机器可能已暂停或正在冷却，请稍后再试。"
    : null,
}
function translateSshError(msg, platform = "generic") {
  const m = String(msg)
  const specific = PLATFORM_ERRORS[platform]?.(m)
  if (specific) return specific
  if (/ECONNREFUSED/i.test(m)) return "连接被拒绝：检查主机、端口（默认22），以及服务器 sshd 是否运行、防火墙是否放行 SSH"
  if (/ETIMEDOUT|timed? ?out/i.test(m)) return "连接超时：网络不通，或云安全组/防火墙未放行 SSH 端口"
  if (/ENOTFOUND|getaddrinfo/i.test(m)) return "主机名解析失败：检查主机地址拼写"
  if (/All configured authentication methods failed|authentication/i.test(m)) return "认证失败：用户名、密码或私钥不正确"
  if (/EHOSTUNREACH|Network is unreachable/i.test(m)) return "主机不可达：检查网络路由"
  return m.slice(0, 300)
}
function translateCliError(msg, platform) {
  const m = String(msg || "")
  const specific = PLATFORM_ERRORS[platform]?.(m)
  if (specific) return specific
  if (/ENOENT|not found/i.test(m)) return platform === "instabox" ? "Instabox CLI 未安装在本站服务器，暂时不能执行 API-CLI 连接。" : "平台 CLI 未安装在本站服务器。"
  if (/paused|cooldown|cooling|not running/i.test(m)) return "Instabox 机器可能已暂停或正在冷却，请稍后再试。"
  if (/unauthori[sz]ed|invalid.*key|api.?key/i.test(m)) return "API key 无效或权限不足；请检查 key 是否仅含所需的 machines:read+write 权限。"
  return m.slice(0, 300) || "平台命令执行失败"
}

function connectRaw(conn, options = {}) {
  return new Promise((resolve, reject) => {
    const client = new Client()
    const cfg = { host: conn.host, port: Number(conn.port || 22), username: conn.username, readyTimeout: CONNECT_TIMEOUT, keepaliveInterval: 10000, ...options }
    if (conn.privateKey) cfg.privateKey = conn.privateKey
    else if (conn.password) cfg.password = conn.password
    else if (conn.authType === "none" || conn.transport === "tailscale") cfg.agent = process.env.SSH_AUTH_SOCK
    const timer = setTimeout(() => { client.end(); reject(new Error("连接超时")) }, CONNECT_TIMEOUT + 3000)
    client.on("ready", () => { clearTimeout(timer); resolve(client) }).on("error", (e) => { clearTimeout(timer); reject(e) }).connect(cfg)
  })
}
async function connect(conn, map) {
  if (conn.transport === "tailscale") throw new Error("tailscale SSH must use the tailscale CLI adapter")
  if (conn.transport !== "jump") return { client: await connectRaw(conn), close: () => {} }
  const ref = conn.jump?.secretRef
  const jumpConn = ref && map[ref] ? normalizeConn(map[ref]) : null
  if (!jumpConn || jumpConn.connType !== "ssh") throw new Error("跳板机需先登记为 SSH 连接，再选择该连接作为跳板")
  const jump = await connectRaw(jumpConn)
  try {
    const sock = await new Promise((resolve, reject) => jump.forwardOut("127.0.0.1", 0, conn.host, Number(conn.port || 22), (err, stream) => err ? reject(err) : resolve(stream)))
    const client = await connectRaw(conn, { sock })
    return { client, close: () => { client.end(); jump.end() } }
  } catch (e) { jump.end(); throw e }
}
function execOn(client, command, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("命令执行超时（" + timeoutMs / 1000 + "s）")), timeoutMs)
    client.exec(command, (err, stream) => {
      if (err) { clearTimeout(timer); return reject(err) }
      let stdout = "", stderr = ""
      stream.on("close", (code) => { clearTimeout(timer); resolve({ stdout: stdout.slice(0, 200000), stderr: stderr.slice(0, 50000), code }) })
        .on("data", (d) => { stdout += d.toString() })
      stream.stderr.on("data", (d) => { stderr += d.toString() })
    })
  })
}
function runProcess(file, args, { env, timeoutMs = EXEC_TIMEOUT, maxOutput = 200000 } = {}) {
  return new Promise((resolve) => {
    let stdout = "", stderr = "", settled = false
    const child = spawn(file, args, { env, stdio: ["ignore", "pipe", "pipe"] })
    const finish = (value) => { if (!settled) { settled = true; resolve(value) } }
    const timer = setTimeout(() => { child.kill("SIGKILL"); finish({ code: null, stdout, stderr, error: `命令执行超时（${timeoutMs / 1000}s）` }) }, timeoutMs)
    child.stdout.on("data", (d) => { stdout = (stdout + d.toString()).slice(-maxOutput) })
    child.stderr.on("data", (d) => { stderr = (stderr + d.toString()).slice(-50000) })
    child.on("error", (e) => { clearTimeout(timer); finish({ code: null, stdout, stderr, error: e.message }) })
    child.on("close", (code) => { clearTimeout(timer); finish({ code, stdout, stderr }) })
  })
}
function shellQuote(value) { return "'" + String(value).replace(/'/g, "'\''") + "'" }
function remoteShellPath(value) {
  const target = String(value)
  if (!target.startsWith("~/")) return shellQuote(target)
  const suffix = target.slice(2).replace(/["\\`$]/g, (char) => "\\" + char)
  return `"$HOME/${suffix}"`
}
function requestJson() {
  const arg = process.argv[2] ?? ""
  if (arg.startsWith("@")) { try { return fs.readFileSync(arg.slice(1), "utf8") } catch { return "" } }
  return arg
}
function validateNewConnection(c, prev) {
  const connType = c.connType || "ssh", platform = c.platform || "generic"
  if (!SUPPORTED_PLATFORMS.has(platform)) return "不支持的平台预设"
  if (!["ssh", "api-cli", "manual"].includes(connType)) return "不支持的连接方式"
  if (!c.label) return "请填写服务器名称"
  if (connType === "manual") {
    try { if (!/^https?:$/.test(new URL(c.panelUrl).protocol)) return "网页终端地址必须使用 HTTP 或 HTTPS" }
    catch { return "请填写有效的平台面板地址" }
    return null
  }
  const transport = c.transport || "direct"
  if (!["direct", "jump", "tailscale"].includes(transport)) return "不支持的 SSH 传输方式"
  if (transport === "tailscale" && platform !== "bohrium") return "Tailscale SSH 仅支持 Bohrium 预设"
  if (transport === "jump" && platform !== "generic") return "跳板机传输请使用通用 SSH 预设"
  if (connType === "api-cli") {
    if (platform !== "instabox") return "本期仅支持 Instabox 的 API-CLI 连接"
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(String(c.machine || ""))) return "请填写有效的 Instabox 机器名或 ID"
    if (!c.apiKey && !prev?.apiKey) return "请填写 Instabox API key"
    return null
  }
  if (platform === "instabox") return "Instabox 请使用 API-CLI 预设"
  if (platform === "bohrium" && transport === "tailscale") return c.host ? null : "请填写 tailnet 设备名"
  if (!c.host || !c.username) return "缺少服务器名称、主机或用户名"
  if (c.transport === "jump" && !c.jump?.secretRef) return "请选择已登记的 SSH 跳板连接"
  const authType = c.authType || (c.privateKey ? "key" : "password")
  if (!["password", "key", "none"].includes(authType)) return "不支持的认证方式"
  if (authType === "none" && !(platform === "bohrium" && transport === "tailscale")) return "仅 Bohrium Tailscale SSH 支持免密认证"
  if (platform === "uppcoder" && authType !== "key") return "Uppcoder 只支持 SSH 私钥认证"
  if (authType === "key" && !c.privateKey && !prev?.privateKey) return "请填写私钥"
  if (authType === "password" && !c.password && !prev?.password) return "请填写密码"
  return null
}
function manualOnly(c) {
  return { ok: false, error: "MANUAL_ONLY：此连接仅支持人工操作，请打开平台网页终端。", code: "MANUAL_ONLY", panelUrl: c.panelUrl || "" }
}
async function instaboxExec(conn, command, timeoutMs) {
  if (!conn.apiKey) return { ok: false, error: "Instabox API key 尚未登记。" }
  const file = conn.cliPath || "instabox"
  const env = { PATH: process.env.PATH || "", HOME: process.env.HOME || "", TMPDIR: process.env.TMPDIR || "", INSTABOX_API_KEY: conn.apiKey }
  const r = await runProcess(file, ["exec", conn.machine, "--", "bash", "-lc", command], { env, timeoutMs })
  if (r.error || r.code !== 0) return { ok: false, error: translateCliError(r.error || r.stderr || `CLI exit ${r.code}`, "instabox"), native: r.stderr || r.error, code: r.code }
  return { ok: true, stdout: r.stdout, stderr: r.stderr, code: r.code }
}
async function tailscaleExec(conn, command, timeoutMs) {
  const file = process.env.TAILSCALE_BIN || "tailscale"
  const env = { PATH: process.env.PATH || "", HOME: process.env.HOME || "", TMPDIR: process.env.TMPDIR || "" }
  const r = await runProcess(file, ["ssh", `${conn.username || "root"}@${conn.host}`, command], { env, timeoutMs: Math.min(timeoutMs, 25000) })
  if (r.error || r.code !== 0) return { ok: false, error: translateSshError(r.error || r.stderr || `SSH exit ${r.code}`, "bohrium"), native: r.stderr || r.error, code: r.code }
  return { ok: true, stdout: r.stdout, stderr: r.stderr, code: r.code }
}
async function execute(conn, map, command, timeoutMs) {
  if (conn.connType === "manual") return manualOnly(conn)
  if (conn.connType === "api-cli") return instaboxExec(conn, command, timeoutMs)
  if (conn.transport === "tailscale") return tailscaleExec(conn, command, timeoutMs)
  const session = await connect(conn, map)
  try { return { ok: true, ...(await execOn(session.client, command, timeoutMs)) } }
  finally { session.close() }
}

async function main() {
  let req
  try { req = JSON.parse(requestJson() || "{}") } catch (e) { return fail("请求解析失败", e) }
  const { action } = req
  const ownerId = String(req.ownerId || "")
  const migrateLegacy = req.migrateLegacy === true
  let conn
  try {
    if (!ownerId) return fail("MES account scope is required")
    if (action === "list") return out({ ok: true, connections: Object.values(loadConns(ownerId, migrateLegacy)).map(maskConn) })
    if (action === "save") {
      const c = req.connection || {}, map = loadConns(ownerId, migrateLegacy), id = c.id || "srv-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), prev = map[id]
      const validation = validateNewConnection(c, prev)
      if (validation) return fail(validation)
      const connType = c.connType || "ssh", platform = c.platform || "generic"
      const authType = c.authType || (c.privateKey ? "key" : "password")
      const keepOr = (value, prior) => value !== undefined && value !== "" ? String(value) : prior || ""
      map[id] = {
        id, label: String(c.label).slice(0, 60), connType, platform,
        transport: connType === "ssh" ? (c.transport || "direct") : "direct",
        host: String(c.host || "").slice(0, 255), port: Number(c.port) || (platform === "uppcoder" ? 2222 : 22),
        username: String(c.username || (platform === "bohrium" ? "root" : "")).slice(0, 100),
        authType,
        password: authType === "password" ? keepOr(c.password, prev?.password) : "",
        privateKey: authType === "key" ? keepOr(c.privateKey, prev?.privateKey) : "",
        apiKey: connType === "api-cli" ? keepOr(c.apiKey, prev?.apiKey) : "",
        machine: String(c.machine || "").slice(0, 100), cliPath: String(c.cliPath || "").slice(0, 255),
        panelUrl: String(c.panelUrl || "").slice(0, 1000),
        jump: c.transport === "jump" ? { host: String(c.jump?.host || "").slice(0, 255), port: Number(c.jump?.port || 22), username: String(c.jump?.username || "").slice(0, 100), secretRef: String(c.jump?.secretRef || "").slice(0, 100) } : undefined,
        createdAt: prev?.createdAt || new Date().toISOString(),
      }
      if (authType === "password" && connType === "ssh" && !map[id].password) return fail("请填写密码")
      if (authType === "key" && connType === "ssh" && !map[id].privateKey) return fail("请填写私钥")
      saveConns(ownerId, map, migrateLegacy)
      return out({ ok: true, connection: maskConn(map[id]) })
    }
    if (action === "delete") {
      const map = loadConns(ownerId, migrateLegacy); delete map[req.id]; saveConns(ownerId, map, migrateLegacy); return out({ ok: true })
    }

    const map = loadConns(ownerId, migrateLegacy)
    if (req.connectionId) {
      const saved = map[req.connectionId]
      if (saved && req.connection) {
        const inline = req.connection
        const merged = { ...saved, ...inline }
        if (inline.authType === "key") { merged.privateKey = inline.privateKey || saved.privateKey; merged.password = "" }
        else if (inline.authType === "password") { merged.password = inline.password || saved.password; merged.privateKey = "" }
        else { merged.password = ""; merged.privateKey = "" }
        merged.apiKey = inline.apiKey || saved.apiKey
        conn = merged
      } else conn = saved
    } else if (req.connection) conn = req.connection
    else return fail("缺少连接信息")
    if (!conn) return fail("服务器连接不存在或已删除")
    conn = normalizeConn(conn)
    if (conn.connType === "manual") return out(manualOnly(conn))
    if (action === "test") {
      const result = await execute(conn, map, conn.connType === "api-cli" ? "echo ok && hostname" : "echo ok && hostname && uname -a", 12000)
      if (!result.ok) return out(sanitizeResult(result, conn))
      if (result.code !== undefined && result.code !== 0) return out(sanitizeResult({ ok: false, error: result.stderr || "连接测试失败", code: result.code }, conn))
      return out(sanitizeResult({ ok: true, message: "连接成功", stdout: result.stdout }, conn))
    }
    if (action === "exec") {
      const command = String(req.command || "").trim()
      if (!command) return fail("命令为空")
      const result = await execute(conn, map, command, Number(req.timeoutMs) || EXEC_TIMEOUT)
      return out(sanitizeResult(result, conn))
    }
    if (action === "upload") {
      const remotePath = String(req.remotePath || "").trim(), content = String(req.content ?? "")
      if (!remotePath.startsWith("/") && !remotePath.startsWith("~/")) return fail("远程路径必须是绝对路径（/ 或 ~/ 开头）")
      if (conn.connType === "manual") return out(manualOnly(conn))
      if (conn.platform === "instabox" || conn.transport === "tailscale") {
        const encoded = Buffer.from(content, "utf8").toString("base64")
        const command = `mkdir -p ${remoteShellPath(path.posix.dirname(remotePath))} && printf %s ${shellQuote(encoded)} | base64 -d > ${remoteShellPath(remotePath)} && ls -l ${remoteShellPath(remotePath)}`
        const result = await execute(conn, map, command, EXEC_TIMEOUT)
        return out(sanitizeResult(result.ok ? { ...result, message: "上传成功" } : result, conn))
      }
      const session = await connect(conn, map)
      try {
        await new Promise((resolve, reject) => session.client.sftp((err, sftp) => {
          if (err) return reject(err)
          const sftpPath = remotePath.startsWith("~/") ? remotePath.slice(2) : remotePath
          const ws = sftp.createWriteStream(sftpPath)
          ws.on("close", resolve).on("error", reject); ws.end(content, "utf8")
        }))
        const verify = await execOn(session.client, `ls -l ${remoteShellPath(remotePath)}`, 10000)
        return out(sanitizeResult({ ok: true, message: "上传成功", stdout: verify.stdout }, conn))
      } finally { session.close() }
    }
    return fail("未知 action: " + action)
  } catch (e) {
    const msg = String(e?.message || e)
    const platform = conn?.platform || req.connection?.platform || "generic"
    return fail(redactSecret(translateSshError(msg, platform), conn), redactSecret(msg, conn))
  }
}
main()
