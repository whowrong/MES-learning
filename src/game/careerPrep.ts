// 实习准备营纯逻辑：组卷、判定、计分、错题术语收集。
// 与面试训练营同一套判定口径（多选少选都算错），vitest 覆盖。
import { shuffle } from "@/content/loader"
import type {
  CareerOrder,
  CareerQuestion,
  CareerTrack,
} from "@/content/careerPrep"

export interface CareerPaper {
  questions: CareerQuestion[]
  order: CareerOrder | null
}

/** 组卷：按卷型抽题（questionCount=0 表示全部），顺序题最多取 orderCount 道 */
export function buildCareerPaper(
  track: CareerTrack,
  questionCount: number,
  orderCount: number,
): CareerPaper {
  const all = shuffle(track.questions)
  const questions = questionCount > 0 ? all.slice(0, Math.min(questionCount, all.length)) : all
  const orders = shuffle(track.orders ?? [])
  const order = orderCount > 0 ? orders[0] ?? null : null
  return { questions, order }
}

/** 客观题判定：多选按集合相等，单选/判断按字符串相等 */
export function judgeCareerQuestion(q: CareerQuestion, given: string | string[]): boolean {
  if (q.type === "multiple") {
    if (!Array.isArray(given) || !Array.isArray(q.answer)) return false
    if (given.length !== q.answer.length) return false
    const want = new Set(q.answer)
    return given.every((g) => want.has(g))
  }
  if (Array.isArray(given) || Array.isArray(q.answer)) return false
  return given === q.answer
}

/** 正确答案的可读文本（结果页展示用） */
export function careerAnswerText(q: CareerQuestion): string {
  const ids = Array.isArray(q.answer) ? q.answer : [q.answer]
  return ids
    .map((id) => q.options.find((o) => o.id === id)?.text ?? id)
    .join("；")
}

export interface CareerOrderVerdict {
  correct: boolean
  /** 顺序不对的步骤：给了什么、正确位置是第几步 */
  misplaced: Array<{ id: string; text: string; expectedIndex: number; actualIndex: number }>
  /** 完全正确的步骤 id */
  rightIds: string[]
}

/**
 * 顺序题判定：按给定的步骤 id 序列与正确顺序逐位比对。
 * 完全一致才算通过；否则列出所有位置不对的步骤（给出正确位置，1 起算）。
 */
export function judgeCareerOrder(order: CareerOrder, pickedIds: string[]): CareerOrderVerdict {
  const correctIds = order.steps.map((s) => s.id)
  const valid = pickedIds.filter((id) => correctIds.includes(id))
  // 提交里出现重复步骤或不属于本题的步骤 → 直接判错（不能靠过滤后蒙对）
  const pickedUnique = new Set(pickedIds)
  const hasInvalidStep = pickedUnique.size !== pickedIds.length || valid.length !== pickedIds.length
  const rightIds: string[] = []
  const misplaced: CareerOrderVerdict["misplaced"] = []
  for (let i = 0; i < correctIds.length; i++) {
    const expectedId = correctIds[i]
    const actualIndex = valid.indexOf(expectedId)
    if (actualIndex === i) {
      rightIds.push(expectedId)
    } else {
      misplaced.push({
        id: expectedId,
        text: order.steps[i].text,
        expectedIndex: i + 1,
        actualIndex: actualIndex >= 0 ? actualIndex + 1 : 0,
      })
    }
  }
  const correct = !hasInvalidStep && valid.length === correctIds.length && misplaced.length === 0
  return { correct, misplaced, rightIds }
}

export interface CareerQuestionResult {
  question: CareerQuestion
  given: string | string[] | undefined
  correct: boolean
  earned: number
}

export interface CareerPaperScore {
  /** 总分（0~100，四舍五入） */
  score: number
  /** 计入总分的项目数（题目数 + 顺序题数） */
  total: number
  objectiveCorrect: number
  objectiveTotal: number
  orderCorrect: boolean
  perQuestion: CareerQuestionResult[]
  orderVerdict: CareerOrderVerdict | null
}

/**
 * 计分：每道客观题与每道顺序题等权（0 或 1）。
 * 顺序题必须完全正确才得分——顺序题考的是流程先后，不是大致印象。
 */
export function scoreCareerPaper(
  paper: CareerPaper,
  answers: Map<string, string | string[]>,
  orderAnswer: string[] | null,
): CareerPaperScore {
  const perQuestion: CareerQuestionResult[] = []
  let objectiveCorrect = 0
  for (const q of paper.questions) {
    const given = answers.get(q.id)
    const correct = given !== undefined ? judgeCareerQuestion(q, given) : false
    if (correct) objectiveCorrect++
    perQuestion.push({ question: q, given, correct, earned: correct ? 1 : 0 })
  }
  const orderVerdict = paper.order ? judgeCareerOrder(paper.order, orderAnswer ?? []) : null
  const orderCorrect = orderVerdict?.correct ?? false
  const total = paper.questions.length + (paper.order ? 1 : 0)
  const earnedSum = perQuestion.reduce((s, r) => s + r.earned, 0) + (orderCorrect ? 1 : 0)
  const score = total > 0 ? Math.round((earnedSum / total) * 100) : 0
  return {
    score,
    total,
    objectiveCorrect,
    objectiveTotal: paper.questions.length,
    orderCorrect,
    perQuestion,
    orderVerdict,
  }
}

/** 答错的题关联术语 → 复习队列（去重） */
export function wrongCareerTermIds(score: CareerPaperScore): string[] {
  const ids = new Set<string>()
  for (const r of score.perQuestion) {
    if (r.correct) continue
    for (const tid of r.question.term_ids ?? []) ids.add(tid)
  }
  return [...ids]
}

/** 评级与其它模块同一套档位：S≥95 / A≥85 / B≥70 / 其余 C */
export function careerRank(score: number): "S" | "A" | "B" | "C" {
  if (score >= 95) return "S"
  if (score >= 85) return "A"
  if (score >= 70) return "B"
  return "C"
}
