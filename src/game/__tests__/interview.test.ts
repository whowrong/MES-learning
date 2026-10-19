import { describe, expect, it } from "vitest"
import {
  SHORT_RATINGS,
  isObjective,
  judgeObjective,
  rankForScore,
  scorePaper,
  wrongTermIds,
  type AnswerRecord,
} from "../interview"
import type { InterviewQuestion } from "@/content/interview"

function q(partial: Partial<InterviewQuestion> & { id: string; type: InterviewQuestion["type"] }): InterviewQuestion {
  return {
    category: "biz",
    prompt: "题干",
    options: [],
    answer: "",
    reference: "参考答案",
    bonus_points: ["加分点"],
    term_ids: [],
    source_hint: "",
    ...partial,
  }
}

const single = q({
  id: "s1",
  type: "single",
  options: [
    { id: "o1", text: "对的选择" },
    { id: "o2", text: "错的选择" },
  ],
  answer: "o1",
  term_ids: ["work_order"],
})

const multiple = q({
  id: "m1",
  type: "multiple",
  options: [
    { id: "o1", text: "A" },
    { id: "o2", text: "B" },
    { id: "o3", text: "C（干扰）" },
  ],
  answer: ["o1", "o2"],
  term_ids: ["bom"],
})

const judge = q({ id: "j1", type: "judge", answer: "no" })

const short = q({ id: "h1", type: "short", answer: "", term_ids: ["wip"] })

describe("judgeObjective", () => {
  it("单选按字符串相等判定", () => {
    expect(judgeObjective(single, "o1")).toBe(true)
    expect(judgeObjective(single, "o2")).toBe(false)
  })

  it("多选按集合相等：多选少选顺序不同都算对/错", () => {
    expect(judgeObjective(multiple, ["o1", "o2"])).toBe(true)
    expect(judgeObjective(multiple, ["o2", "o1"])).toBe(true)
    expect(judgeObjective(multiple, ["o1"])).toBe(false)
    expect(judgeObjective(multiple, ["o1", "o2", "o3"])).toBe(false)
  })

  it("判断题按 yes/no 判定", () => {
    expect(judgeObjective(judge, "no")).toBe(true)
    expect(judgeObjective(judge, "yes")).toBe(false)
  })
})

describe("scorePaper", () => {
  it("客观题对=1 错=0，简答按自评权重，总分四舍五入", () => {
    const paper = [single, multiple, judge, short]
    const answers: AnswerRecord[] = [
      { questionId: "s1", given: "o1" }, // 1
      { questionId: "m1", given: ["o1", "o3"] }, // 0（多选了干扰项）
      { questionId: "j1", given: "no" }, // 1
      { questionId: "h1", shortRating: "half" }, // 0.5
    ]
    const r = scorePaper(paper, answers)
    expect(r.total).toBe(4)
    expect(r.objectiveTotal).toBe(3)
    expect(r.objectiveCorrect).toBe(2)
    expect(r.shortTotal).toBe(1)
    expect(r.score).toBe(63) // (1+0+1+0.5)/4 = 0.625 → 63
    expect(rankForScore(r.score)).toBe("C")
  })

  it("未作答按 0 分；全对满分 S 档", () => {
    const paper = [single, short]
    const r = scorePaper(paper, [
      { questionId: "s1", given: "o1" },
      { questionId: "h1", shortRating: "perfect" },
    ])
    expect(r.score).toBe(100)
    expect(rankForScore(100)).toBe("S")
    const empty = scorePaper(paper, [])
    expect(empty.score).toBe(0)
    expect(rankForScore(0)).toBe("C")
  })

  it("四档自评权重梯度：lost < half < most < perfect", () => {
    const weights = SHORT_RATINGS.map((r) => r.weight)
    expect(weights).toEqual([0, 0.5, 0.8, 1])
  })

  it("isObjective：简答 false，其余 true", () => {
    expect(isObjective(single)).toBe(true)
    expect(isObjective(judge)).toBe(true)
    expect(isObjective(short)).toBe(false)
  })
})

describe("wrongTermIds", () => {
  it("答错与自评低的题关联术语进复习队列（去重），答对的不进", () => {
    const paper = [single, multiple, short]
    const answers: AnswerRecord[] = [
      { questionId: "s1", given: "o1" }, // 对，不进
      { questionId: "m1", given: ["o1"] }, // 少选算错，bom 进
      { questionId: "h1", shortRating: "lost" }, // 没思路，wip 进
    ]
    const r = scorePaper(paper, answers)
    expect(wrongTermIds(r).sort()).toEqual(["bom", "wip"])
  })

  it("简答自评「基本答全」视为通过，不进复习队列", () => {
    const r = scorePaper([short], [{ questionId: "h1", shortRating: "most" }])
    expect(wrongTermIds(r)).toEqual([])
  })
})

describe("rankForScore 档位边界", () => {
  it("S≥95 / A≥85 / B≥70 / 其余 C", () => {
    expect(rankForScore(95)).toBe("S")
    expect(rankForScore(94)).toBe("A")
    expect(rankForScore(85)).toBe("A")
    expect(rankForScore(84)).toBe("B")
    expect(rankForScore(70)).toBe("B")
    expect(rankForScore(69)).toBe("C")
  })
})
