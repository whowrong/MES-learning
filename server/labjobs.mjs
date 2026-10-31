#!/usr/bin/env node
// labjobs.mjs — 演练作业通道：异步提交 + 轮询取结果
//
// 为什么需要这个通道：
//   站点外层平台网关对单个 HTTP 请求约 20 秒硬截断（实测 sleep 25s 必返 502），
//   放宽服务端内部超时救不了 502 —— 只能把执行搬出请求生命周期：
//   提交即返回 jobId，浏览器轮询取结果。造满 inode 这类重活单步要几分钟，
//   走这条通道后单步可以安全放宽到 5 分钟（有硬上限，不影响其它题目）。
//
// 契约（都是 argv/env 传 JSON，stdout 单行 JSON，恒 exit 0）：
//   submit  env MES_LAB_JOB_PAYLOAD=JSON  → { ok, jobId, expiresAt }
//   poll    env MES_LAB_JOB_ID=<id>       → { ok, status: "pending"|"done", result }
//   work    argv[2]=<id>                  （内部使用：脱离父进程执行的那一支）
//   sweep   无参                          → { ok, removed: [...] }
//
// 落盘约定：作业目录 0700，目录内文件 0600；载荷含一次性环境口令，
// 执行完立刻删除载荷文件；作业 30 分钟 TTL 回收（submit/poll 时顺带清扫）。
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { asciiSafeJson } from "./asciiJson.mjs"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const LAB_DATA = process.env.MES_LAB_DATA || "/workspace/pocketbase-bin/lab-data"
const JOBS_DIR = path.join(LAB_DATA, "jobs")
const JOB_TTL_MS = 30 * 60 * 1000
/** 各类作业的执行上限（毫秒）：超过即杀掉子进程并判超时 */
export const EXEC_LIMITS = { db: 60000, server: 300000, labenv: 600000 }
const JOB_ID_RE = /^job-[a-z0-9-]{4,64}$/
const MAX_OUTPUT = 4 * 1024 * 1024

function out(obj) {
  process.stdout.write(asciiSafeJson(obj))
  process.exit(0)
}

function ensureJobsDir() {
  fs.mkdirSync(JOBS_DIR, { recursive: true, mode: 0o700 })
  try {
    fs.chmodSync(JOBS_DIR, 0o700)
  } catch {
    // 目录已存在且属主一致时 chmod 可能失败，不影响主流程
  }
}

function jobDir(id) {
  if (!JOB_ID_RE.test(String(id || ""))) return null
  return path.join(JOBS_DIR, id)
}

function writeJsonSecure(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj), { mode: 0o600 })
  try {
    fs.chmodSync(file, 0o600)
  } catch {
    // 同上：权限收紧失败不阻断
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return null
  }
}

/** 清掉超时未回收的作业目录 */
export function sweepJobs(ttlMs = JOB_TTL_MS) {
  const removed = []
  let entries = []
  try {
    entries = fs.readdirSync(JOBS_DIR, { withFileTypes: true })
  } catch {
    return removed
  }
  const now = Date.now()
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const dir = path.join(JOBS_DIR, e.name)
    let mtime = 0
    try {
      mtime = fs.statSync(dir).mtimeMs
    } catch {
      continue
    }
    if (now - mtime > ttlMs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true })
        removed.push(e.name)
      } catch {
        // 删不掉就留给下一次清扫
      }
    }
  }
  return removed
}

/** 子进程环境：只透传白名单变量（LAB_DATA 供测试隔离用） */
function childEnv() {
  const env = { PATH: process.env.PATH || "", HOME: process.env.HOME || "" }
  if (process.env.MES_LAB_DATA) env.MES_LAB_DATA = process.env.MES_LAB_DATA
  return env
}

/** 执行器请求 → 具体执行器与请求体 */
function buildExecutorRequest(payload) {
  const kind = String(payload.kind || "")
  if (kind === "db") {
    return {
      script: "dblab.mjs",
      request: {
        action: "exec",
        connectionId: payload.connectionId,
        connection: payload.connection,
        sql: payload.sql,
      },
      limit: EXEC_LIMITS.db,
    }
  }
  if (kind === "server") {
    const asked = Number(payload.timeoutMs) || EXEC_LIMITS.server
    const timeoutMs = Math.max(1000, Math.min(asked, EXEC_LIMITS.server))
    return {
      script: "sshlab.mjs",
      request: {
        action: "exec",
        connectionId: payload.connectionId,
        connection: payload.connection,
        command: payload.command,
        timeoutMs,
      },
      limit: timeoutMs + 15000,
    }
  }
  if (kind === "labenv") {
    return {
      script: "labenv.mjs",
      request: {
        action: payload.action || "create",
        kind: payload.envKind,
        dbType: payload.dbType,
        id: payload.id,
      },
      limit: EXEC_LIMITS.labenv,
    }
  }
  return null
}

/** 跑一次执行器：超时即杀掉子进程 */
function runExecutor(script, requestFile, limitMs) {
  return new Promise((resolve) => {
    let stdout = ""
    let stderr = ""
    let timedOut = false
    let child
    try {
      child = spawn(process.execPath, [path.join(HERE, script), "@" + requestFile], {
        stdio: ["ignore", "pipe", "pipe"],
        env: childEnv(),
      })
    } catch (e) {
      resolve({ code: -1, stdout: "", stderr: String(e), timedOut: false })
      return
    }
    const timer = setTimeout(() => {
      timedOut = true
      try {
        child.kill("SIGKILL")
      } catch {
        // 已经退出就算了
      }
    }, limitMs)
    child.stdout.on("data", (d) => {
      if (stdout.length < MAX_OUTPUT) stdout += d.toString()
    })
    child.stderr.on("data", (d) => {
      if (stderr.length < MAX_OUTPUT) stderr += d.toString()
    })
    child.on("error", (e) => {
      clearTimeout(timer)
      resolve({ code: -1, stdout, stderr: stderr + String(e), timedOut })
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr, timedOut })
    })
  })
}

/** 提交作业：落载荷 → 派生脱离父进程的执行者 → 立刻返回 jobId */
function submit(payload) {
  if (!payload || typeof payload !== "object") return { ok: false, error: "作业载荷为空" }
  const plan = buildExecutorRequest(payload)
  if (!plan) return { ok: false, error: "未知的作业类型: " + String(payload.kind) }
  ensureJobsDir()
  sweepJobs()
  const id = "job-" + Date.now().toString(36) + "-" + crypto.randomBytes(5).toString("hex")
  const dir = jobDir(id)
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  try {
    fs.chmodSync(dir, 0o700)
  } catch {
    // 同上
  }
  writeJsonSecure(path.join(dir, "payload.json"), payload)
  // 执行者脱离父进程：stdout/stderr 全部丢弃，避免管道被孙进程占住导致父进程不退出
  let child
  try {
    child = spawn(process.execPath, [path.join(HERE, "labjobs.mjs"), "work", id], {
      detached: true,
      stdio: "ignore",
      env: childEnv(),
    })
    child.unref()
  } catch (e) {
    return { ok: false, error: "作业派生失败: " + String(e) }
  }
  return { ok: true, jobId: id, expiresAt: new Date(Date.now() + JOB_TTL_MS).toISOString() }
}

/** 执行者：读载荷 → 跑执行器 → 写结果 */
async function work(id) {
  const dir = jobDir(id)
  if (!dir) return { ok: false, error: "作业 id 非法" }
  const payloadFile = path.join(dir, "payload.json")
  const payload = readJson(payloadFile)
  // 载荷里有一次性环境口令，执行完立刻删掉，不在磁盘上久留
  try {
    fs.unlinkSync(payloadFile)
  } catch {
    // 已经不在就算了
  }
  if (!payload) return { ok: false, error: "作业载荷丢失" }
  const plan = buildExecutorRequest(payload)
  if (!plan) return { ok: false, error: "未知的作业类型: " + String(payload.kind) }
  const requestFile = path.join(dir, "request.json")
  writeJsonSecure(requestFile, plan.request)
  const started = Date.now()
  const r = await runExecutor(plan.script, requestFile, plan.limit)
  try {
    fs.unlinkSync(requestFile)
  } catch {
    // 同上
  }
  let result
  if (r.timedOut) {
    result = { ok: false, error: `作业超时（超过 ${Math.round(plan.limit / 1000)} 秒仍未结束，已终止）` }
  } else {
    const text = String(r.stdout || "").trim()
    try {
      result = text ? JSON.parse(text) : { ok: false, error: "执行器没有返回结果", native: String(r.stderr || "").slice(0, 500) }
    } catch {
      result = { ok: false, error: "执行器输出无法解析", native: String(text || r.stderr || "").slice(0, 500) }
    }
  }
  return { ok: true, result, durationMs: Date.now() - started }
}

/** 查询作业结果 */
function poll(id) {
  const dir = jobDir(id)
  if (!dir) return { ok: false, error: "作业 id 非法" }
  const resultFile = path.join(dir, "result.json")
  const result = readJson(resultFile)
  if (result) return { ok: true, status: "done", result: result.result ?? { ok: false, error: "作业没有结果" }, durationMs: result.durationMs }
  let exists = true
  try {
    fs.statSync(dir)
  } catch {
    exists = false
  }
  if (!exists) return { ok: false, error: "作业不存在或已过期回收" }
  return { ok: true, status: "pending" }
}

async function main() {
  const cmd = process.argv[2] || ""
  try {
    if (cmd === "submit") {
      let payload = null
      const raw = process.env.MES_LAB_JOB_PAYLOAD || ""
      if (raw) {
        try {
          payload = JSON.parse(raw)
        } catch {
          payload = null
        }
      }
      const r = submit(payload)
      return out(r)
    }
    if (cmd === "poll") {
      sweepJobs()
      return out(poll(process.env.MES_LAB_JOB_ID || ""))
    }
    if (cmd === "work") {
      const r = await work(process.argv[3] || "")
      const dir = jobDir(process.argv[3] || "")
      if (dir) {
        writeJsonSecure(path.join(dir, "result.json"), {
          result: r.result,
          durationMs: r.durationMs,
          finishedAt: new Date().toISOString(),
        })
      }
      return out(r)
    }
    if (cmd === "sweep") {
      return out({ ok: true, removed: sweepJobs() })
    }
    return out({ ok: false, error: "未知命令: " + cmd })
  } catch (e) {
    return out({ ok: false, error: e?.message || String(e) })
  }
}

const invokedDirectly = process.argv[1] && /labjobs\.mjs$/.test(process.argv[1])
if (invokedDirectly) main()
