// 交付闭环纯逻辑单测：组卷、判定、计分、交付物结构校验
import { describe, expect, it } from "vitest"
import {
  buildDeliveryPaper,
  checkDeliverable,
  checkWorkspace,
  deliveryRank,
  judgeDeliveryQuestion,
  scoreDeliveryPaper,
  wrongDeliveryTermIds,
} from "@/game/delivery"
import type { DeliveryDeliverableDef, DeliveryModule, DeliveryQuestion } from "@/content/delivery"

function q(partial: Partial<DeliveryQuestion>): DeliveryQuestion {
  return {
    id: "q1",
    type: "single",
    prompt: "题干",
    options: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
    answer: "a",
    reference: "参考".repeat(20),
    bonus_points: ["加分点"],
    term_ids: ["go_live"],
    source_hint: "测试",
    ...partial,
  }
}

const mod: DeliveryModule = {
  moduleId: "delivery",
  moduleName: "上线陪产 · 交付闭环",
  subtitle: "",
  intro: "",
  knowledge_ids: ["K9-8"],
  cards: [{ id: "c1", title: "卡片", summary: "", points: ["要点"], pitfalls: ["坑"], term_ids: [], knowledge_ids: ["K9-8"] }],
  questions: [q({}), q({ id: "q2", answer: "b" }), q({ id: "q3", type: "multiple", answer: ["a", "b"] })],
  orders: [
    {
      id: "o1",
      title: "顺序",
      intro: "",
      steps: [
        { id: "s1", text: "一步", note: "n" },
        { id: "s2", text: "两步", note: "n" },
        { id: "s3", text: "三步", note: "n" },
      ],
    },
  ],
  workspace: {
    intro: "",
    notice: "",
    deliverables: [],
  },
}

describe("交付闭环组卷", () => {
  it("题量取全部并随机取一道顺序题", () => {
    const paper = buildDeliveryPaper(mod, 0, 1)
    expect(paper.questions.length).toBe(3)
    expect(paper.order?.id).toBe("o1")
  })

  it("按题量截断", () => {
    const paper = buildDeliveryPaper(mod, 2, 0)
    expect(paper.questions.length).toBe(2)
    expect(paper.order).toBeNull()
  })
})

describe("交付闭环判分口径与其它模块一致", () => {
  it("单选按字符串相等", () => {
    expect(judgeDeliveryQuestion(mod.questions[0], "a")).toBe(true)
    expect(judgeDeliveryQuestion(mod.questions[0], "b")).toBe(false)
  })

  it("多选少选都算错", () => {
    expect(judgeDeliveryQuestion(mod.questions[2], ["a", "b"])).toBe(true)
    expect(judgeDeliveryQuestion(mod.questions[2], ["a"])).toBe(false)
  })

  it("顺序题必须完全正确才得分", () => {
    const paper = buildDeliveryPaper(mod, 3, 1)
    const answers = new Map<string, string | string[]>([
      ["q1", "a"],
      ["q2", "b"],
      ["q3", ["a", "b"]],
    ])
    const full = scoreDeliveryPaper(paper, answers, ["s1", "s2", "s3"])
    expect(full.score).toBe(100)
    expect(full.orderCorrect).toBe(true)

    const wrongOrder = scoreDeliveryPaper(paper, answers, ["s2", "s1", "s3"])
    expect(wrongOrder.score).toBe(75)
    expect(wrongOrder.orderCorrect).toBe(false)
  })

  it("答错的题关联术语进复习队列", () => {
    const paper = buildDeliveryPaper(mod, 3, 1)
    const answers = new Map<string, string | string[]>([
      ["q1", "b"],
      ["q2", "b"],
      ["q3", ["a", "b"]],
    ])
    const scored = scoreDeliveryPaper(paper, answers, ["s1", "s2", "s3"])
    expect(wrongDeliveryTermIds(scored)).toContain("go_live")
  })

  it("评级档位与其它模块相同", () => {
    expect(deliveryRank(96)).toBe("S")
    expect(deliveryRank(86)).toBe("A")
    expect(deliveryRank(71)).toBe("B")
    expect(deliveryRank(60)).toBe("C")
  })
})

const deliverable: DeliveryDeliverableDef = {
  id: "oper_manual",
  title: "操作手册",
  audience: "操作工",
  purpose: "照着能干活",
  template: "结构",
  min_chars: 50,
  required_elements: [
    { id: "version", label: "版本号与生效日期", hint: "封面写版本号", patterns: ["版本", "生效"] },
    { id: "roles", label: "角色与适用范围", hint: "写明谁用", patterns: ["岗位", "角色"] },
    { id: "shots", label: "截图占位", hint: "留截图位", patterns: ["截图", "占位"] },
  ],
  term_ids: [],
}

describe("交付物结构校验", () => {
  it("空白稿：要素全缺、字数不足", () => {
    const r = checkDeliverable(deliverable, "")
    expect(r.chars).toBe(0)
    expect(r.enough).toBe(false)
    expect(r.passed).toBe(0)
    expect(r.complete).toBe(false)
    expect(r.missing).toEqual(["版本号与生效日期", "角色与适用范围", "截图占位"])
  })

  it("命中任意一条规则即算该要素齐全", () => {
    const r = checkDeliverable(deliverable, "版本 V1.0\n本手册适用岗位：报工员\n此处放截图占位\n其余内容凑够字数用的说明文字填充内容填充内容填充内容填充内容。")
    expect(r.passed).toBe(3)
    expect(r.enough).toBe(true)
    expect(r.complete).toBe(true)
    expect(r.missing).toEqual([])
  })

  it("命中多条规则不重复计数", () => {
    const r = checkDeliverable(deliverable, "版本号：V1.0，生效日期：2026-10-30")
    expect(r.passed).toBe(1)
  })

  it("非法正则不抛错，按未命中处理", () => {
    const broken: DeliveryDeliverableDef = {
      ...deliverable,
      required_elements: [{ id: "x", label: "坏规则", hint: "", patterns: ["("] }],
    }
    const r = checkDeliverable(broken, "随便写点什么")
    expect(r.passed).toBe(0)
    expect(r.complete).toBe(false)
  })

  it("工作区整体齐全度按四件交付物平均", () => {
    const defs: DeliveryDeliverableDef[] = [
      deliverable,
      { ...deliverable, id: "acceptance", title: "上线验收单" },
    ]
    const drafts = {
      oper_manual: "版本 V1.0 岗位 报工员 截图占位 " + "填充".repeat(30),
      acceptance: "",
    }
    const ws = checkWorkspace(defs, drafts)
    expect(ws.checks.length).toBe(2)
    expect(ws.completeCount).toBe(1)
    expect(ws.allComplete).toBe(false)
    expect(ws.ratio).toBeCloseTo(0.5, 5)
  })
})
