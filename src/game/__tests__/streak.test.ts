import { describe, expect, it } from "vitest"
import { addStudyDay, computeStreak, todayStr } from "@/game/streak"

const BASE = new Date(2026, 9, 17, 10, 0, 0).getTime() // 2026-10-17 10:00 本地

describe("todayStr / addStudyDay 打卡", () => {
  it("todayStr 返回本地 YYYY-MM-DD", () => {
    expect(todayStr(BASE)).toBe("2026-10-17")
  })

  it("重复打卡同一天不重复记录", () => {
    const once = addStudyDay([], BASE)
    expect(once).toEqual(["2026-10-17"])
    const twice = addStudyDay(once, BASE + 3 * 60 * 60 * 1000)
    expect(twice).toEqual(["2026-10-17"])
  })

  it("隔天打卡追加新日期", () => {
    const days = addStudyDay(["2026-10-16"], BASE)
    expect(days).toEqual(["2026-10-16", "2026-10-17"])
  })
})

describe("computeStreak 连续学习天数", () => {
  it("今天打了：连着昨天前天 = 3", () => {
    const days = ["2026-10-15", "2026-10-16", "2026-10-17"]
    expect(computeStreak(days, BASE)).toBe(3)
  })

  it("今天还没打、昨天打了：streak 不断，接着数", () => {
    const days = ["2026-10-15", "2026-10-16"]
    expect(computeStreak(days, BASE)).toBe(2)
  })

  it("今天昨天都没打：断了，归 0", () => {
    const days = ["2026-10-10", "2026-10-14"]
    expect(computeStreak(days, BASE)).toBe(0)
  })

  it("中间断一天只数最近一段", () => {
    const days = ["2026-10-13", "2026-10-14", "2026-10-16", "2026-10-17"]
    expect(computeStreak(days, BASE)).toBe(2)
  })

  it("空记录 = 0；只打了今天 = 1", () => {
    expect(computeStreak([], BASE)).toBe(0)
    expect(computeStreak(["2026-10-17"], BASE)).toBe(1)
  })
})
