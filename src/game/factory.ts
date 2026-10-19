// 厂型特训营纯逻辑：测验判定、计分、错题术语收集。单测 __tests__/factory.test.ts
import type { FactoryQuizQuestion } from "@/content/factoryTypes"

export { rankForScore } from "@/game/interview"

export interface FactoryAnswerRecord {
  questionId: string
  given: string
}

export interface FactoryQuestionResult {
  question: FactoryQuizQuestion
  given: string | undefined
  correct: boolean
}

export interface FactoryQuizResult {
  /** 总分（0~100，四舍五入）：每题等权，答对得分 */
  score: number
  total: number
  correctCount: number
  perQuestion: FactoryQuestionResult[]
}

export function judgeFactoryQuestion(q: FactoryQuizQuestion, given: string | undefined): boolean {
  return given !== undefined && given === q.answer
}

export function scoreFactoryQuiz(questions: FactoryQuizQuestion[], answers: FactoryAnswerRecord[]): FactoryQuizResult {
  const byId = new Map(answers.map((a) => [a.questionId, a.given]))
  const perQuestion: FactoryQuestionResult[] = []
  let correctCount = 0
  for (const q of questions) {
    const given = byId.get(q.id)
    const correct = judgeFactoryQuestion(q, given)
    if (correct) correctCount++
    perQuestion.push({ question: q, given, correct })
  }
  const total = questions.length
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0
  return { score, total, correctCount, perQuestion }
}

/** 答错题关联术语 → 复习队列（去重，保持题目顺序） */
export function factoryWrongTermIds(result: FactoryQuizResult): string[] {
  const ids = new Set<string>()
  for (const r of result.perQuestion) {
    if (r.correct) continue
    for (const tid of r.question.term_ids ?? []) ids.add(tid)
  }
  return [...ids]
}
