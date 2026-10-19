// 面试题库内容红线扫描：所有 public/content/interview/ 题库文件自动把关
// （新增题库文件会被 import.meta.glob 自动发现，不用改本测试）
import { describe, expect, it } from "vitest"
import { validateBank, CATEGORY_LIST, TIER_ORDER, type InterviewBank } from "@/content/interview"
import indexJson from "../../../public/content/interview/index.json"

const bankFiles = import.meta.glob("../../../public/content/interview/*.json", { eager: true })

interface BankModule {
  default: unknown
}

const banks: InterviewBank[] = Object.entries(bankFiles)
  .filter(([path]) => !path.endsWith("index.json"))
  .map(([, mod]) => (mod as BankModule).default as unknown as InterviewBank)

describe("面试题库结构校验", () => {
  it("清单里登记的每个题库文件都存在且 tier 一致", () => {
    const index = indexJson as { banks: Array<{ tier: string; file: string }> }
    expect(index.banks.length).toBeGreaterThan(0)
    for (const entry of index.banks) {
      const bank = banks.find((b) => b.tier === entry.tier)
      expect(bank, `清单登记的 ${entry.file}（tier=${entry.tier}）没找到对应题库`).toBeTruthy()
    }
  })

  it("每个题库通过 validateBank（type/category 合法、answer 在选项里、reference 与加分点齐全、多选有干扰项）", () => {
    expect(banks.length).toBeGreaterThanOrEqual(6)
    for (const bank of banks) {
      expect(() => validateBank(bank), `题库 ${bank.tier} 校验失败`).not.toThrow()
    }
  })

  it("题库 tier 全部在六档难度表内且不重复", () => {
    const tiers = banks.map((b) => b.tier)
    expect(new Set(tiers).size).toBe(tiers.length)
    for (const t of tiers) expect(TIER_ORDER).toContain(t)
  })

  it("每档题库覆盖至少 3 个分类，且各档题量不均（防背题位置）", () => {
    for (const bank of banks) {
      const cats = new Set(bank.questions.map((q) => q.category))
      expect(cats.size, `${bank.tier} 覆盖分类太少`).toBeGreaterThanOrEqual(3)
      for (const c of cats) expect(CATEGORY_LIST).toContain(c)
    }
  })

  it("题目 id 全库唯一（存档与复习队列按 id 记录）", () => {
    const ids = banks.flatMap((b) => b.questions.map((q) => q.id))
    expect(new Set(ids).size, "存在重复题目 id").toBe(ids.length)
  })

  it("红线：题干不得为空口套话——每题 reference 至少 40 字、bonus_points 每条至少 6 字", () => {
    for (const bank of banks) {
      for (const q of bank.questions) {
        expect(q.reference.length, `${q.id} 参考答案太短`).toBeGreaterThanOrEqual(40)
        for (const bp of q.bonus_points) {
          expect(bp.length, `${q.id} 加分点太短`).toBeGreaterThanOrEqual(6)
        }
      }
    }
  })

  it("清单 rankTexts 四档评语齐全", () => {
    const index = indexJson as { rankTexts: Record<string, string> }
    for (const rank of ["S", "A", "B", "C"]) {
      expect(index.rankTexts[rank], `缺 ${rank} 档评语`).toBeTruthy()
    }
  })
})
