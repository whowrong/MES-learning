import { describe, expect, it } from "vitest"
import { SRS_STEPS_MS, dueTerms, masteryLabel, rateTerm, type ReviewState } from "@/game/srs"

const NOW = 1_700_000_000_000
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe("rateTerm 间隔重复调度", () => {
  it("新卡评「记住了」：level 1，一天后复习", () => {
    const s = rateTerm(undefined, "good", NOW)
    expect(s.level).toBe(1)
    expect(s.dueAt).toBe(NOW + DAY)
    expect(s.lastRatedAt).toBe(NOW)
  })

  it("新卡评「秒答」：跳两档，三天后复习", () => {
    const s = rateTerm(undefined, "easy", NOW)
    expect(s.level).toBe(2)
    expect(s.dueAt).toBe(NOW + 3 * DAY)
  })

  it("评「忘了」：level 归零，10 分钟后重来", () => {
    const prev: ReviewState = { level: 4, dueAt: NOW - 1, lastRatedAt: NOW - DAY }
    const s = rateTerm(prev, "again", NOW)
    expect(s.level).toBe(0)
    expect(s.dueAt).toBe(NOW + 10 * MIN)
  })

  it("评「有点印象」：level 不变，4 小时后再见", () => {
    const prev: ReviewState = { level: 3, dueAt: NOW - 1, lastRatedAt: 0 }
    const s = rateTerm(prev, "hard", NOW)
    expect(s.level).toBe(3)
    expect(s.dueAt).toBe(NOW + 4 * HOUR)
  })

  it("连续「记住了」间隔递增 1→3→7→16→35 天，level 封顶 5", () => {
    let s = rateTerm(undefined, "good", NOW)
    const dues = [s.dueAt - NOW]
    for (let i = 0; i < 6; i++) {
      s = rateTerm(s, "good", s.dueAt)
      dues.push(s.dueAt - s.lastRatedAt)
    }
    expect(dues.slice(0, 5)).toEqual(SRS_STEPS_MS)
    expect(s.level).toBe(5)
    // 封顶后保持 35 天
    expect(s.dueAt - s.lastRatedAt).toBe(35 * DAY)
  })

  it("高档位「秒答」也不会越界", () => {
    const prev: ReviewState = { level: 4, dueAt: NOW - 1, lastRatedAt: 0 }
    const s = rateTerm(prev, "easy", NOW)
    expect(s.level).toBe(5)
    expect(s.dueAt).toBe(NOW + 35 * DAY)
  })
})

describe("dueTerms 复习队列", () => {
  it("标记不熟但没评过级的卡排最前，到期卡按 dueAt 升序，未到期不进队", () => {
    const reviewState: Record<string, ReviewState> = {
      bom: { level: 2, dueAt: NOW - 2 * DAY, lastRatedAt: 0 }, // 到期，较早
      wip: { level: 1, dueAt: NOW - DAY, lastRatedAt: 0 }, // 到期，较晚
      work_order: { level: 3, dueAt: NOW + DAY, lastRatedAt: 0 }, // 未到期
    }
    const queue = dueTerms(reviewState, ["backflush", "bom"], NOW)
    expect(queue).toEqual(["backflush", "bom", "wip"])
  })

  it("空队列返回空", () => {
    expect(dueTerms({}, [], NOW)).toEqual([])
  })
})

describe("masteryLabel 掌握度分档", () => {
  it("0 不熟 / 1-2 模糊 / 3-4 熟悉 / 5 已掌握", () => {
    expect(masteryLabel(0).label).toBe("不熟")
    expect(masteryLabel(1).label).toBe("模糊")
    expect(masteryLabel(2).tone).toBe("mid")
    expect(masteryLabel(3).label).toBe("熟悉")
    expect(masteryLabel(5).label).toBe("已掌握")
  })
})
