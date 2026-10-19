// 厂型内容红线扫描：public/content/factory-types/ 全部文件自动把关
// （新增厂型文件会被 import.meta.glob 自动发现，不用改本测试）
import { describe, expect, it } from "vitest"
import { FACTORY_TYPE_ORDER, validateFactoryBank, type FactoryBank } from "@/content/factoryTypes"
import indexJson from "../../../public/content/factory-types/index.json"
import termsJson from "../../../public/content/terms.json"

const bankFiles = import.meta.glob("../../../public/content/factory-types/*.json", { eager: true })

interface BankModule {
  default: unknown
}

const banks: FactoryBank[] = Object.entries(bankFiles)
  .filter(([path]) => !path.endsWith("index.json"))
  .map(([, mod]) => (mod as BankModule).default as unknown as FactoryBank)

const allTermIds = new Set((termsJson as { terms: Array<{ id: string }> }).terms.map((t) => t.id))

describe("厂型内容结构校验", () => {
  it("清单里登记的每个厂型文件都存在且 type 一致", () => {
    const index = indexJson as { types: Array<{ type: string; file: string }> }
    expect(index.types.length).toBeGreaterThan(0)
    for (const entry of index.types) {
      const bank = banks.find((b) => b.type === entry.type)
      expect(bank, `清单登记的 ${entry.file}（type=${entry.type}）没找到对应内容`).toBeTruthy()
    }
  })

  it("每个厂型通过 validateFactoryBank（档案/题库/perRound/三句话讲解/answer 在选项里）", () => {
    expect(banks.length).toBeGreaterThanOrEqual(3)
    for (const bank of banks) {
      expect(() => validateFactoryBank(bank), `厂型 ${bank.type} 校验失败`).not.toThrow()
    }
  })

  it("厂型 type 全部在三档表内且不重复、三档齐全", () => {
    const types = banks.map((b) => b.type)
    expect(new Set(types).size).toBe(types.length)
    for (const t of types) expect(FACTORY_TYPE_ORDER).toContain(t)
    for (const t of FACTORY_TYPE_ORDER) expect(types, `缺少厂型 ${t}`).toContain(t)
  })

  it("选卡信息齐全：typeName/tagline/industries 非空，档案至少 3 屏", () => {
    for (const bank of banks) {
      expect(bank.typeName, `${bank.type} 缺 typeName`).toBeTruthy()
      expect(bank.tagline, `${bank.type} 缺 tagline`).toBeTruthy()
      expect(bank.industries.length, `${bank.type} 缺典型行业`).toBeGreaterThan(0)
      expect(bank.brief.length, `${bank.type} 档案页太少`).toBeGreaterThanOrEqual(3)
    }
  })

  it("必须有「典型踩坑」档案屏，且每个案例 scene/consequence/lesson 齐全", () => {
    for (const bank of banks) {
      const pitfalls = bank.brief.find((p) => Array.isArray(p.cases) && p.cases.length > 0)
      expect(pitfalls, `${bank.type} 缺典型踩坑案例`).toBeTruthy()
      for (const c of pitfalls?.cases ?? []) {
        expect(c.scene, `${bank.type}/${c.id} 缺场景`).toBeTruthy()
        expect(c.consequence, `${bank.type}/${c.id} 缺后果`).toBeTruthy()
        expect(c.lesson, `${bank.type}/${c.id} 缺教训`).toBeTruthy()
        for (const tid of c.term_ids) expect(allTermIds.has(tid), `${bank.type}/${c.id} 引用了不存在的术语 ${tid}`).toBe(true)
      }
    }
  })

  it("题目 id 全库唯一，题干不重复（防三厂型换皮）", () => {
    const ids = banks.flatMap((b) => b.quiz.questions.map((q) => q.id))
    expect(new Set(ids).size, "存在重复题目 id").toBe(ids.length)
    const prompts = banks.flatMap((b) => b.quiz.questions.map((q) => q.prompt))
    expect(new Set(prompts).size, "存在重复题干").toBe(prompts.length)
  })

  it("红线：三句话讲解（factory/data/consultant）逐题齐全且非套话（≥10 字）", () => {
    for (const bank of banks) {
      for (const q of bank.quiz.questions) {
        expect(q.feedback.factory.length, `${q.id} factory 讲解太短`).toBeGreaterThanOrEqual(10)
        expect(q.feedback.data.length, `${q.id} data 讲解太短`).toBeGreaterThanOrEqual(10)
        expect(q.feedback.consultant.length, `${q.id} consultant 讲解太短`).toBeGreaterThanOrEqual(10)
      }
    }
  })

  it("红线：term_ids 必须指向真实存在的术语卡", () => {
    for (const bank of banks) {
      for (const q of bank.quiz.questions) {
        for (const tid of q.term_ids) {
          expect(allTermIds.has(tid), `${q.id} 引用了不存在的术语 ${tid}`).toBe(true)
        }
      }
    }
  })

  it("每档题库 ≥6 题且 perRound 不超过题库量", () => {
    for (const bank of banks) {
      expect(bank.quiz.questions.length, `${bank.type} 题库太少`).toBeGreaterThanOrEqual(6)
      expect(bank.quiz.perRound).toBeLessThanOrEqual(bank.quiz.questions.length)
      expect(bank.quiz.perRound).toBeGreaterThanOrEqual(1)
    }
  })

  it("清单 rankTexts 四档评语齐全", () => {
    const index = indexJson as { rankTexts: Record<string, string> }
    for (const rank of ["S", "A", "B", "C"]) {
      expect(index.rankTexts[rank], `缺 ${rank} 档评语`).toBeTruthy()
    }
  })
})
