// 演练作业通道（server/labjobs.mjs）的端到端测试。
//
// 覆盖：提交即返回 jobId、作业目录/文件权限、轮询取结果、TTL 回收、
// 失败路径与非法载荷。跑在临时 LAB_DATA 上，不碰站内真实练习库。
import { describe, expect, it, beforeAll, afterAll } from "vitest"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const LABJOBS = path.join(HERE, "..", "labjobs.mjs")

let tmpDir = ""
let jobsDir = ""

function runLabjobs(args: string[], env: Record<string, string> = {}) {
  const r = spawnSync(process.execPath, [LABJOBS, ...args], {
    encoding: "utf8",
    env: { PATH: process.env.PATH || "", HOME: process.env.HOME || "", MES_LAB_DATA: tmpDir, ...env },
  })
  const text = String(r.stdout || "").trim()
  return text ? JSON.parse(text) : { ok: false, error: "没有输出: " + text + r.stderr }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitDone(jobId: string, tries = 60): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const p = runLabjobs(["poll"], { MES_LAB_JOB_ID: jobId })
    if (p.ok && p.status === "done") return p
    await sleep(250)
  }
  return { ok: false, error: "作业没有在预期时间内结束" }
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mes-labjobs-test-"))
  jobsDir = path.join(tmpDir, "jobs")
})

afterAll(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    // 临时目录清理失败不影响结论
  }
})

describe("演练作业通道", () => {
  it("提交后立刻返回 jobId，作业目录 0700、载荷文件 0600", () => {
    const res = runLabjobs(["submit"], {
      MES_LAB_JOB_PAYLOAD: JSON.stringify({ kind: "db", sql: "SELECT 1 AS c" }),
    })
    expect(res.ok).toBe(true)
    expect(typeof res.jobId).toBe("string")
    expect(res.expiresAt).toBeTruthy()
    const dir = path.join(jobsDir, res.jobId as string)
    expect(fs.statSync(dir).mode & 0o777).toBe(0o700)
    expect(fs.statSync(path.join(dir, "payload.json")).mode & 0o777).toBe(0o600)
  })

  it("轮询能拿到执行结果（内置练习库 SELECT）", async () => {
    const res = runLabjobs(["submit"], {
      MES_LAB_JOB_PAYLOAD: JSON.stringify({ kind: "db", sql: "SELECT COUNT(*) AS c FROM items" }),
    })
    expect(res.ok).toBe(true)
    const done = await waitDone(res.jobId as string)
    expect(done.ok).toBe(true)
    expect(done.status).toBe("done")
    expect(done.result.ok).toBe(true)
    expect(JSON.stringify(done.result)).toContain("24")
  })

  it("执行完就不再留载荷文件（一次性环境口令不落盘）", async () => {
    const res = runLabjobs(["submit"], {
      MES_LAB_JOB_PAYLOAD: JSON.stringify({
        kind: "server",
        connection: { host: "127.0.0.1", port: 22, username: "lab", password: "s3cret" },
        command: "echo hi",
      }),
    })
    expect(res.ok).toBe(true)
    await waitDone(res.jobId as string)
    const dir = path.join(jobsDir, res.jobId as string)
    expect(fs.existsSync(path.join(dir, "payload.json"))).toBe(false)
    expect(fs.existsSync(path.join(dir, "request.json"))).toBe(false)
  })

  it("执行失败时结果里带明确错误（连接被拒绝）", async () => {
    const res = runLabjobs(["submit"], {
      MES_LAB_JOB_PAYLOAD: JSON.stringify({
        kind: "server",
        connection: { host: "127.0.0.1", port: 9, username: "lab", password: "x" },
        command: "echo hi",
        timeoutMs: 5000,
      }),
    })
    expect(res.ok).toBe(true)
    const done = await waitDone(res.jobId as string)
    expect(done.status).toBe("done")
    expect(done.result.ok).toBe(false)
    expect(String(done.result.error || "")).toMatch(/拒绝|refused|连接/i)
  })

  it("TTL 过期后清扫掉旧作业目录", () => {
    const stale = path.join(jobsDir, "job-stale-0001")
    fs.mkdirSync(stale, { recursive: true, mode: 0o700 })
    const old = new Date(Date.now() - 60 * 60 * 1000)
    fs.utimesSync(stale, old, old)
    const res = runLabjobs(["sweep"])
    expect(res.ok).toBe(true)
    expect(res.removed).toContain("job-stale-0001")
    expect(fs.existsSync(stale)).toBe(false)
  })

  it("未知作业类型与非法 id 都给明确错误", () => {
    const bad = runLabjobs(["submit"], { MES_LAB_JOB_PAYLOAD: JSON.stringify({ kind: "nope" }) })
    expect(bad.ok).toBe(false)
    expect(String(bad.error)).toMatch(/作业类型/)
    const pollBad = runLabjobs(["poll"], { MES_LAB_JOB_ID: "../../etc/passwd" })
    expect(pollBad.ok).toBe(false)
    expect(String(pollBad.error)).toMatch(/非法/)
  })
})
