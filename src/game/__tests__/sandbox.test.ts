// 自由沙盘引擎单测：解锁判据、库存调整、BOM 改动、缺料停线与完工入库。
import { describe, expect, it } from "vitest"
import {
  SANDBOX_UNLOCK_CHAPTER_ID,
  advanceOrder,
  adjustStock,
  cancelOrder,
  createOrder,
  createSandboxState,
  isSandboxUnlocked,
  materialNeeds,
  sandboxLockMessage,
  setBomQty,
  setStock,
  type SandboxContent,
} from "@/game/sandbox"
import sandboxRaw from "../../../public/content/sandbox/index.json"

const content = sandboxRaw as SandboxContent

describe("自由沙盘解锁判据", () => {
  it("只认第三章通关这一条", () => {
    expect(SANDBOX_UNLOCK_CHAPTER_ID).toBe(3)
    expect(isSandboxUnlocked({ "1": "cleared", "2": "cleared", "3": "cleared" })).toBe(true)
  })

  it("第三章没通关就不算解锁（其它章节通关也不行）", () => {
    expect(isSandboxUnlocked({ "1": "cleared", "2": "cleared", "3": "open", "4": "cleared" })).toBe(false)
    expect(isSandboxUnlocked({})).toBe(false)
    expect(isSandboxUnlocked(undefined)).toBe(false)
  })

  it("锁定文案说清楚还差哪一条", () => {
    expect(sandboxLockMessage({ "3": "cleared" })).toBe("")
    expect(sandboxLockMessage({ "3": "open" })).toContain("还没通关")
    expect(sandboxLockMessage({ "3": "locked" })).toContain("还没解锁")
  })
})

describe("沙盘状态与库存", () => {
  it("初始库存按内容文件建档", () => {
    const state = createSandboxState(content)
    expect(state.orders).toHaveLength(0)
    for (const m of content.materials) {
      expect(state.inventory[m.id]).toBe(m.initial)
    }
  })

  it("库存可以改成负数（负库存场景）", () => {
    const state = setStock(createSandboxState(content), "steel", -5)
    expect(state.inventory.steel).toBe(-5)
  })

  it("加减库存是纯函数，不改旧状态", () => {
    const base = createSandboxState(content)
    const next = adjustStock(base, "steel", -10)
    expect(next.inventory.steel).toBe(base.inventory.steel - 10)
    expect(base.inventory.steel).toBe(content.materials.find((m) => m.id === "steel")!.initial)
  })
})

describe("工单与工序推进", () => {
  it("下单后按产品的工序排好步骤", () => {
    const state = createOrder(createSandboxState(content), content, "pump", 2)
    expect(state.orders).toHaveLength(1)
    const order = state.orders[0]
    expect(order.qty).toBe(2)
    expect(order.steps.map((s) => s.opId)).toEqual(["cut", "weld", "assemble"])
    expect(order.status).toBe("planned")
  })

  it("数量非法时不建单", () => {
    const base = createSandboxState(content)
    expect(createOrder(base, content, "pump", 0).orders).toHaveLength(0)
    expect(createOrder(base, content, "pump", -3).orders).toHaveLength(0)
    expect(createOrder(base, content, "not-exist", 1).orders).toHaveLength(0)
  })

  it("物料需求按单台用量乘批量", () => {
    const state = createOrder(createSandboxState(content), content, "pump", 3)
    const needs = materialNeeds(state, state.orders[0])
    expect(needs.steel).toBe(30)
    expect(needs.bolt).toBe(18)
  })

  it("领料会扣库存，工序逐步推进，最后完工入库", () => {
    let state = createOrder(createSandboxState(content), content, "pump", 1)
    const id = state.orders[0].id
    const steelBefore = state.inventory.steel

    state = advanceOrder(state, content, id)
    expect(state.orders[0].status).toBe("running")
    expect(state.inventory.steel).toBe(steelBefore - 10)

    state = advanceOrder(state, content, id)
    expect(state.orders[0].stepIndex).toBe(1)
    state = advanceOrder(state, content, id)
    expect(state.orders[0].stepIndex).toBe(2)
    state = advanceOrder(state, content, id)
    expect(state.orders[0].status).toBe("done")
    expect(state.finished.pump).toBe(1)
  })

  it("库存不够就停线：不扣料、补料后能继续", () => {
    let state = createOrder(createSandboxState(content), content, "heater", 2)
    const id = state.orders[0].id
    state = setStock(state, "copper", 1) // 需要 6，只有 1

    state = advanceOrder(state, content, id)
    expect(state.orders[0].status).toBe("blocked")
    expect(state.orders[0].shortage?.material).toBe("copper")
    expect(state.orders[0].shortage?.need).toBe(6)
    expect(state.inventory.copper).toBe(1) // 停线不扣料

    state = setStock(state, "copper", 20)
    state = advanceOrder(state, content, id)
    expect(state.orders[0].status).toBe("running")
    expect(state.inventory.copper).toBe(14)
  })

  it("BOM 改错之后先在领料这步断料", () => {
    let state = createOrder(createSandboxState(content), content, "pump", 1)
    const id = state.orders[0].id
    state = setBomQty(state, "pump", "steel", 500) // 把 BOM 写错
    state = advanceOrder(state, content, id)
    expect(state.orders[0].status).toBe("blocked")
    expect(state.orders[0].shortage?.material).toBe("steel")
  })

  it("撤回的工单回到待开工", () => {
    let state = createOrder(createSandboxState(content), content, "pump", 1)
    const id = state.orders[0].id
    state = advanceOrder(state, content, id)
    expect(state.orders[0].status).toBe("running")
    state = cancelOrder(state, id)
    expect(state.orders[0].status).toBe("planned")
    expect(state.orders[0].stepIndex).toBe(-1)
  })

  it("完工的工单不能再推进", () => {
    let state = createOrder(createSandboxState(content), content, "pump", 1)
    const id = state.orders[0].id
    for (let i = 0; i < 4; i += 1) state = advanceOrder(state, content, id)
    expect(state.orders[0].status).toBe("done")
    const before = state.finished.pump
    state = advanceOrder(state, content, id)
    expect(state.finished.pump).toBe(before)
  })
})
