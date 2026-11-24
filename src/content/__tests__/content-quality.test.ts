// 内容质量红线测试（跑在真实内容文件上，加新题自动把关）：
// 1. 题干不得出现答案术语的字样（漏答案）
// 2. 每题必须有完整三句话讲解
// 3. match 的 answer 必须在 concepts 里、quiz/fill 的 answer 必须在 options 里
// 4. term_ids / story 标注引用的术语必须在术语库里存在
// 关卡文件用 import.meta.glob 自动发现：以后加 chN.json 无需改本测试。
import { describe, expect, it } from "vitest"
import termsRaw from "../../../public/content/terms.json"
import deliveryRaw from "../../../public/content/delivery/index.json"
import factoryFlowRaw from "../../../public/content/factory-types/flow.json"
import careerDirection1Raw from "../../../public/content/career-prep/direction1.json"
import opsLinuxRaw from "../../../public/content/ops-training/linux.json"
import opsIntegrationRaw from "../../../public/content/ops-training/integration.json"
import opsCloudRaw from "../../../public/content/ops-training/cloud.json"
import opsWindowsRaw from "../../../public/content/ops-training/windows.json"

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

describe("ch4 工单与报工边界练习", () => {
  const chapter4 = levels.find(({ level }) => level.chapter === 4)?.level
  const question = chapter4?.stages.find((stage) => stage.id === "quiz")?.questions?.find((item) => item.id === "z12")

  it("用计划量与班次实绩区分工单、报工，并保留未解释差额", () => {
    expect(question).toBeTruthy()
    expect(question!.prompt).toContain("目标 100 件")
    expect(question!.prompt).toContain("合格 80 件、报废 5 件")
    const correct = question!.options.find((option) => option.id === question!.answer)
    expect(correct?.text).toContain("工单记录计划任务及目标量")
    expect(correct?.text).toContain("报工记录实际执行结果")
    expect(correct?.text).toContain("余下 15 件的去向还要核对")
  })
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

describe("ch5 四条易混淆的库存与质量概念", () => {
  const chapter5 = levels.find(({ level }) => level.chapter === 5)?.level
  const match = chapter5?.stages.find((stage) => stage.id === "match")
  const quote = (id: string) => match?.quotes?.find((item) => item.id === id)

  it("隔离待判定物料归到批次追溯，不等于报废", () => {
    const q = quote("q1")!
    expect(q.answer).toBe("lot_batch")
    expect(q.text).toContain("先贴红牌放进隔离区")
    expect(q.feedback.factory).toContain("不代表已经判定报废")
  })

  it("未确认的调拨是库存业务记录问题，不把它说成准确率指标", () => {
    const q = quote("q12")!
    expect(q.answer).toBe("inventory")
    expect(q.text).toContain("上周调拨已搬货、单据却还没确认")
    expect(q.feedback.data).toContain("库存准确率是衡量账实相符程度的指标")
  })

  it("把倒冲扣料机制和报工数据错误分开", () => {
    const q = quote("q14")!
    expect(q.answer).toBe("backflush")
    expect(q.text).toContain("产量填成500，现场实际只有50")
    expect(q.feedback.data).toContain("错误报工是数据问题，倒冲扣料是放大影响的扣料机制")
  })

  it("同日同供应商的两车按批次分别挂接检验状态", () => {
    const q = quote("q15")!
    expect(q.answer).toBe("lot_batch")
    expect(q.text).toContain("一车检验合格、一车待复检")
    expect(q.feedback.data).toContain("库存是更广的数量和库位余额")
  })
})


describe("跨题库概念边界与判断题选项", () => {
  const chapter1 = levels.find(({ level }) => level.chapter === 1)?.level
  const chapter5 = levels.find(({ level }) => level.chapter === 5)?.level

  it("把库存余额与账实相符指标区分开", () => {
    const match1 = chapter1?.stages.find((stage) => stage.id === "match")
    for (const id of ["q6", "q35"]) {
      expect(match1?.quotes?.find((item) => item.id === id)?.answer).toBe("inventory_accuracy")
    }
    const match5 = chapter5?.stages.find((stage) => stage.id === "match")
    expect(match5?.quotes?.find((item) => item.id === "q12")?.answer).toBe("inventory")
    expect(match5?.quotes?.find((item) => item.id === "q3")?.answer).toBe("inventory_accuracy")
  })

  it("交付题判断题的对错选项明确相反", () => {
    for (const question of deliveryRaw.questions.filter((item) => item.type === "judge")) {
      const trueOption = question.options.find((option) => option.text.startsWith("对"))
      const falseOption = question.options.find((option) => option.text.startsWith("错"))
      expect(trueOption, `${question.id} 缺少肯定选项`).toBeTruthy()
      expect(falseOption, `${question.id} 缺少否定选项`).toBeTruthy()
      expect(trueOption!.text).toContain("成立")
      expect(falseOption!.text).toContain("不成立")
      expect(question.answer).toBeTruthy()
    }
  })

  it("流水线题把需求节拍与工位周期、整线产出区分开", () => {
    const question = factoryFlowRaw.quiz.questions.find((item) => item.id === "f-q1")!
    const answer = question.options.find((option) => option.id === question.answer)
    expect(question.prompt).toContain("需求节拍")
    expect(answer?.text).toContain("可用生产时间")
    expect(answer?.text).toContain("不等于整线实际产出")
  })

  it("MES/ERP 题不把产量记录能力说成互斥", () => {
    const question = careerDirection1Raw.questions.find((item) => item.id === "d1q1")!
    const answer = question.options.find((option) => option.id === question.answer)
    expect(question.prompt).toContain("按工单、工序追踪实时执行")
    expect(answer?.text).toContain("ERP 可以接收汇总产量")
    expect(answer?.text).toContain("由 MES 记录")
  })
})


describe("运维选择题逐题结构与关键边界", () => {
  interface ChoiceQuestion {
    id: string
    prompt: string
    options: Array<{ id: string; text: string }>
    answer: string
    feedback: Record<string, string>
  }
  interface ChoiceQuiz {
    id: string
    kind: string
    questions: ChoiceQuestion[]
  }
  const opsDomains = [opsLinuxRaw, opsIntegrationRaw, opsCloudRaw, opsWindowsRaw] as unknown as Array<{ items: ChoiceQuiz[] }>
  const quizzes: ChoiceQuiz[] = opsDomains.flatMap((domain) => domain.items.filter((item) => item.kind === "choice"))

  it("每个选择题题组均为八题且答案都对应一个选项", () => {
    expect(quizzes).toHaveLength(4)
    for (const quiz of quizzes) {
      expect(quiz.questions).toHaveLength(8)
      for (const question of quiz.questions) {
        expect(question.options.some((option) => option.id === question.answer), question.id).toBe(true)
        expect(new Set(question.options.map((option) => option.id)).size, question.id).toBe(question.options.length)
      }
    }
  })

  it("Linux 区分 ICMP 可达与 TCP 端口可达，并限定一致性备份前提", () => {
    const linuxQuestions = quizzes.find((quiz) => quiz.id === "lx-c1")!.questions
    const port = linuxQuestions.find((question) => question.id === "lx-c1-q5")!
    expect(port.prompt).toContain("TCP 8080")
    expect(port.feedback.factory).toContain("ping 只说明 ICMP 可达")
    const backup = linuxQuestions.find((question) => question.id === "lx-c1-q7")!
    expect(backup.prompt).toContain("InnoDB")
    expect(backup.prompt).toContain("没有并发 DDL")
  })

  it("Windows 计划任务错误码不被误当成凭据过期的证据", () => {
    const question = quizzes.find((quiz) => quiz.id === "win-c1")!.questions.find((item) => item.id === "win-c1-q2")!
    expect(question.answer).toBe("o1")
    expect(question.options.find((option) => option.id === question.answer)?.text).toContain("通用非零退出码")
    expect(question.options.find((option) => option.id === "o4")?.text).toContain("直接判定")
  })

  it("云上隧道方案不要求不存在的固定公网地址", () => {
    const question = quizzes.find((quiz) => quiz.id === "cloud-c1")!.questions.find((item) => item.id === "cloud-c1-q4")!
    expect(question.prompt).toContain("没有固定公网 IP")
    expect(question.options.find((option) => option.id === question.answer)?.text).toContain("隧道来源")
    expect(question.options.find((option) => option.id === question.answer)?.text).not.toContain("固定出口 IP")
  })

  it("备份复制示例避免镜像删除 NAS 上的历史文件", () => {
    const question = quizzes.find((quiz) => quiz.id === "win-c1")!.questions.find((item) => item.id === "win-c1-q7")!
    const answer = question.options.find((option) => option.id === question.answer)?.text ?? ""
    expect(answer).toContain("robocopy /E")
    expect(answer).not.toContain("robocopy /MIR")
    expect(question.feedback.data).toContain("robocopy /MIR 会镜像删除")
  })
})
