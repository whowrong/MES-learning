// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { CHAPTERS, buildDefaultProgress } from "@/content/chapters"
import { ChapterMap } from "../ChapterMap"

afterEach(() => cleanup())

describe("ChapterMap chapter availability", () => {
  it("keeps chapter five locked in a new save and shows it enterable after chapter four clears", () => {
    const chapter5 = CHAPTERS.find((chapter) => chapter.id === 5)!
    const onOpen = vi.fn()
    const { rerender } = render(
      <ChapterMap chapters={[chapter5]} chapterState={buildDefaultProgress().chapter_status} onOpen={onOpen} />,
    )

    expect(screen.getByText("质量与库存")).toBeTruthy()
    expect(screen.getByText("施工中")).toBeTruthy()
    expect(screen.queryByText("可进入")).toBeNull()

    rerender(<ChapterMap chapters={[chapter5]} chapterState={{ "5": "open" }} onOpen={onOpen} />)
    expect(screen.getByText("可进入")).toBeTruthy()
    expect(screen.queryByText("施工中")).toBeNull()
  })

  it("opens the chapter when selected, leaving navigation control to the caller", () => {
    const chapter5 = CHAPTERS.find((chapter) => chapter.id === 5)!
    const onOpen = vi.fn()
    render(<ChapterMap chapters={[chapter5]} chapterState={{ "5": "open" }} onOpen={onOpen} />)
    fireEvent.click(screen.getAllByRole("button", { name: /质量与库存/ })[0])
    expect(onOpen).toHaveBeenCalledWith(chapter5)
  })
})
