// 上线陪产 · 交付闭环 内容红线扫描：public/content/delivery/index.json
import { describe, expect, it } from "vitest"
import termsRaw from "../../../public/content/terms.json"
import deliveryRaw from "../../../public/content/delivery/index.json"
import careerIndexRaw from "../../../public/content/career-prep/index.json"

const careerFiles = import.meta.glob("../../../public/content/career-prep/*.json", { eager: true })
import { validateDeliveryModule, type DeliveryModule } from "@/content/delivery"

const mod = deliveryRaw as DeliveryModule
const terms = termsRaw.terms as Array<{ id: string; knowledge_id?: string }>
const termIds = new Set(terms.map((t) => t.id))
const knowledgeIds = new Set(terms.map((t) => t.knowledge_id).filter(Boolean) as string[])

describe("交付闭环内容结构", () => {
  it("通过 validateDeliveryModule 校验", () => {
    expect(() => validateDeliveryModule(mod)).not.toThrow()
  })

  it("模块 id 与站内路由约定一致", () => {
    expect(mod.moduleId).toBe("delivery")
    expect(mod.moduleName.length).toBeGreaterThan(0)
    expect(mod.subtitle.length).toBeGreaterThan(0)
    expect(mod.intro.length).toBeGreaterThan(20)
  })

  it("讲解卡数量在 6~10 张，每张要点不少于 4 条、坑不少于 2 条", () => {
    expect(mod.cards.length).toBeGreaterThanOrEqual(6)
    expect(mod.cards.length).toBeLessThanOrEqual(10)
    for (const c of mod.cards) {
      expect(c.points.length, `卡片 ${c.id} 要点太少`).toBeGreaterThanOrEqual(4)
      expect(c.pitfalls.length, `卡片 ${c.id} 缺常见坑`).toBeGreaterThanOrEqual(2)
    }
  })

  it("判分题 12 道，题型配比齐全", () => {
    expect(mod.questions.length).toBe(12)
    const singles = mod.questions.filter((q) => q.type === "single")
    const multiples = mod.questions.filter((q) => q.type === "multiple")
    const judges = mod.questions.filter((q) => q.type === "judge")
    expect(singles.length).toBeGreaterThanOrEqual(5)
    expect(multiples.length).toBeGreaterThanOrEqual(4)
    expect(judges.length).toBeGreaterThanOrEqual(2)
  })

  it("每道题有参考答案、至少一条加分点、选项不少于 2 个", () => {
    for (const q of mod.questions) {
      expect(q.reference.length, `题 ${q.id} 参考答案太短`).toBeGreaterThanOrEqual(40)
      expect(q.bonus_points.length, `题 ${q.id} 缺加分点`).toBeGreaterThanOrEqual(1)
      expect(q.options.length, `题 ${q.id} 选项不足`).toBeGreaterThanOrEqual(2)
      expect(q.prompt.length).toBeGreaterThanOrEqual(10)
    }
  })

  it("多选题的正确答案恰好两个且都在选项里", () => {
    for (const q of mod.questions.filter((x) => x.type === "multiple")) {
      expect(Array.isArray(q.answer), `题 ${q.id} 多选答案不是数组`).toBe(true)
      const ans = q.answer as string[]
      expect(ans.length).toBe(2)
      for (const a of ans) {
        expect(q.options.some((o) => o.id === a), `题 ${q.id} 答案 ${a} 不在选项里`).toBe(true)
      }
    }
  })

  it("排序题至少两道，每道步骤不少于 6 步且带说明", () => {
    expect(mod.orders.length).toBeGreaterThanOrEqual(2)
    for (const o of mod.orders) {
      expect(o.steps.length, `排序题 ${o.id} 步骤太少`).toBeGreaterThanOrEqual(6)
      const ids = new Set(o.steps.map((s) => s.id))
      expect(ids.size).toBe(o.steps.length)
      for (const s of o.steps) {
        expect(s.text.length).toBeGreaterThanOrEqual(8)
        expect(s.note.length).toBeGreaterThanOrEqual(8)
      }
    }
  })

  it("id 全局唯一", () => {
    const ids = [
      ...mod.cards.map((c) => c.id),
      ...mod.questions.map((q) => q.id),
      ...mod.orders.map((o) => o.id),
      ...mod.workspace.deliverables.map((d) => d.id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("term_ids 全部是站内已有术语", () => {
    const used = [
      ...mod.cards.flatMap((c) => c.term_ids),
      ...mod.questions.flatMap((q) => q.term_ids),
      ...mod.workspace.deliverables.flatMap((d) => d.term_ids),
    ]
    for (const t of used) {
      expect(termIds.has(t), `术语 ${t} 不在 terms.json 里`).toBe(true)
    }
  })

  it("knowledge_ids 必须是站内已有的知识编号", () => {
    expect(mod.knowledge_ids.length).toBeGreaterThanOrEqual(4)
    for (const k of mod.knowledge_ids) {
      expect(knowledgeIds.has(k), `知识编号 ${k} 不在术语库里`).toBe(true)
    }
    for (const c of mod.cards) {
      for (const k of c.knowledge_ids) {
        expect(mod.knowledge_ids, `卡片 ${c.id} 用了未登记的知识编号 ${k}`).toContain(k)
      }
    }
  })

  it("交付物工作区覆盖四件交付物，规则完整", () => {
    const ids = mod.workspace.deliverables.map((d) => d.id)
    expect(ids).toEqual(["oper_manual", "requirement_survey", "acceptance", "training_ppt"])
    for (const d of mod.workspace.deliverables) {
      expect(d.required_elements.length, `交付物 ${d.id} 必备要素太少`).toBeGreaterThanOrEqual(4)
      expect(d.min_chars).toBeGreaterThanOrEqual(50)
      expect(d.template.length).toBeGreaterThanOrEqual(10)
      for (const el of d.required_elements) {
        expect(el.patterns.length, `要素 ${el.id} 缺匹配规则`).toBeGreaterThanOrEqual(1)
        expect(el.hint.length).toBeGreaterThanOrEqual(4)
        for (const p of el.patterns) {
          expect(() => new RegExp(p, "i"), `要素 ${el.id} 的规则不是合法正则`).not.toThrow()
        }
      }
    }
  })

  it("与实习准备营已有题目不重复（题干不撞车）", () => {
    const index = careerIndexRaw as { tracks: Array<{ file: string }> }
    const careerPrompts = new Set<string>()
    for (const [, mod2] of Object.entries(careerFiles)) {
      const raw = (mod2 as { default?: unknown }).default as { questions?: Array<{ prompt: string }> } | undefined
      for (const q of raw?.questions ?? []) careerPrompts.add(q.prompt)
    }
    expect(index.tracks.length).toBeGreaterThan(0)
    for (const q of mod.questions) {
      expect(careerPrompts.has(q.prompt), `题干与实习准备营重复：${q.prompt}`).toBe(false)
    }
  })
})
