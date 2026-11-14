// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { StoryIntro } from "../StoryIntro"
import type { LevelDef, TermDef } from "@/content/loader"

afterEach(cleanup)

describe("第五章记忆图布局", () => {
  it("显示三张不依赖横向挤压的记忆图，并让卡片在窄屏可收缩", () => {
    const terms = Object.fromEntries(
      [
        ["inventory", "inventory_count", "库存"],
        ["lot_batch", "batch_trace", "批次追溯"],
        ["rework", "rework_loop", "返工"],
      ].map(([id, illustration, term]) => [
        id,
        { id, illustration, term, dialect: "", definition: "", example: "", knowledge_id: "" } satisfies TermDef,
      ]),
    ) as Record<string, TermDef>
    const level = { chapter: 5, title: "质量与库存", story: ["测试剧情"], stages: [] } as unknown as LevelDef

    const { container } = render(
      <StoryIntro
        level={level}
        terms={terms}
        storyIdx={0}
        storyTotal={1}
        onNext={() => undefined}
        onOpenTerm={() => undefined}
      />,
    )

    expect(screen.getByRole("img", { name: /库存账实对照/ })).toBeTruthy()
    expect(screen.getByRole("img", { name: /批次追溯链/ })).toBeTruthy()
    expect(screen.getByRole("img", { name: /返工回环/ })).toBeTruthy()
    expect(container.querySelector(".sm\\:grid-cols-2.xl\\:grid-cols-3")).toBeTruthy()
    expect(container.querySelectorAll("article.min-w-0.overflow-hidden")).toHaveLength(3)
  })
})
