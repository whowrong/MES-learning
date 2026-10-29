// 实习准备营纯逻辑单测：组卷、判定、计分、错题术语
import { describe, expect, it } from "vitest"
import {
  buildCareerPaper,
  careerAnswerText,
  careerRank,
  judgeCareerOrder,
  judgeCareerQuestion,
  scoreCareerPaper,
  wrongCareerTermIds,
} from "@/game/careerPrep"
import type { CareerOrder, CareerQuestion, CareerTrack } from "@/content/careerPrep"

function q(partial: Partial<CareerQuestion>): CareerQuestion {
  return {
    id: "q1",
    type: "single",
    prompt: "题干",
    options: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ],
    answer: "a",
    reference: "x".repeat(50),
    bonus_points: ["加分点"],
    term_ids: [],
    source_hint: "测试",
    ...partial,
  }
}

const track: CareerTrack = {
  trackId: "t",
  trackName: "测试赛道",
  subtitle: "",
  intro: "",
  cards: [
    { id: "c1", title: "卡片", summary: "", points: ["要点"], pitfalls: ["坑"], term_ids: [] },
  ],
  questions: [q({}), q({ id: "q2", answer: "b" }), q({ id: "q3", type: "multiple", answer: ["a", "b"] })],
  orders: [],
}

const order: CareerOrder = {
  id: "o1",
  title: "顺序",
  intro: "",
  steps: [
    { id: "s1", text: "一", note: "" },
    { id: "s2", text: "二", note: "" },
    { id: "s3", text: "三", note: "" },
  ],
}

describe("组卷", () => {
  it("按卷型抽题，抽不超过题库数量", () => {
    const paper = buildCareerPaper(track, 2, 0)
    expect(paper.questions).toHaveLength(2)
    expect(paper.order).toBeNull()
  })

  it("questionCount=0 表示全部题目", () => {
    const paper = buildCareerPaper(track, 0, 0)
    expect(paper.questions).toHaveLength(3)
  })

  it("顺序题按 orderCount 取，取不到就是 null", () => {
    const withOrder = { ...track, orders: [order] }
    expect(buildCareerPaper(withOrder, 1, 1).order?.id).toBe("o1")
    expect(buildCareerPaper(track, 1, 1).order).toBeNull()
  })
})

describe("客观题判定", () => {
  it("单选：相等才算对", () => {
    expect(judgeCareerQuestion(q({}), "a")).toBe(true)
    expect(judgeCareerQuestion(q({}), "b")).toBe(false)
  })

  it("多选：集合相等才算对，多选少选都错", () => {
    const m = q({ type: "multiple", answer: ["a", "b"] })
    expect(judgeCareerQuestion(m, ["a", "b"])).toBe(true)
    expect(judgeCareerQuestion(m, ["b", "a"])).toBe(true)
    expect(judgeCareerQuestion(m, ["a"])).toBe(false)
    expect(judgeCareerQuestion(m, ["a", "b", "a"])).toBe(false)
  })

  it("类型不匹配一律判错（数组答案配单选题、字符串答案配多选题）", () => {
    expect(judgeCareerQuestion(q({}), ["a"])).toBe(false)
    expect(judgeCareerQuestion(q({ type: "multiple", answer: ["a"] }), "a")).toBe(false)
  })

  it("正确答案文本可读（单选与多选都拼选项文案）", () => {
    expect(careerAnswerText(q({}))).toBe("A")
    expect(careerAnswerText(q({ type: "multiple", answer: ["a", "b"] }))).toBe("A；B")
  })
})

describe("顺序题判定", () => {
  it("完全正确才算通过", () => {
    const v = judgeCareerOrder(order, ["s1", "s2", "s3"])
    expect(v.correct).toBe(true)
    expect(v.misplaced).toHaveLength(0)
  })

  it("顺序错时报出每一步的正确位置（1 起算）", () => {
    const v = judgeCareerOrder(order, ["s2", "s1", "s3"])
    expect(v.correct).toBe(false)
    const first = v.misplaced.find((m) => m.id === "s1")
    expect(first?.expectedIndex).toBe(1)
    expect(first?.actualIndex).toBe(2)
    expect(v.misplaced.find((m) => m.id === "s2")?.expectedIndex).toBe(2)
  })

  it("少排或排了不存在的步骤都不算对", () => {
    expect(judgeCareerOrder(order, ["s1", "s2"]).correct).toBe(false)
    expect(judgeCareerOrder(order, ["s1", "s2", "s3", "s4"]).correct).toBe(false)
  })
})

describe("计分", () => {
  it("客观题与顺序题等权，全对 100 分", () => {
    const paper = { questions: track.questions, order }
    const answers = new Map<string, string | string[]>([
      ["q1", "a"],
      ["q2", "b"],
      ["q3", ["a", "b"]],
    ])
    const scored = scoreCareerPaper(paper, answers, ["s1", "s2", "s3"])
    expect(scored.score).toBe(100)
    expect(scored.total).toBe(4)
    expect(scored.objectiveCorrect).toBe(3)
    expect(scored.orderCorrect).toBe(true)
  })

  it("顺序题必须全对才得分", () => {
    const paper = { questions: track.questions, order }
    const answers = new Map<string, string | string[]>([
      ["q1", "a"],
      ["q2", "b"],
      ["q3", ["a", "b"]],
    ])
    const scored = scoreCareerPaper(paper, answers, ["s2", "s1", "s3"])
    expect(scored.score).toBe(75)
    expect(scored.orderCorrect).toBe(false)
  })

  it("未作答按错处理", () => {
    const paper = { questions: track.questions, order: null }
    const scored = scoreCareerPaper(paper, new Map(), null)
    expect(scored.score).toBe(0)
    expect(scored.total).toBe(3)
  })

  it("错题关联术语去重后进复习队列", () => {
    const paper = {
      questions: [
        q({ id: "x1", term_ids: ["erp", "bom"] }),
        q({ id: "x2", term_ids: ["erp"] }),
      ],
      order: null,
    }
    const answers = new Map<string, string | string[]>([["x1", "b"]])
    const scored = scoreCareerPaper(paper, answers, null)
    expect(wrongCareerTermIds(scored)).toEqual(["erp", "bom"])
  })
})

describe("评级", () => {
  it("档位与其它模块一致", () => {
    expect(careerRank(96)).toBe("S")
    expect(careerRank(90)).toBe("A")
    expect(careerRank(75)).toBe("B")
    expect(careerRank(60)).toBe("C")
  })
})
