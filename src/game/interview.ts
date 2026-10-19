// 面试模拟的纯逻辑：判定、计分、评级、错题术语收集。单测覆盖 __tests__/interview.test.ts
import type { InterviewQuestion } from "@/content/interview"

/** 简答题四档自评（权重用于总分） */
export type ShortRatingId = "lost" | "half" | "most" | "perfect"

export interface ShortRatingDef {
  id: ShortRatingId
  label: string
  hint: string
  weight: number
}

export const SHORT_RATINGS: ShortRatingDef[] = [
  { id: "lost", label: "没思路", hint: "完全不知道从哪说起", weight: 0 },
  { id: "half", label: "答出一半", hint: "说了些边角，主干没讲出来", weight: 0.5 },
  { id: "most", label: "基本答全", hint: "主干都有，细节或话术差点", weight: 0.8 },
  { id: "perfect", label: "完美回答", hint: "框架、细节、加分点都到位", weight: 1 },
]

export interface AnswerRecord {
  questionId: string
  /** 客观题作答：single/judge 为选项 id，multiple 为 id 数组 */
  given?: string | string[]
  /** 简答题自评档位 */
  shortRating?: ShortRatingId
}

export function isObjective(q: InterviewQuestion): boolean {
  return q.type !== "short"
}

/** 客观题判定：多选按集合相等（多选少选都算错），单选/判断按字符串相等 */
export function judgeObjective(q: InterviewQuestion, given: string | string[]): boolean {
  if (q.type === "multiple") {
    if (!Array.isArray(given) || !Array.isArray(q.answer)) return false
    if (given.length !== q.answer.length) return false
    const want = new Set(q.answer)
    return given.every((g) => want.has(g))
  }
  if (Array.isArray(given) || Array.isArray(q.answer)) return false
  return given === q.answer
}

export interface QuestionResult {
  question: InterviewQuestion
  answer: AnswerRecord | undefined
  /** 得分（0~1）：客观题对=1 错=0；简答按自评权重 */
  earned: number
  correct: boolean
}

export interface PaperScore {
  /** 总分（0~100，四舍五入）：每题等权，简答按自评权重折算 */
  score: number
  total: number
  objectiveTotal: number
  objectiveCorrect: number
  shortTotal: number
  perQuestion: QuestionResult[]
}

export function scorePaper(paper: InterviewQuestion[], answers: AnswerRecord[]): PaperScore {
  const byId = new Map(answers.map((a) => [a.questionId, a]))
  const perQuestion: QuestionResult[] = []
  let objectiveTotal = 0
  let objectiveCorrect = 0
  let shortTotal = 0
  for (const q of paper) {
    const answer = byId.get(q.id)
    if (isObjective(q)) {
      objectiveTotal++
      const correct = answer?.given !== undefined ? judgeObjective(q, answer.given) : false
      if (correct) objectiveCorrect++
      perQuestion.push({ question: q, answer, earned: correct ? 1 : 0, correct })
    } else {
      shortTotal++
      const rating = SHORT_RATINGS.find((r) => r.id === answer?.shortRating)
      const earned = rating?.weight ?? 0
      // 简答题「没思路」视同错误，进复习队列
      perQuestion.push({ question: q, answer, earned, correct: earned >= 0.8 })
    }
  }
  const total = paper.length
  const earnedSum = perQuestion.reduce((s, r) => s + r.earned, 0)
  const score = total > 0 ? Math.round((earnedSum / total) * 100) : 0
  return { score, total, objectiveTotal, objectiveCorrect, shortTotal, perQuestion }
}

/** 评级与章节总评分同一套档位：S≥95 / A≥85 / B≥70 / 其余 C */
export function rankForScore(score: number): "S" | "A" | "B" | "C" {
  if (score >= 95) return "S"
  if (score >= 85) return "A"
  if (score >= 70) return "B"
  return "C"
}

/** 答错/自评低的题关联术语 → 复习队列（去重） */
export function wrongTermIds(result: PaperScore): string[] {
  const ids = new Set<string>()
  for (const r of result.perQuestion) {
    if (r.correct) continue
    for (const tid of r.question.term_ids ?? []) ids.add(tid)
  }
  return [...ids]
}
