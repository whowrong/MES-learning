// 内容质量红线测试（跑在真实内容文件上，加新题自动把关）：
// 1. 题干不得出现答案术语的字样（漏答案）
// 2. 每题必须有完整三句话讲解
// 3. match 的 answer 必须在 concepts 里、quiz/fill 的 answer 必须在 options 里
// 4. term_ids / story 标注引用的术语必须在术语库里存在
// 关卡文件用 import.meta.glob 自动发现：以后加 chN.json 无需改本测试。
import { describe, expect, it } from "vitest"
import termsRaw from "../../../public/content/terms.json"

const termText: Record<string, string> = {}
const termIds = new Set<string>()
for (const t of termsRaw.terms) {
  termText[t.id] = t.term
  termIds.add(t.id)
}

const levelModules = import.meta.glob("../../../public/content/levels/ch*.json", { eager: true })

interface AnyStage {
  id: string
  type: string
  concepts?: string[]
  quotes?: Array<{ id: string; text: string; answer: string; term_ids: string[]; feedback: Record<string, string> }>
  questions?: Array<{ id: string; prompt: string; options: Array<{ id: string; text: string }>; answer: string; term_ids: string[]; feedback: Record<string, string> }>
}

const levels = Object.entries(levelModules)
  .map(([file, mod]) => {
    const level = (mod as { default: { chapter: number; stages: AnyStage[]; story: string[] } }).default
    return { file, level }
  })
  .sort((a, b) => a.level.chapter - b.level.chapter)

describe("内容红线：题干不漏答案", () => {
  for (const { level } of levels) {
    for (const st of level.stages) {
      if (st.type === "match") {
        for (const q of st.quotes ?? []) {
          it(`ch${level.chapter} ${q.id} 题干不含答案术语字样`, () => {
            const answer = termText[q.answer]
            expect(answer, `${q.id} 的答案术语不在术语库`).toBeTruthy()
            expect(q.text.includes(answer), `${q.id} 题干漏答案「${answer}」: ${q.text}`).toBe(false)
          })
        }
      }
      if (st.type === "quiz" || st.type === "fill") {
        for (const q of st.questions ?? []) {
          it(`ch${level.chapter} ${st.type}:${q.id} 题干不含正确选项字样`, () => {
            const opt = q.options.find((o) => o.id === q.answer)
            expect(opt, `${q.id} 的 answer 不在 options 里`).toBeTruthy()
            const stem = q.prompt.replace(/____/g, "")
            expect(stem.includes(opt!.text), `${q.id} 题干漏答案「${opt!.text}」: ${q.prompt}`).toBe(false)
          })
        }
      }
    }
  }
})

describe("内容红线：结构完整性", () => {
  for (const { level } of levels) {
    it(`ch${level.chapter} story 标注的术语都存在`, () => {
      for (const p of level.story) {
        for (const m of p.matchAll(/\{\{(\w+)\}\}/g)) {
          expect(termIds.has(m[0].slice(2, -2)), `story 引用了不存在的术语 ${m[0]}`).toBe(true)
        }
      }
    })
    for (const st of level.stages) {
      const items = st.type === "match" ? st.quotes ?? [] : st.questions ?? []
      for (const q of items) {
        it(`ch${level.chapter} ${st.id}:${q.id} 三句话讲解齐全且 term_ids 有效`, () => {
          expect(q.feedback?.factory, `${q.id} 缺 factory 讲解`).toBeTruthy()
          expect(q.feedback?.data, `${q.id} 缺 data 讲解`).toBeTruthy()
          expect(q.feedback?.consultant, `${q.id} 缺 consultant 讲解`).toBeTruthy()
          for (const tid of q.term_ids ?? []) {
            expect(termIds.has(tid), `${q.id} 引用了不存在的术语 ${tid}`).toBe(true)
          }
        })
      }
      if (st.type === "match") {
        it(`ch${level.chapter} ${st.id} 所有 answer 都在 concepts 里`, () => {
          for (const q of st.quotes ?? []) {
            expect(st.concepts!.includes(q.answer), `${q.id} 的 answer ${q.answer} 不在 concepts`).toBe(true)
          }
          for (const c of st.concepts!) {
            expect(termIds.has(c), `概念 ${c} 不在术语库`).toBe(true)
          }
        })
      }
    }
  }
})
