// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { CHAPTERS } from "@/content/chapters"
import { ChapterMap } from "../ChapterMap"

describe("ChapterMap chapter availability", () => {
  it("does not label a non-playable chapter as enterable from stale saved progress", () => {
    render(
      <ChapterMap
        chapters={CHAPTERS.filter((chapter) => chapter.id === 5 || chapter.id === 6)}
        chapterState={{ "5": "open", "6": "open" }}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.getByText("质量与库存")).toBeTruthy()
    expect(screen.getByText("可进入")).toBeTruthy()
    expect(screen.getAllByText("施工中")).toHaveLength(1)
  })
})
