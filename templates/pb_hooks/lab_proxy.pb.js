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

routerAdd("GET", "/api/dblab/connections", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var out = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload)).output()
    var text = ""
    var chunk = []
    for (var i = 0; i < out.length; i++) {
      chunk.push(out[i])
      if (chunk.length === 8192) { text += String.fromCharCode.apply(null, chunk); chunk = [] }
    }
    if (chunk.length) text += String.fromCharCode.apply(null, chunk)
    return JSON.parse(text)
  }
  try {
    return e.json(200, runLab("dblab.mjs", { action: "list" }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
})

routerAdd("POST", "/api/dblab/connections", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var out = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload)).output()
    var text = ""
    var chunk = []
    for (var i = 0; i < out.length; i++) {
      chunk.push(out[i])
      if (chunk.length === 8192) { text += String.fromCharCode.apply(null, chunk); chunk = [] }
    }
    if (chunk.length) text += String.fromCharCode.apply(null, chunk)
    return JSON.parse(text)
  }
  try {
    var body = e.requestInfo().body || {}
    return e.json(200, runLab("dblab.mjs", { action: "save", connection: body.connection || {} }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
})

routerAdd("POST", "/api/dblab/connections/delete", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var out = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload)).output()
    var text = ""
    var chunk = []
    for (var i = 0; i < out.length; i++) {
      chunk.push(out[i])
      if (chunk.length === 8192) { text += String.fromCharCode.apply(null, chunk); chunk = [] }
    }
    if (chunk.length) text += String.fromCharCode.apply(null, chunk)
    return JSON.parse(text)
  }
  try {
    var body = e.requestInfo().body || {}
    return e.json(200, runLab("dblab.mjs", { action: "delete", id: body.id }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
})

routerAdd("POST", "/api/dblab/test", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var out = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload)).output()
    var text = ""
    var chunk = []
    for (var i = 0; i < out.length; i++) {
      chunk.push(out[i])
      if (chunk.length === 8192) { text += String.fromCharCode.apply(null, chunk); chunk = [] }
    }
    if (chunk.length) text += String.fromCharCode.apply(null, chunk)
    return JSON.parse(text)
  }
  try {
    var body = e.requestInfo().body || {}
    return e.json(200, runLab("dblab.mjs", { action: "test", connectionId: body.connectionId, connection: body.connection }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
})

routerAdd("POST", "/api/dblab/exec", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var out = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload)).output()
    var text = ""
    var chunk = []
    for (var i = 0; i < out.length; i++) {
      chunk.push(out[i])
      if (chunk.length === 8192) { text += String.fromCharCode.apply(null, chunk); chunk = [] }
    }
    if (chunk.length) text += String.fromCharCode.apply(null, chunk)
    return JSON.parse(text)
  }
  try {
    var body = e.requestInfo().body || {}
    return e.json(200, runLab("dblab.mjs", { action: "exec", connectionId: body.connectionId, sql: body.sql }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
})

routerAdd("POST", "/api/dblab/reset-builtin", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var out = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload)).output()
    var text = ""
    var chunk = []
    for (var i = 0; i < out.length; i++) {
      chunk.push(out[i])
      if (chunk.length === 8192) { text += String.fromCharCode.apply(null, chunk); chunk = [] }
    }
    if (chunk.length) text += String.fromCharCode.apply(null, chunk)
    return JSON.parse(text)
  }
  try {
    return e.json(200, runLab("dblab.mjs", { action: "reset-builtin" }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
})

// ---------------------------------------------------------------------------
// sshlab
// ---------------------------------------------------------------------------

routerAdd("GET", "/api/sshlab/connections", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var out = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload)).output()
    var text = ""
    var chunk = []
    for (var i = 0; i < out.length; i++) {
      chunk.push(out[i])
      if (chunk.length === 8192) { text += String.fromCharCode.apply(null, chunk); chunk = [] }
    }
    if (chunk.length) text += String.fromCharCode.apply(null, chunk)
    return JSON.parse(text)
  }
  try {
    return e.json(200, runLab("sshlab.mjs", { action: "list" }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
})

routerAdd("POST", "/api/sshlab/connections", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var out = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload)).output()
    var text = ""
    var chunk = []
    for (var i = 0; i < out.length; i++) {
      chunk.push(out[i])
      if (chunk.length === 8192) { text += String.fromCharCode.apply(null, chunk); chunk = [] }
    }
    if (chunk.length) text += String.fromCharCode.apply(null, chunk)
    return JSON.parse(text)
  }
  try {
    var body = e.requestInfo().body || {}
    return e.json(200, runLab("sshlab.mjs", { action: "save", connection: body.connection || {} }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
})

routerAdd("POST", "/api/sshlab/connections/delete", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var out = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload)).output()
    var text = ""
    var chunk = []
    for (var i = 0; i < out.length; i++) {
      chunk.push(out[i])
      if (chunk.length === 8192) { text += String.fromCharCode.apply(null, chunk); chunk = [] }
    }
    if (chunk.length) text += String.fromCharCode.apply(null, chunk)
    return JSON.parse(text)
  }
  try {
    var body = e.requestInfo().body || {}
    return e.json(200, runLab("sshlab.mjs", { action: "delete", id: body.id }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
})

routerAdd("POST", "/api/sshlab/test", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var out = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload)).output()
    var text = ""
    var chunk = []
    for (var i = 0; i < out.length; i++) {
      chunk.push(out[i])
      if (chunk.length === 8192) { text += String.fromCharCode.apply(null, chunk); chunk = [] }
    }
    if (chunk.length) text += String.fromCharCode.apply(null, chunk)
    return JSON.parse(text)
  }
  try {
    var body = e.requestInfo().body || {}
    return e.json(200, runLab("sshlab.mjs", { action: "test", connectionId: body.connectionId, connection: body.connection }))
  } catch (err) {
    return e.json(200, { ok: false, error: "lab 执行器调用失败", native: String(err && err.message || err).slice(0, 500) })
  }
})

routerAdd("POST", "/api/sshlab/exec", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var out = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload)).output()
    var text = ""
    var chunk = []
    for (var i = 0; i < out.length; i++) {
      chunk.push(out[i])
      if (chunk.length === 8192) { text += String.fromCharCode.apply(null, chunk); chunk = [] }
    }
    if (chunk.length) text += String.fromCharCode.apply(null, chunk)
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
})

routerAdd("POST", "/api/sshlab/upload", function (e) {
  function runLab(script, payload) {
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var out = $os.cmd(nodeBin, serverDir + "/" + script, JSON.stringify(payload)).output()
    var text = ""
    var chunk = []
    for (var i = 0; i < out.length; i++) {
      chunk.push(out[i])
      if (chunk.length === 8192) { text += String.fromCharCode.apply(null, chunk); chunk = [] }
    }
    if (chunk.length) text += String.fromCharCode.apply(null, chunk)
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
})

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
})
