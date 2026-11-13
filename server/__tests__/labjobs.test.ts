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

type LabJobPoll = { ok: boolean; status?: string; error?: string; result?: { ok?: boolean; error?: string; [key: string]: unknown }; [key: string]: unknown }

async function waitDone(jobId: string, tries = 60, dataDir = tmpDir, ownerId = "owner-a"): Promise<LabJobPoll> {
  for (let i = 0; i < tries; i++) {
    const p = runLabjobs(["poll"], { MES_LAB_JOB_ID: jobId, MES_LAB_JOB_OWNER_ID: ownerId, MES_LAB_DATA: dataDir })
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
      MES_LAB_JOB_PAYLOAD: JSON.stringify({ ownerId: "owner-a", kind: "db", sql: "SELECT 1 AS c" }),
    })
    expect(res.ok).toBe(true)
    expect(typeof res.jobId).toBe("string")
    expect(res.expiresAt).toBeTruthy()
    const dir = path.join(jobsDir, res.jobId as string)
    expect(fs.statSync(dir).mode & 0o777).toBe(0o700)
    expect(fs.statSync(path.join(dir, "payload.json")).mode & 0o777).toBe(0o600)
    expect(fs.statSync(path.join(dir, "owner.json")).mode & 0o777).toBe(0o600)
  })

  it("并发首次访问内置练习库不会争抢初始化", async () => {
    const isolatedData = fs.mkdtempSync(path.join(os.tmpdir(), "mes-labjobs-race-test-"))
    try {
      const first = runLabjobs(["submit"], {
        MES_LAB_DATA: isolatedData,
        MES_LAB_JOB_PAYLOAD: JSON.stringify({ ownerId: "owner-a", kind: "db", sql: "SELECT 1 AS c" }),
      })
      const second = runLabjobs(["submit"], {
        MES_LAB_DATA: isolatedData,
        MES_LAB_JOB_PAYLOAD: JSON.stringify({ ownerId: "owner-a", kind: "db", sql: "SELECT COUNT(*) AS c FROM items" }),
      })
      expect(first.ok).toBe(true)
      expect(second.ok).toBe(true)
      const [a, b] = await Promise.all([
        waitDone(first.jobId as string, 60, isolatedData),
        waitDone(second.jobId as string, 60, isolatedData),
      ])
      expect(a.result?.ok).toBe(true)
      expect(b.result?.ok).toBe(true)
      expect(JSON.stringify(b.result)).toContain("24")
    } finally {
      fs.rmSync(isolatedData, { recursive: true, force: true })
    }
  })

  it("轮询能拿到执行结果（内置练习库 SELECT）", async () => {
    const res = runLabjobs(["submit"], {
      MES_LAB_JOB_PAYLOAD: JSON.stringify({ ownerId: "owner-a", kind: "db", sql: "SELECT COUNT(*) AS c FROM items" }),
    })
    expect(res.ok).toBe(true)
    const done = await waitDone(res.jobId as string)
    expect(done.ok).toBe(true)
    expect(done.status).toBe("done")
    expect(done.result?.ok).toBe(true)
    expect(JSON.stringify(done.result)).toContain("24")
  })

  it("异步作业结果只能由提交账号轮询", async () => {
    const res = runLabjobs(["submit"], {
      MES_LAB_JOB_PAYLOAD: JSON.stringify({ ownerId: "owner-a", kind: "db", sql: "SELECT 1 AS c" }),
    })
    expect(res.ok).toBe(true)
    const forbidden = runLabjobs(["poll"], { MES_LAB_JOB_ID: res.jobId, MES_LAB_JOB_OWNER_ID: "owner-b" })
    expect(forbidden).toMatchObject({ ok: false, error: "作业不存在或无权查看" })
    const own = await waitDone(res.jobId as string)
    expect(own).toMatchObject({ ok: true, status: "done" })
  })

  it("缺少服务端注入的账号范围时不接受作业", () => {
    const res = runLabjobs(["submit"], { MES_LAB_JOB_PAYLOAD: JSON.stringify({ kind: "db", sql: "SELECT 1" }) })
    expect(res).toMatchObject({ ok: false, error: "MES account scope is required" })
  })

  it("执行完就不再留载荷文件（一次性环境口令不落盘）", async () => {
    const res = runLabjobs(["submit"], {
      MES_LAB_JOB_PAYLOAD: JSON.stringify({
        ownerId: "owner-a", kind: "server",
        connection: { host: "127.0.0.1", port: 9, username: "lab", password: "s3cret" },
        command: "echo hi",
        timeoutMs: 1000,
      }),
    })
    expect(res.ok).toBe(true)
    const done = await waitDone(res.jobId as string)
    expect(done.status).toBe("done")
    const dir = path.join(jobsDir, res.jobId as string)
    expect(fs.existsSync(path.join(dir, "payload.json"))).toBe(false)
    expect(fs.existsSync(path.join(dir, "request.json"))).toBe(false)
  })

  it("执行失败时结果里带明确错误（连接被拒绝）", async () => {
    const res = runLabjobs(["submit"], {
      MES_LAB_JOB_PAYLOAD: JSON.stringify({
        ownerId: "owner-a", kind: "server",
        connection: { host: "127.0.0.1", port: 9, username: "lab", password: "x" },
        command: "echo hi",
        timeoutMs: 5000,
      }),
    })
    expect(res.ok).toBe(true)
    const done = await waitDone(res.jobId as string)
    expect(done.status).toBe("done")
    expect(done.result?.ok).toBe(false)
    expect(String(done.result?.error || "")).toMatch(/拒绝|refused|连接/i)
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
    const bad = runLabjobs(["submit"], { MES_LAB_JOB_PAYLOAD: JSON.stringify({ ownerId: "owner-a", kind: "nope" }) })
    expect(bad.ok).toBe(false)
    expect(String(bad.error)).toMatch(/作业类型/)
    const pollBad = runLabjobs(["poll"], { MES_LAB_JOB_ID: "../../etc/passwd" })
    expect(pollBad.ok).toBe(false)
    expect(String(pollBad.error)).toMatch(/非法/)
  })
})
