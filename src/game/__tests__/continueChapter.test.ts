import { describe, expect, it } from "vitest"
import { CHAPTERS, buildDefaultProgress } from "@/content/chapters"
import { getContinueChapter } from "@/game/continueChapter"

describe("getContinueChapter", () => {
  it("新存档从第一章开始", () => {
    const progress = buildDefaultProgress()
    expect(getContinueChapter(CHAPTERS, progress.chapter_status)?.id).toBe(1)
  })

  it("通关后继续到下一章，而不是从已通关的第一章重来", () => {
    const state = { "1": "cleared" as const, "2": "open" as const }
    expect(getContinueChapter(CHAPTERS, state)?.id).toBe(2)
  })

  it("跳过已通关章节，找最早尚未通关的可玩章节", () => {
    const state = { "1": "cleared" as const, "2": "cleared" as const, "3": "open" as const }
    expect(getContinueChapter(CHAPTERS, state)?.id).toBe(3)
  })

  it("所有已开放玩法通关后回到最后一章", () => {
    const state = { "1": "cleared" as const, "2": "cleared" as const, "3": "cleared" as const, "4": "cleared" as const }
    expect(getContinueChapter(CHAPTERS, state)?.id).toBe(4)
  })
})
