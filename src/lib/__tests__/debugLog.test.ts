// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { clearDebugEntries, getDebugEntries, initDebugLog, pushDebugEntry } from "@/lib/debugLog"

describe("debugLog 运行时错误收集", () => {
  beforeEach(() => {
    clearDebugEntries()
  })

  it("push 后新的在前，带 ISO 时间戳", () => {
    pushDebugEntry({ type: "error", message: "第一条" })
    pushDebugEntry({ type: "react", message: "第二条", stack: "组件栈" })
    const entries = getDebugEntries()
    expect(entries).toHaveLength(2)
    expect(entries[0].message).toBe("第二条")
    expect(entries[0].stack).toBe("组件栈")
    expect(entries[1].message).toBe("第一条")
    expect(new Date(entries[0].t).toISOString()).toBe(entries[0].t)
  })

  it("环形缓冲封顶 50 条", () => {
    for (let i = 0; i < 60; i++) pushDebugEntry({ type: "error", message: `第 ${i} 条` })
    const entries = getDebugEntries()
    expect(entries).toHaveLength(50)
    expect(entries[0].message).toBe("第 59 条")
  })

  it("持久化到 localStorage，clear 后清空", () => {
    pushDebugEntry({ type: "unhandledrejection", message: "promise 炸了" })
    const raw = window.localStorage.getItem("mes_debug_log")
    expect(raw).toContain("promise 炸了")
    clearDebugEntries()
    expect(getDebugEntries()).toHaveLength(0)
    expect(window.localStorage.getItem("mes_debug_log")).toBe("[]")
  })

  it("initDebugLog 幂等：重复调用不重复挂监听", () => {
    initDebugLog()
    initDebugLog()
    // 手动派发一个全局错误，只应记录一条
    const before = getDebugEntries().length
    window.dispatchEvent(new ErrorEvent("error", { message: "手动派发的错误" }))
    expect(getDebugEntries().length).toBe(before + 1)
    expect(getDebugEntries()[0].message).toBe("手动派发的错误")
  })
})
