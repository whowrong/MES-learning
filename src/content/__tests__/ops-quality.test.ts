// 运维训练营内容红线扫描：import.meta.glob 自动发现所有域文件，加新域/新题自动把关。
// 红线：id 全局唯一、accept/ambient/danger 正则可编译、工单三要素齐全、
// 决策题 answer 在选项内且三句话讲解完整、排序步骤带错位讲解、term_ids 指向真实术语。
import { describe, expect, it } from "vitest"
import termsRaw from "../../../public/content/terms.json"
import indexRaw from "../../../public/content/ops-training/index.json"
import type { OpsChoiceGroup, OpsDomainBank, OpsOrderGroup, OpsTerminalDrill } from "../opsTraining"

const modules = import.meta.glob("../../../public/content/ops-training/*.json", { eager: true })

const termIds = new Set((termsRaw.terms as Array<{ id: string }>).map((t) => t.id))

function banks(): Array<{ file: string; bank: OpsDomainBank }> {
  const out: Array<{ file: string; bank: OpsDomainBank }> = []
  for (const [path, mod] of Object.entries(modules)) {
    // index.json 是清单、deploy-docs.json 是部署文档模板，都不是训练域文件
    if (path.endsWith("index.json") || path.endsWith("deploy-docs.json")) continue
    out.push({ file: path.split("/").pop()!, bank: mod as unknown as OpsDomainBank })
  }
  return out
}

describe("运维训练营清单 index.json", () => {
  it("四个训练域全部登记且文件真实存在", () => {
    const registered = indexRaw.domains.map((d) => d.domain).sort()
    expect(registered).toEqual(["cloud", "integration", "linux", "windows"])
    const files = new Set(banks().map((b) => b.file))
    for (const entry of indexRaw.domains) {
      expect(files.has(entry.file), `${entry.file} 未找到`).toBe(true)
    }
  })

  it("rankTexts 四档齐全且非空", () => {
    const rankTexts: Record<string, string> = indexRaw.rankTexts
    for (const rank of ["S", "A", "B", "C"]) {
      expect(rankTexts[rank], `rankTexts.${rank}`).toBeTruthy()
      expect(rankTexts[rank].length).toBeGreaterThanOrEqual(10)
    }
  })
})

describe("运维训练营内容红线", () => {
  const allItemIds = new Set<string>()
  const allQuestionIds = new Set<string>()

  for (const { file, bank } of banks()) {
    describe(`域文件 ${file}`, () => {
      it("域结构完整（domain/domainName/brief/items）", () => {
        expect(bank.domain).toBeTruthy()
        expect(bank.domainName).toBeTruthy()
        expect(bank.brief.length).toBeGreaterThanOrEqual(10)
        expect(bank.items.length).toBeGreaterThanOrEqual(3)
      })

      it("项目 id 全局唯一且三种形式都合规", () => {
        for (const item of bank.items) {
          expect(item.id, `${file} 有项目缺 id`).toBeTruthy()
          expect(allItemIds.has(item.id), `项目 id ${item.id} 重复`).toBe(false)
          allItemIds.add(item.id)
          expect(item.title.length).toBeGreaterThanOrEqual(4)
          expect(item.difficulty).toBeTruthy()
          expect(item.minutes).toBeGreaterThanOrEqual(1)

          if (item.kind === "terminal") {
            const drill = item as OpsTerminalDrill
            expect(drill.ticket.background.length).toBeGreaterThan(10)
            expect(drill.ticket.symptom.length).toBeGreaterThan(5)
            expect(drill.ticket.objective.length).toBeGreaterThan(5)
            expect(drill.prompt).toBeTruthy()
            expect(drill.steps.length).toBeGreaterThanOrEqual(2)
            expect(drill.sop.length).toBeGreaterThanOrEqual(drill.steps.length - 2)
            for (const s of drill.steps) {
              const at = `${drill.id}/${s.id}`
              expect(s.objective.length, at).toBeGreaterThan(4)
              expect(s.accept.length, at).toBeGreaterThan(0)
              for (const p of s.accept) expect(() => new RegExp(p, "i"), `${at} accept`).not.toThrow()
              expect(s.output.length, at).toBeGreaterThan(5)
              expect(s.hint.length, at).toBeGreaterThan(5)
              expect(s.explain.length, at).toBeGreaterThan(10)
            }
            for (const a of drill.ambient ?? []) {
              expect(() => new RegExp(a.pattern, "i"), `${drill.id} ambient`).not.toThrow()
              expect(a.output.length).toBeGreaterThan(1)
            }
            for (const d of drill.danger ?? []) {
              expect(() => new RegExp(d.pattern, "i"), `${drill.id} danger`).not.toThrow()
              expect(d.output.length, `${drill.id} danger 讲解`).toBeGreaterThan(20)
            }
          } else if (item.kind === "choice") {
            const group = item as OpsChoiceGroup
            expect(group.intro.length).toBeGreaterThan(10)
            expect(group.questions.length).toBeGreaterThanOrEqual(4)
            for (const q of group.questions) {
              const at = `${group.id}/${q.id}`
              expect(allQuestionIds.has(q.id), `题目 id ${q.id} 重复`).toBe(false)
              allQuestionIds.add(q.id)
              expect(q.prompt.length, at).toBeGreaterThan(10)
              expect(q.options.length, at).toBeGreaterThanOrEqual(2)
              expect(q.options.some((o) => o.id === q.answer), `${at} answer 不在选项内`).toBe(true)
              expect(q.feedback.factory.length, at).toBeGreaterThan(8)
              expect(q.feedback.data.length, at).toBeGreaterThan(8)
              expect(q.feedback.consultant.length, at).toBeGreaterThan(8)
              for (const t of q.term_ids ?? []) {
                expect(termIds.has(t), `${at} 引用了不存在的术语 ${t}`).toBe(true)
              }
            }
          } else if (item.kind === "order") {
            const group = item as OpsOrderGroup
            expect(group.intro.length).toBeGreaterThan(10)
            expect(group.steps.length).toBeGreaterThanOrEqual(3)
            expect(group.maxAttempts).toBeGreaterThanOrEqual(1)
            const stepIds = new Set<string>()
            for (const s of group.steps) {
              expect(stepIds.has(s.id), `${group.id} 步骤 id ${s.id} 重复`).toBe(false)
              stepIds.add(s.id)
              expect(s.text.length, `${group.id}/${s.id}`).toBeGreaterThan(5)
              expect(s.note.length, `${group.id}/${s.id} 缺错位讲解`).toBeGreaterThan(8)
            }
          } else {
            throw new Error(`${file} 项目 ${(item as { id: string }).id} 的 kind 非法`)
          }
        }
      })
    })
  }

  it("四个域都有终端演练（核心玩法不缺位）", () => {
    for (const { bank } of banks()) {
      expect(bank.items.some((i) => i.kind === "terminal"), `${bank.domain} 缺终端演练`).toBe(true)
    }
  })
})
