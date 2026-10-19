import { describe, expect, it } from "vitest"
import {
  applyGaugeDeltas,
  computeBackflush,
  computeChapterScore,
  countVariance,
  deductInventory,
  settleByContent,
  settleChapter1,
  type InventoryLine,
} from "@/game/settlement"

describe("computeBackflush 倒冲扣料", () => {
  it("500 把椅子 × 单耗 2.5m 钢管 = 精确扣 1250m", () => {
    const { deductQty } = computeBackflush({ reportedQty: 500, unitUsage: 2.5 })
    expect(deductQty).toBe(1250)
  })

  it("含 3% 损耗率：500 × 2.5 × 1.03 = 1287.5", () => {
    const { deductQty } = computeBackflush({ reportedQty: 500, unitUsage: 2.5, lossRate: 0.03 })
    expect(deductQty).toBe(1287.5)
  })

  it("浮点陷阱用例：0.1 + 0.2 型误差被抹平", () => {
    const { deductQty } = computeBackflush({ reportedQty: 3, unitUsage: 0.1 })
    expect(deductQty).toBe(0.3)
  })
})

describe("deductInventory 库存计算", () => {
  const line: InventoryLine = { materialId: "m1", materialName: "钢管", unit: "m", qty: 2000 }

  it("扣减后精确余量，不改入参", () => {
    const { line: next, negative } = deductInventory(line, 1250)
    expect(next.qty).toBe(750)
    expect(negative).toBe(false)
    expect(line.qty).toBe(2000)
  })

  it("扣成负库存要报 negative（账实不符欠账）", () => {
    const { line: next, negative } = deductInventory(line, 2500)
    expect(next.qty).toBe(-500)
    expect(negative).toBe(true)
  })
})

describe("countVariance 盘点差异", () => {
  it("账 300 实 290 → 差异率约 3.3%", () => {
    expect(countVariance(300, 290)).toBeCloseTo(1 / 30, 6)
  })
  it("账 0 实 0 → 0；账 0 实非 0 → 1", () => {
    expect(countVariance(0, 0)).toBe(0)
    expect(countVariance(0, 5)).toBe(1)
  })
})

describe("applyGaugeDeltas 仪表结算", () => {
  it("写入 prev 供涨跌箭头，且钳制在 [0, max]", () => {
    const current = { workerMorale: { value: 70 } }
    const next = applyGaugeDeltas(current, [
      { key: "workerMorale", delta: -3, reason: "答错" },
    ])
    expect(next.workerMorale.value).toBe(67)
    expect(next.workerMorale.prev).toBe(70)
  })

  it("不会扣穿 0", () => {
    const next = applyGaugeDeltas({ downtimeHours: { value: 1 } }, [
      { key: "downtimeHours", delta: -5, reason: "x" },
    ])
    expect(next.downtimeHours.value).toBe(0)
  })

  it("未知 key 被忽略", () => {
    const next = applyGaugeDeltas({}, [{ key: "notExist", delta: 5, reason: "x" }])
    expect(Object.keys(next)).toHaveLength(0)
  })
})

describe("settleChapter1 第一章结算", () => {
  it("全对：只加进度，数据准确率不扣", () => {
    const deltas = settleChapter1({ matchWrong: 0, quizWrong: 0, sortWrong: 0, progressReward: 15 })
    expect(deltas.find((d) => d.key === "projectProgress")?.delta).toBe(15)
    expect(deltas.find((d) => d.key === "dataAccuracy")?.delta).toBe(0)
    expect(deltas.some((d) => d.key === "workerMorale")).toBe(false)
  })

  it("错 3 处：数据准确率 -6、工人配合度 -3，且带原因文案", () => {
    const deltas = settleChapter1({ matchWrong: 2, sortWrong: 1, progressReward: 15 })
    const acc = deltas.find((d) => d.key === "dataAccuracy")!
    const morale = deltas.find((d) => d.key === "workerMorale")!
    expect(acc.delta).toBe(-6)
    expect(morale.delta).toBe(-3)
    expect(acc.reason.length).toBeGreaterThan(0)
  })

  it("抉择关错题一并计入扣分", () => {
    const deltas = settleChapter1({ matchWrong: 1, quizWrong: 2, sortWrong: 0, progressReward: 15 })
    expect(deltas.find((d) => d.key === "dataAccuracy")?.delta).toBe(-6)
    expect(deltas.find((d) => d.key === "workerMorale")?.delta).toBe(-3)
  })
})

describe("settleByContent 内容驱动结算（第二章起）", () => {
  const cfg = {
    progressReward: 15,
    progressReason: "完成主数据清洗",
    wrongPenalties: [
      { key: "dataAccuracy", perWrong: -3, reason: "看走眼 {n} 处", perfectReason: "一处没看走眼" },
      { key: "workerMorale", perWrong: -1, reason: "误判 {n} 处", perfectReason: "一行好账都没冤枉" },
    ],
  }

  it("错 4 处：按内容配置扣分，{n} 占位符被替换", () => {
    const deltas = settleByContent(cfg, 4)
    expect(deltas.find((d) => d.key === "projectProgress")?.delta).toBe(15)
    expect(deltas.find((d) => d.key === "dataAccuracy")?.delta).toBe(-12)
    expect(deltas.find((d) => d.key === "workerMorale")?.delta).toBe(-4)
    expect(deltas.find((d) => d.key === "dataAccuracy")?.reason).toBe("看走眼 4 处")
  })

  it("全对：penalty 项记 0 并给 perfectReason", () => {
    const deltas = settleByContent(cfg, 0)
    const acc = deltas.find((d) => d.key === "dataAccuracy")!
    expect(acc.delta).toBe(0)
    expect(acc.reason).toBe("一处没看走眼")
  })

  it("缺 progressReason 时用默认文案", () => {
    const deltas = settleByContent({ progressReward: 10 }, 0)
    expect(deltas[0].reason.length).toBeGreaterThan(0)
    expect(deltas).toHaveLength(1)
  })
})

describe("computeChapterScore 章节总评分", () => {
  const full = { matchTotal: 16, quizTotal: 5, sortTotal: 7 } // 共 28 个判定点

  it("全对 = 100 分 S 级", () => {
    const r = computeChapterScore({ ...full, matchWrong: 0, quizWrong: 0, sortWrong: 0 })
    expect(r.score).toBe(100)
    expect(r.rank).toBe("S")
    expect(r.correct).toBe(28)
    expect(r.total).toBe(28)
  })

  it("错 2 = 93 分 A 级（四舍五入）", () => {
    const r = computeChapterScore({ ...full, matchWrong: 1, quizWrong: 1, sortWrong: 0 })
    expect(r.score).toBe(93)
    expect(r.rank).toBe("A")
  })

  it("错 5 = 82 分 B 级", () => {
    const r = computeChapterScore({ ...full, matchWrong: 2, quizWrong: 2, sortWrong: 1 })
    expect(r.score).toBe(82)
    expect(r.rank).toBe("B")
  })

  it("错 15 = 46 分 C 级", () => {
    const r = computeChapterScore({ ...full, matchWrong: 8, quizWrong: 4, sortWrong: 3 })
    expect(r.score).toBe(46)
    expect(r.rank).toBe("C")
  })

  it("档位边界：95 → S，94 → A，85 → A，84 → B，70 → B，69 → C", () => {
    // 用 total=100 的假想关精确打边界
    const t100 = { matchTotal: 100, quizTotal: 0, sortTotal: 0 }
    expect(computeChapterScore({ ...t100, matchWrong: 5, quizWrong: 0, sortWrong: 0 }).rank).toBe("S")
    expect(computeChapterScore({ ...t100, matchWrong: 6, quizWrong: 0, sortWrong: 0 }).rank).toBe("A")
    expect(computeChapterScore({ ...t100, matchWrong: 15, quizWrong: 0, sortWrong: 0 }).rank).toBe("A")
    expect(computeChapterScore({ ...t100, matchWrong: 16, quizWrong: 0, sortWrong: 0 }).rank).toBe("B")
    expect(computeChapterScore({ ...t100, matchWrong: 30, quizWrong: 0, sortWrong: 0 }).rank).toBe("B")
    expect(computeChapterScore({ ...t100, matchWrong: 31, quizWrong: 0, sortWrong: 0 }).rank).toBe("C")
  })

  it("空关卡（total=0）不除零，返回 0 分 C", () => {
    const r = computeChapterScore({ matchTotal: 0, matchWrong: 0, quizTotal: 0, quizWrong: 0, sortTotal: 0, sortWrong: 0 })
    expect(r.score).toBe(0)
    expect(r.rank).toBe("C")
  })
})
