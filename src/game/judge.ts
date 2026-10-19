// 判定逻辑（纯函数，可单测）：连连看判定 + 场景抉择判定 + 流程排序判定
// 所有讲解文案都在内容文件里，这里只返回对/错与讲解索引。

/** 单条连连看引语的对错结果 */
export interface MatchResult {
  quoteId: string
  correct: boolean
  /** 正确答案（概念 id），用于错题回看 */
  expected: string
  /** 玩家实际选的概念 id */
  given: string
}

export interface MatchQuote {
  id: string
  answer: string
}

/**
 * 判定连连看：answers 为 { quoteId: 玩家选的概念 id }
 * 未作答的引语按错误处理（given 为空串）。
 */
export function judgeMatch(
  quotes: MatchQuote[],
  answers: Record<string, string>,
): { results: MatchResult[]; correctCount: number } {
  const results: MatchResult[] = quotes.map((q) => {
    const given = answers[q.id] ?? ""
    return {
      quoteId: q.id,
      correct: given !== "" && given === q.answer,
      expected: q.answer,
      given,
    }
  })
  const correctCount = results.filter((r) => r.correct).length
  return { results, correctCount }
}

/** 场景抉择（单选）判定：answers 为 { questionId: 玩家选的选项 id } */
export interface QuizResult {
  questionId: string
  correct: boolean
  /** 正确选项 id */
  expected: string
  /** 玩家选的选项 id */
  given: string
}

export interface QuizQuestion {
  id: string
  answer: string
}

export function judgeQuiz(
  questions: QuizQuestion[],
  answers: Record<string, string>,
): { results: QuizResult[]; correctCount: number } {
  const results: QuizResult[] = questions.map((q) => {
    const given = answers[q.id] ?? ""
    return {
      questionId: q.id,
      correct: given !== "" && given === q.answer,
      expected: q.answer,
      given,
    }
  })
  const correctCount = results.filter((r) => r.correct).length
  return { results, correctCount }
}

/** 单题即时判定（场景抉择逐题反馈用） */
export function judgeQuizOne(question: QuizQuestion, given: string): QuizResult {
  return {
    questionId: question.id,
    correct: given !== "" && given === question.answer,
    expected: question.answer,
    given,
  }
}

/** 排序判定：单步对错结果 */
export interface SortResult {
  /** 玩家排出的第 position 位 */
  position: number
  stepId: string
  correct: boolean
  /** 该位置本应放的步骤 id */
  expected: string
}

/**
 * 判定流程排序：playerOrder 与 correctOrder 都是步骤 id 数组，逐位比对。
 * 长度不一致时按较短长度比对，多出的位置记为错误。
 */
export function judgeSort(
  playerOrder: string[],
  correctOrder: string[],
): { results: SortResult[]; correctCount: number; perfect: boolean } {
  const len = Math.max(playerOrder.length, correctOrder.length)
  const results: SortResult[] = []
  for (let i = 0; i < len; i++) {
    const expected = correctOrder[i] ?? ""
    const stepId = playerOrder[i] ?? ""
    results.push({ position: i, stepId, correct: stepId !== "" && stepId === expected, expected })
  }
  const correctCount = results.filter((r) => r.correct).length
  return { results, correctCount, perfect: correctCount === correctOrder.length && playerOrder.length === correctOrder.length }
}

// ---------- 真假鉴定（从 match 题库自动衍生，组合出题永不重样） ----------

export interface JudgeSourceQuote {
  id: string
  text: string
  answer: string
  term_ids: string[]
  feedback: { factory: string; data: string; consultant: string }
}

/** 一道真假鉴定题：给一句话 + 一个概念，判断「这句话是在说这个概念吗」 */
export interface JudgeProblem {
  id: string
  quoteId: string
  quoteText: string
  conceptId: string
  /** 该概念是否真是这句话的答案 */
  isMatch: boolean
  /** 正确判断 */
  answer: "yes" | "no"
  term_ids: string[]
  feedback: JudgeSourceQuote["feedback"]
  /** 这句话真正在说的概念（错误配对的讲解用：「其实它在说 XX」） */
  actualConceptId: string
}

/**
 * 从 match 题库衍生真假鉴定题：
 * 随机抽 perRound 句话，每句出两道——正确配对（答「对」）+ 随机错误配对（答「错」），
 * 全部打乱。素材全部来自人工把关过的引语，不会产生新的奇怪题目；
 * 组合数 = C(题库, perRound) × 每句的错误配对选择数，重玩几乎不重样。
 */
export function deriveJudgeProblems(
  quotes: JudgeSourceQuote[],
  concepts: string[],
  perRound: number,
): JudgeProblem[] {
  const shuffled = [...quotes]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const picked = shuffled.slice(0, Math.min(perRound, shuffled.length))
  const problems: JudgeProblem[] = []
  for (const q of picked) {
    problems.push({
      id: `${q.id}-${q.answer}-yes`,
      quoteId: q.id,
      quoteText: q.text,
      conceptId: q.answer,
      isMatch: true,
      answer: "yes",
      term_ids: q.term_ids,
      feedback: q.feedback,
      actualConceptId: q.answer,
    })
    const others = concepts.filter((c) => c !== q.answer)
    const wrongConcept = others.length > 0 ? others[Math.floor(Math.random() * others.length)] : q.answer
    problems.push({
      id: `${q.id}-${wrongConcept}-no`,
      quoteId: q.id,
      quoteText: q.text,
      conceptId: wrongConcept,
      isMatch: false,
      answer: "no",
      term_ids: q.term_ids,
      feedback: q.feedback,
      actualConceptId: q.answer,
    })
  }
  // 打乱出题顺序
  for (let i = problems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[problems[i], problems[j]] = [problems[j], problems[i]]
  }
  return problems
}
