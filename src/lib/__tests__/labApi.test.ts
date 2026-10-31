// 演练作业通道的前端封装（src/lib/labApi.ts）。
//
// 这里不测网络，只测「提交 → 轮询 → 取结果」这条编排逻辑：
// 完成、提交失败、连续查询失败、超时放弃等待这四条路径。
import { describe, expect, it, vi } from "vitest"
import { runLabJob, LAB_STEP_TIMEOUT_MS } from "@/lib/labApi"

type Handler = (url: string, init?: RequestInit) => Promise<Response>

const state = {
  submitResponse: { ok: true, jobId: "job-test-1" } as Record<string, unknown>,
  pollResponses: [] as Record<string, unknown>[],
  pollCalls: 0,
  submitThrows: false,
  pollThrows: 0,
}

vi.mock("@/lib/pb", () => ({
  getPocketBaseUrl: () => "/mes/__pb",
  pbFetch: (async (url: string) => {
    if (String(url).endsWith("/api/labjob/submit")) {
      if (state.submitThrows) throw new Error("网络断了")
      return new Response(JSON.stringify(state.submitResponse), { status: 200 })
    }
    if (String(url).endsWith("/api/labjob/poll")) {
      state.pollCalls += 1
      if (state.pollThrows > 0) {
        state.pollThrows -= 1
        throw new Error("查询失败")
      }
      const next = state.pollResponses.shift() ?? { ok: true, status: "pending" }
      return new Response(JSON.stringify(next), { status: 200 })
    }
    return new Response("{}", { status: 404 })
  }) as Handler,
}))

describe("作业通道前端封装", () => {
  it("轮询到完成就返回执行结果", async () => {
    state.submitResponse = { ok: true, jobId: "job-test-1" }
    state.pollResponses = [
      { ok: true, status: "pending" },
      { ok: true, status: "done", result: { ok: true, stdout: "hello" } },
    ]
    const r = await runLabJob({ kind: "server", command: "echo hello" }, { intervalMs: 1 })
    expect(r.ok).toBe(true)
    expect(r.result?.stdout).toBe("hello")
  })

  it("提交失败时立刻返回错误，不进入轮询", async () => {
    state.submitResponse = { ok: false, error: "作业提交失败" }
    const before = state.pollCalls
    const r = await runLabJob({ kind: "server", command: "echo hi" }, { intervalMs: 1 })
    expect(r.ok).toBe(false)
    expect(r.error).toContain("作业提交失败")
    expect(state.pollCalls).toBe(before)
  })

  it("执行结果本身是失败时，错误信息透出来", async () => {
    state.submitResponse = { ok: true, jobId: "job-test-1" }
    state.pollResponses = [{ ok: true, status: "done", result: { ok: false, error: "命令执行失败" } }]
    const r = await runLabJob({ kind: "server", command: "false" }, { intervalMs: 1 })
    expect(r.ok).toBe(false)
    expect(r.error).toContain("命令执行失败")
  })

  it("超过等待上限就放弃（不无限轮询）", async () => {
    state.submitResponse = { ok: true, jobId: "job-test-1" }
    state.pollResponses = []
    const r = await runLabJob({ kind: "server", command: "sleep 999" }, { timeoutMs: 30, intervalMs: 5 })
    expect(r.ok).toBe(false)
    expect(String(r.error)).toContain("仍未结束")
  })

  it("单步硬上限是 5 分钟（服务端同值兜底）", () => {
    expect(LAB_STEP_TIMEOUT_MS).toBe(300000)
  })
})
