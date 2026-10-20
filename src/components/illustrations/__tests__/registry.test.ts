// 讲解图注册表一致性：terms.json 里每个 illustration 都必须能在 ILLUSTRATIONS 注册表找到，
// 防止加图忘注册或写错 id 导致术语卡弹窗静默缺图。
import { describe, expect, it } from "vitest"
import termsRaw from "../../../../public/content/terms.json"
import { ILLUSTRATIONS } from "../index"

describe("讲解图注册表", () => {
  it("注册表非空且每项都是组件", () => {
    const keys = Object.keys(ILLUSTRATIONS)
    expect(keys.length).toBeGreaterThanOrEqual(10)
    for (const k of keys) {
      expect(typeof ILLUSTRATIONS[k]).toBe("function")
    }
  })

  for (const t of termsRaw.terms) {
    const term = t as { id: string; illustration?: string }
    if (term.illustration) {
      it(`术语 ${term.id} 的讲解图 ${term.illustration} 已注册`, () => {
        expect(ILLUSTRATIONS[term.illustration!], `${term.id} 引用了未注册的讲解图`).toBeTruthy()
      })
    }
  }
})
