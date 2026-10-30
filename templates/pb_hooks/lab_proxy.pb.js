/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/lab_proxy.pb.js — 独立部署 lab 执行器代理路由
//
// 背景: 「数据库实操营」(/api/dblab/*) 与「真实服务器模式」(/api/sshlab/*)
// 在 VibeX 平台部署时由平台注入一组薄路由, 把请求转成 action JSON 后经
// $os.cmd 调用仓库 server/ 下的 Node 执行器:
//   server/dblab.mjs   数据库执行器(内置 SQLite 练习库 / mysql2 / pg / mssql)
//   server/sshlab.mjs  SSH 执行器(ssh2: exec / SFTP upload)
// 执行器契约: argv[2] = 请求 JSON, stdout = 单行 JSON(错误也在 JSON 里, 恒 exit 0),
// 输出经 asciiJson 转义为纯 ASCII —— 因为 $os.cmd().output() 返回字节数组,
// Goja 侧只能逐字节 String.fromCharCode 转回字符串(Latin-1 等价解码)。
// 本文件按同一契约补齐这组路由; webhook 路由由本 hook 直接 $http.send 转发。
//
// 环境变量:
//   MES_SERVER_DIR  server/ 目录的绝对路径(默认 /workspace/pocketbase-bin/server)
//   MES_LAB_NODE    node 二进制(默认 node; 需 Node >= 22.5, 执行器用 node:sqlite)
// 注意: 执行器把凭据与练习库写在 LAB_DATA(见 server/*.mjs 内常量,
// 默认 /workspace/pocketbase-bin/lab-data), 部署时须保证该目录可写。
// 执行器解析 mysql2/pg/mssql/ssh2 依赖: server/ 须位于应用根目录内
// (Node 模块解析会向上找到应用的 node_modules, 先 pnpm install)。
//
// ⚠️ PB hooks 约定: 每个 routerAdd 处理器是独立作用域, 看不到顶层函数,
// 所以 runLab 在每个处理器内各自内联一份, 不要抽到文件顶层。

// ---------------------------------------------------------------------------
// dblab
// ---------------------------------------------------------------------------

// Require a normal MES app account for custom routes. Superusers are intentionally
// excluded from the browser API; collection admin remains local to PocketBase.
function decodeUtf8Bytes(bytes) {
  var out = ""
  var i = 0
  var len = bytes.length
  while (i < len) {
    var b = bytes[i++] & 0xff
    if (b < 0x80) { out += String.fromCharCode(b); continue }
    if (b >= 0xc0 && b < 0xe0 && i < len) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f)); continue
    }
    if (b >= 0xe0 && b < 0xf0 && i + 1 < len) {
      var b1 = bytes[i++] & 0x3f, b2 = bytes[i++] & 0x3f
      out += String.fromCharCode(((b & 0x0f) << 12) | (b1 << 6) | b2); continue
    }
    if (b >= 0xf0 && i + 2 < len) {
      var c1 = bytes[i++] & 0x3f, c2 = bytes[i++] & 0x3f, c3 = bytes[i++] & 0x3f
      var cp = ((b & 0x07) << 18) | (c1 << 12) | (c2 << 6) | c3
      cp -= 0x10000
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff)); continue
    }
    out += "\ufffd"
  }
  return out
}

function requireMesUser(e) {
  if (!e.auth) throw new UnauthorizedError("Authentication required")
  if (e.auth.isSuperuser() || e.auth.collection().name !== "mes_users") {
    throw new ForbiddenError("MES app account required")
  }
  return e.next()
}


routerAdd("GET", "/api/dblab/connections", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var command = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload))
    // PocketBase creates each route handler in an isolated JSVM scope; keep this
    // whitelist local to runLab. Never inherit app-login or InstaBox secrets.
    var childEnv = ["PATH=" + ($os.getenv("PATH") || "")]
    var childHome = $os.getenv("HOME") || ""
    var childTmp = $os.getenv("TMPDIR") || ""
    if (childHome) childEnv.push("HOME=" + childHome)
    if (childTmp) childEnv.push("TMPDIR=" + childTmp)
    command.env = childEnv
    var out = command.output()
    // 子进程 stdout 是 UTF-8 字节流：必须按 UTF-8 解码，不能按 latin1 拼字符串，
    // 否则库里/终端里的中文会以「æˆ¥å®Œ」这类乱码返回给浏览器。
    var text = decodeUtf8Bytes(out)
    return JSON.parse(text)
  }
  try {
    return e.json(200, runLab("dblab.mjs", { action: "list" }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
}, requireMesUser)

routerAdd("POST", "/api/dblab/connections", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var command = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload))
    // PocketBase creates each route handler in an isolated JSVM scope; keep this
    // whitelist local to runLab. Never inherit app-login or InstaBox secrets.
    var childEnv = ["PATH=" + ($os.getenv("PATH") || "")]
    var childHome = $os.getenv("HOME") || ""
    var childTmp = $os.getenv("TMPDIR") || ""
    if (childHome) childEnv.push("HOME=" + childHome)
    if (childTmp) childEnv.push("TMPDIR=" + childTmp)
    command.env = childEnv
    var out = command.output()
    // 子进程 stdout 是 UTF-8 字节流：必须按 UTF-8 解码，不能按 latin1 拼字符串，
    // 否则库里/终端里的中文会以「æˆ¥å®Œ」这类乱码返回给浏览器。
    var text = decodeUtf8Bytes(out)
    return JSON.parse(text)
  }
  try {
    var body = e.requestInfo().body || {}
    return e.json(200, runLab("dblab.mjs", { action: "save", connection: body.connection || {} }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
}, requireMesUser)

routerAdd("POST", "/api/dblab/connections/delete", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var command = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload))
    // PocketBase creates each route handler in an isolated JSVM scope; keep this
    // whitelist local to runLab. Never inherit app-login or InstaBox secrets.
    var childEnv = ["PATH=" + ($os.getenv("PATH") || "")]
    var childHome = $os.getenv("HOME") || ""
    var childTmp = $os.getenv("TMPDIR") || ""
    if (childHome) childEnv.push("HOME=" + childHome)
    if (childTmp) childEnv.push("TMPDIR=" + childTmp)
    command.env = childEnv
    var out = command.output()
    // 子进程 stdout 是 UTF-8 字节流：必须按 UTF-8 解码，不能按 latin1 拼字符串，
    // 否则库里/终端里的中文会以「æˆ¥å®Œ」这类乱码返回给浏览器。
    var text = decodeUtf8Bytes(out)
    return JSON.parse(text)
  }
  try {
    var body = e.requestInfo().body || {}
    return e.json(200, runLab("dblab.mjs", { action: "delete", id: body.id }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
}, requireMesUser)

routerAdd("POST", "/api/dblab/test", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var command = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload))
    // PocketBase creates each route handler in an isolated JSVM scope; keep this
    // whitelist local to runLab. Never inherit app-login or InstaBox secrets.
    var childEnv = ["PATH=" + ($os.getenv("PATH") || "")]
    var childHome = $os.getenv("HOME") || ""
    var childTmp = $os.getenv("TMPDIR") || ""
    if (childHome) childEnv.push("HOME=" + childHome)
    if (childTmp) childEnv.push("TMPDIR=" + childTmp)
    command.env = childEnv
    var out = command.output()
    // 子进程 stdout 是 UTF-8 字节流：必须按 UTF-8 解码，不能按 latin1 拼字符串，
    // 否则库里/终端里的中文会以「æˆ¥å®Œ」这类乱码返回给浏览器。
    var text = decodeUtf8Bytes(out)
    return JSON.parse(text)
  }
  try {
    var body = e.requestInfo().body || {}
    return e.json(200, runLab("dblab.mjs", { action: "test", connectionId: body.connectionId, connection: body.connection }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
}, requireMesUser)

routerAdd("POST", "/api/dblab/exec", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var command = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload))
    // PocketBase creates each route handler in an isolated JSVM scope; keep this
    // whitelist local to runLab. Never inherit app-login or InstaBox secrets.
    var childEnv = ["PATH=" + ($os.getenv("PATH") || "")]
    var childHome = $os.getenv("HOME") || ""
    var childTmp = $os.getenv("TMPDIR") || ""
    if (childHome) childEnv.push("HOME=" + childHome)
    if (childTmp) childEnv.push("TMPDIR=" + childTmp)
    command.env = childEnv
    var out = command.output()
    // 子进程 stdout 是 UTF-8 字节流：必须按 UTF-8 解码，不能按 latin1 拼字符串，
    // 否则库里/终端里的中文会以「æˆ¥å®Œ」这类乱码返回给浏览器。
    var text = decodeUtf8Bytes(out)
    return JSON.parse(text)
  }
  try {
    var body = e.requestInfo().body || {}
    return e.json(200, runLab("dblab.mjs", { action: "exec", connectionId: body.connectionId, sql: body.sql }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
}, requireMesUser)

routerAdd("POST", "/api/dblab/reset-builtin", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var command = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload))
    // PocketBase creates each route handler in an isolated JSVM scope; keep this
    // whitelist local to runLab. Never inherit app-login or InstaBox secrets.
    var childEnv = ["PATH=" + ($os.getenv("PATH") || "")]
    var childHome = $os.getenv("HOME") || ""
    var childTmp = $os.getenv("TMPDIR") || ""
    if (childHome) childEnv.push("HOME=" + childHome)
    if (childTmp) childEnv.push("TMPDIR=" + childTmp)
    command.env = childEnv
    var out = command.output()
    // 子进程 stdout 是 UTF-8 字节流：必须按 UTF-8 解码，不能按 latin1 拼字符串，
    // 否则库里/终端里的中文会以「æˆ¥å®Œ」这类乱码返回给浏览器。
    var text = decodeUtf8Bytes(out)
    return JSON.parse(text)
  }
  try {
    return e.json(200, runLab("dblab.mjs", { action: "reset-builtin" }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
}, requireMesUser)

// ---------------------------------------------------------------------------
// sshlab
// ---------------------------------------------------------------------------

routerAdd("GET", "/api/sshlab/connections", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var command = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload))
    // PocketBase creates each route handler in an isolated JSVM scope; keep this
    // whitelist local to runLab. Never inherit app-login or InstaBox secrets.
    var childEnv = ["PATH=" + ($os.getenv("PATH") || "")]
    var childHome = $os.getenv("HOME") || ""
    var childTmp = $os.getenv("TMPDIR") || ""
    if (childHome) childEnv.push("HOME=" + childHome)
    if (childTmp) childEnv.push("TMPDIR=" + childTmp)
    command.env = childEnv
    var out = command.output()
    // 子进程 stdout 是 UTF-8 字节流：必须按 UTF-8 解码，不能按 latin1 拼字符串，
    // 否则库里/终端里的中文会以「æˆ¥å®Œ」这类乱码返回给浏览器。
    var text = decodeUtf8Bytes(out)
    return JSON.parse(text)
  }
  try {
    return e.json(200, runLab("sshlab.mjs", { action: "list" }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
}, requireMesUser)

routerAdd("POST", "/api/sshlab/connections", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var command = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload))
    // PocketBase creates each route handler in an isolated JSVM scope; keep this
    // whitelist local to runLab. Never inherit app-login or InstaBox secrets.
    var childEnv = ["PATH=" + ($os.getenv("PATH") || "")]
    var childHome = $os.getenv("HOME") || ""
    var childTmp = $os.getenv("TMPDIR") || ""
    if (childHome) childEnv.push("HOME=" + childHome)
    if (childTmp) childEnv.push("TMPDIR=" + childTmp)
    command.env = childEnv
    var out = command.output()
    // 子进程 stdout 是 UTF-8 字节流：必须按 UTF-8 解码，不能按 latin1 拼字符串，
    // 否则库里/终端里的中文会以「æˆ¥å®Œ」这类乱码返回给浏览器。
    var text = decodeUtf8Bytes(out)
    return JSON.parse(text)
  }
  try {
    var body = e.requestInfo().body || {}
    return e.json(200, runLab("sshlab.mjs", { action: "save", connection: body.connection || {} }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
}, requireMesUser)

routerAdd("POST", "/api/sshlab/connections/delete", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var command = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload))
    // PocketBase creates each route handler in an isolated JSVM scope; keep this
    // whitelist local to runLab. Never inherit app-login or InstaBox secrets.
    var childEnv = ["PATH=" + ($os.getenv("PATH") || "")]
    var childHome = $os.getenv("HOME") || ""
    var childTmp = $os.getenv("TMPDIR") || ""
    if (childHome) childEnv.push("HOME=" + childHome)
    if (childTmp) childEnv.push("TMPDIR=" + childTmp)
    command.env = childEnv
    var out = command.output()
    // 子进程 stdout 是 UTF-8 字节流：必须按 UTF-8 解码，不能按 latin1 拼字符串，
    // 否则库里/终端里的中文会以「æˆ¥å®Œ」这类乱码返回给浏览器。
    var text = decodeUtf8Bytes(out)
    return JSON.parse(text)
  }
  try {
    var body = e.requestInfo().body || {}
    return e.json(200, runLab("sshlab.mjs", { action: "delete", id: body.id }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
}, requireMesUser)

routerAdd("POST", "/api/sshlab/test", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var command = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload))
    // PocketBase creates each route handler in an isolated JSVM scope; keep this
    // whitelist local to runLab. Never inherit app-login or InstaBox secrets.
    var childEnv = ["PATH=" + ($os.getenv("PATH") || "")]
    var childHome = $os.getenv("HOME") || ""
    var childTmp = $os.getenv("TMPDIR") || ""
    if (childHome) childEnv.push("HOME=" + childHome)
    if (childTmp) childEnv.push("TMPDIR=" + childTmp)
    command.env = childEnv
    var out = command.output()
    // 子进程 stdout 是 UTF-8 字节流：必须按 UTF-8 解码，不能按 latin1 拼字符串，
    // 否则库里/终端里的中文会以「æˆ¥å®Œ」这类乱码返回给浏览器。
    var text = decodeUtf8Bytes(out)
    return JSON.parse(text)
  }
  try {
    var body = e.requestInfo().body || {}
    return e.json(200, runLab("sshlab.mjs", { action: "test", connectionId: body.connectionId, connection: body.connection }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
}, requireMesUser)

routerAdd("POST", "/api/sshlab/exec", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var command = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload))
    // PocketBase creates each route handler in an isolated JSVM scope; keep this
    // whitelist local to runLab. Never inherit app-login or InstaBox secrets.
    var childEnv = ["PATH=" + ($os.getenv("PATH") || "")]
    var childHome = $os.getenv("HOME") || ""
    var childTmp = $os.getenv("TMPDIR") || ""
    if (childHome) childEnv.push("HOME=" + childHome)
    if (childTmp) childEnv.push("TMPDIR=" + childTmp)
    command.env = childEnv
    var out = command.output()
    // 子进程 stdout 是 UTF-8 字节流：必须按 UTF-8 解码，不能按 latin1 拼字符串，
    // 否则库里/终端里的中文会以「æˆ¥å®Œ」这类乱码返回给浏览器。
    var text = decodeUtf8Bytes(out)
    return JSON.parse(text)
  }
  try {
    var body = e.requestInfo().body || {}
    return e.json(200, runLab("sshlab.mjs", {
      action: "exec", connectionId: body.connectionId, connection: body.connection,
      command: body.command, timeoutMs: body.timeoutMs,
    }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
}, requireMesUser)

routerAdd("POST", "/api/sshlab/upload", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var command = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload))
    // PocketBase creates each route handler in an isolated JSVM scope; keep this
    // whitelist local to runLab. Never inherit app-login or InstaBox secrets.
    var childEnv = ["PATH=" + ($os.getenv("PATH") || "")]
    var childHome = $os.getenv("HOME") || ""
    var childTmp = $os.getenv("TMPDIR") || ""
    if (childHome) childEnv.push("HOME=" + childHome)
    if (childTmp) childEnv.push("TMPDIR=" + childTmp)
    command.env = childEnv
    var out = command.output()
    // 子进程 stdout 是 UTF-8 字节流：必须按 UTF-8 解码，不能按 latin1 拼字符串，
    // 否则库里/终端里的中文会以「æˆ¥å®Œ」这类乱码返回给浏览器。
    var text = decodeUtf8Bytes(out)
    return JSON.parse(text)
  }
  try {
    var body = e.requestInfo().body || {}
    return e.json(200, runLab("sshlab.mjs", {
      action: "upload", connectionId: body.connectionId,
      remotePath: body.remotePath, content: body.content,
    }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
}, requireMesUser)

routerAdd("POST", "/api/sshlab/webhook", function (e) {
  // 把部署任务包 POST 到用户自己的 AI agent 接收端(服务端转发避免跨域)。
  try {
    var body = e.requestInfo().body || {}
    if (!body.url) return e.json(200, { ok: false, error: "缺少 webhook url" })
    var res = $http.send({
      url: String(body.url),
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.payload || {}),
      timeout: 30,
    })
    var raw = res.body || ""
    var text = ""
    if (typeof raw === "string") {
      text = raw
    } else {
      var chunk = []
      for (var i = 0; i < raw.length; i++) {
        chunk.push(raw[i])
        if (chunk.length === 8192) { text += String.fromCharCode.apply(null, chunk); chunk = [] }
      }
      if (chunk.length) text += String.fromCharCode.apply(null, chunk)
    }
    return e.json(200, {
      ok: res.statusCode >= 200 && res.statusCode < 300,
      statusCode: res.statusCode,
      response: text.slice(0, 4000),
    })
  } catch (err) {
    return e.json(200, { ok: false, error: String(err && err.message || err).slice(0, 500) })
  }
}, requireMesUser)
