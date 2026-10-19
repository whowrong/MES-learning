// 厂型特训营计分纯逻辑单测
import { describe, expect, it } from "vitest"
import { factoryWrongTermIds, judgeFactoryQuestion, rankForScore, scoreFactoryQuiz } from "@/game/factory"
import type { FactoryQuizQuestion } from "@/content/factoryTypes"

function q(id: string, answer: string, termIds: string[] = []): FactoryQuizQuestion {
  return {
    id,
    prompt: `题干 ${id}`,
    options: [
      { id: "o1", text: "选项一" },
      { id: "o2", "text": "选项二" },
    ],
    answer,
    term_ids: termIds,
    feedback: { factory: "f", data: "d", consultant: "c" },
  }
}

describe("judgeFactoryQuestion", () => {
  it("选中正确答案判对", () => {
    expect(judgeFactoryQuestion(q("a", "o1"), "o1")).toBe(true)
  })
  it("选错或未作答判错", () => {
    expect(judgeFactoryQuestion(q("a", "o1"), "o2")).toBe(false)
    expect(judgeFactoryQuestion(q("a", "o1"), undefined)).toBe(false)
  })
})

describe("scoreFactoryQuiz", () => {
  it("6 题对 4 → 67 分", () => {
    const questions = [q("q1", "o1"), q("q2", "o1"), q("q3", "o1"), q("q4", "o1"), q("q5", "o1"), q("q6", "o1")]
    const answers = [
      { questionId: "q1", given: "o1" },
      { questionId: "q2", given: "o1" },
      { questionId: "q3", given: "o1" },
      { questionId: "q4", given: "o1" },
      { questionId: "q5", given: "o2" },
      { questionId: "q6", given: "o2" },
    ]
    const result = scoreFactoryQuiz(questions, answers)
    expect(result.score).toBe(67)
    expect(result.total).toBe(6)
    expect(result.correctCount).toBe(4)
    expect(result.perQuestion.length).toBe(6)
  })

  it("全对 → 100 分 S 档", () => {
    const questions = [q("q1", "o2"), q("q2", "o1")]
    const result = scoreFactoryQuiz(questions, [
      { questionId: "q1", given: "o2" },
      { questionId: "q2", given: "o1" },
    ])
    expect(result.score).toBe(100)
    expect(rankForScore(result.score)).toBe("S")
  })

  it("全部未作答 → 0 分 C 档", () => {
    const result = scoreFactoryQuiz([q("q1", "o1"), q("q2", "o1")], [])
    expect(result.score).toBe(0)
    expect(result.correctCount).toBe(0)
    expect(rankForScore(result.score)).toBe("C")
  })

  it("空卷 → 0 分不崩溃", () => {
    expect(scoreFactoryQuiz([], []).score).toBe(0)
  })
})

describe("factoryWrongTermIds", () => {
  it("答错题的术语进队列并去重，答对题不进", () => {
    const questions = [q("q1", "o1", ["takt_time", "station"]), q("q2", "o1", ["station"]), q("q3", "o1", ["lot_batch"])]
    const result = scoreFactoryQuiz(questions, [
      { questionId: "q1", given: "o2" },
      { questionId: "q2", given: "o1" },
      { questionId: "q3", given: "o2" },
    ])
    const ids = factoryWrongTermIds(result)
    expect(ids).toEqual(["takt_time", "station", "lot_batch"])
  })

  it("全对 → 空队列", () => {
    const questions = [q("q1", "o1", ["takt_time"])]
    const result = scoreFactoryQuiz(questions, [{ questionId: "q1", given: "o1" }])
    expect(factoryWrongTermIds(result)).toEqual([])
  })
})
