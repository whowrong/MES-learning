import { describe, expect, it } from "vitest"
import { deriveJudgeProblems, judgeMatch, judgeQuiz, judgeQuizOne, judgeSort } from "@/game/judge"

const quotes = [
  { id: "q1", answer: "work_order" },
  { id: "q2", answer: "bom" },
  { id: "q3", answer: "wip" },
]

describe("judgeMatch 连连看判定", () => {
  it("全对", () => {
    const { results, correctCount } = judgeMatch(quotes, {
      q1: "work_order",
      q2: "bom",
      q3: "wip",
    })
    expect(correctCount).toBe(3)
    expect(results.every((r) => r.correct)).toBe(true)
  })

  it("部分错：错题带 expected 与 given", () => {
    const { results, correctCount } = judgeMatch(quotes, {
      q1: "work_order",
      q2: "wip",
      q3: "wip",
    })
    expect(correctCount).toBe(2)
    const wrong = results.find((r) => !r.correct)!
    expect(wrong.quoteId).toBe("q2")
    expect(wrong.expected).toBe("bom")
    expect(wrong.given).toBe("wip")
  })

  it("未作答按错误处理", () => {
    const { correctCount } = judgeMatch(quotes, { q1: "work_order" })
    expect(correctCount).toBe(1)
  })
})

describe("judgeQuiz 场景抉择判定", () => {
  const questions = [
    { id: "z1", answer: "o1" },
    { id: "z2", answer: "o3" },
  ]

  it("批量判定：对错分开，expected/given 可回看", () => {
    const { results, correctCount } = judgeQuiz(questions, { z1: "o1", z2: "o2" })
    expect(correctCount).toBe(1)
    const wrong = results.find((r) => !r.correct)!
    expect(wrong.questionId).toBe("z2")
    expect(wrong.expected).toBe("o3")
    expect(wrong.given).toBe("o2")
  })

  it("未作答按错误处理", () => {
    const { correctCount } = judgeQuiz(questions, { z1: "o1" })
    expect(correctCount).toBe(1)
  })

  it("单题即时判定", () => {
    const right = judgeQuizOne({ id: "z1", answer: "o1" }, "o1")
    expect(right.correct).toBe(true)
    const wrong = judgeQuizOne({ id: "z1", answer: "o1" }, "o4")
    expect(wrong.correct).toBe(false)
    expect(wrong.expected).toBe("o1")
  })
})

describe("deriveJudgeProblems 真假鉴定衍生", () => {
  const fb = { factory: "f", data: "d", consultant: "c" }
  const quotes = [
    { id: "q1", text: "话一", answer: "a", term_ids: ["a"], feedback: fb },
    { id: "q2", text: "话二", answer: "b", term_ids: ["b"], feedback: fb },
  ]
  const concepts = ["a", "b", "c"]

  it("每句衍生 2 题：一对一错，answer 与 isMatch 一致，错题配对不是真概念", () => {
    const probs = deriveJudgeProblems(quotes, concepts, 2)
    expect(probs.length).toBe(4)
    expect(probs.filter((p) => p.isMatch).length).toBe(2)
    expect(probs.filter((p) => !p.isMatch).length).toBe(2)
    for (const p of probs) {
      expect(p.answer).toBe(p.isMatch ? "yes" : "no")
      if (p.isMatch) expect(p.conceptId).toBe(p.actualConceptId)
      else expect(p.conceptId).not.toBe(p.actualConceptId)
      expect(p.feedback).toEqual(fb)
    }
    expect(new Set(probs.map((p) => p.id)).size).toBe(4)
  })

  it("perRound 截取句数；超过题库则全量", () => {
    expect(deriveJudgeProblems(quotes, concepts, 1).length).toBe(2)
    expect(deriveJudgeProblems(quotes, concepts, 99).length).toBe(4)
  })
})

describe("judgeSort 流程排序判定", () => {
  const correct = ["a", "b", "c", "d"]

  it("全对", () => {
    const { correctCount, perfect } = judgeSort(correct, correct)
    expect(correctCount).toBe(4)
    expect(perfect).toBe(true)
  })

  it("错位逐步标记", () => {
    const { results, correctCount, perfect } = judgeSort(["a", "c", "b", "d"], correct)
    expect(correctCount).toBe(2)
    expect(perfect).toBe(false)
    expect(results[1].expected).toBe("b")
    expect(results[1].correct).toBe(false)
  })

  it("玩家序列缺项时补位记错", () => {
    const { correctCount, perfect } = judgeSort(["a", "b"], correct)
    expect(correctCount).toBe(2)
    expect(perfect).toBe(false)
  })
})
