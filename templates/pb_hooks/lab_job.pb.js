/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/lab_job.pb.js — 演练作业通道（异步提交 + 轮询取结果）
//
// 为什么需要这条通道：
//   站点外层平台网关对单个 HTTP 请求约 20 秒硬截断（实测 sleep 25s 必返 502），
//   而「造满 inode」这类重活单步要跑几分钟。放宽内部超时救不了 502，
//   只能把执行搬出请求生命周期：提交立刻返回 jobId，浏览器轮询取结果。
//
// 与既有执行器的关系：
//   真正干活的仍是 server/dblab.mjs、server/sshlab.mjs、server/labenv.mjs，
//   本文件只负责「把作业派出去」与「把结果读回来」：
//     POST /api/labjob/submit  → server/labjobs.mjs submit（派活后立刻返回）
//     POST /api/labjob/poll    → server/labjobs.mjs poll（读作业结果，毫秒级）
//
// ⚠️ PB hooks 约定: 每个 routerAdd 处理器是独立作用域, 看不到顶层函数,
// 所以 decodeUtf8Bytes / requireMesUser 在文件顶层各定义一份, 不从别的 hook 引入。

// 只允许普通 MES 应用账号调用；超级管理员走本地 PocketBase 管理界面。
function requireMesUser(e) {
  if (!e.auth) throw new UnauthorizedError("Authentication required")
  if (e.auth.isSuperuser() || e.auth.collection().name !== "mes_users") {
    throw new ForbiddenError("MES app account required")
  }
  return e.next()
}

routerAdd("POST", "/api/labjob/submit", function (e) {
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
  try {
    var body = e.requestInfo().body || {}
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var payload = {
      kind: String(body.kind || ""),
      action: body.action,
      envKind: body.envKind,
      dbType: body.dbType,
      connectionId: body.connectionId,
      connection: body.connection,
      sql: body.sql,
      command: body.command,
      timeoutMs: body.timeoutMs,
      id: body.id,
    }
    var command = $os.cmd(nodeBin, serverDir + "/labjobs.mjs", "submit")
    // 子进程环境只放白名单变量 + 作业载荷，绝不继承应用登录或 InstaBox 密钥。
    var childEnv = ["PATH=" + ($os.getenv("PATH") || "")]
    var childHome = $os.getenv("HOME") || ""
    var childTmp = $os.getenv("TMPDIR") || ""
    if (childHome) childEnv.push("HOME=" + childHome)
    if (childTmp) childEnv.push("TMPDIR=" + childTmp)
    childEnv.push("MES_LAB_JOB_PAYLOAD=" + JSON.stringify(payload))
    command.env = childEnv
    var out = command.output()
    var text = decodeUtf8Bytes(out)
    return e.json(200, JSON.parse(text))
  } catch (err) {
    return e.json(200, { ok: false, error: "作业提交失败", native: String(err && err.message || err).slice(0, 500) })
  }
}, requireMesUser)

routerAdd("POST", "/api/labjob/poll", function (e) {
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
  try {
    var body = e.requestInfo().body || {}
    var jobId = String(body.jobId || "")
    var nodeBin = $os.getenv("MES_LAB_NODE") || "node"
    var serverDir = $os.getenv("MES_SERVER_DIR") || "/workspace/pocketbase-bin/server"
    var command = $os.cmd(nodeBin, serverDir + "/labjobs.mjs", "poll")
    var childEnv = ["PATH=" + ($os.getenv("PATH") || "")]
    var childHome = $os.getenv("HOME") || ""
    var childTmp = $os.getenv("TMPDIR") || ""
    if (childHome) childEnv.push("HOME=" + childHome)
    if (childTmp) childEnv.push("TMPDIR=" + childTmp)
    childEnv.push("MES_LAB_JOB_ID=" + jobId)
    command.env = childEnv
    var out = command.output()
    var text = decodeUtf8Bytes(out)
    return e.json(200, JSON.parse(text))
  } catch (err) {
    return e.json(200, { ok: false, error: "作业查询失败", native: String(err && err.message || err).slice(0, 500) })
  }
}, requireMesUser)
