import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { getPocketBaseUrl } from "@/lib/pb"
import {
  CHAPTERS,
  buildDefaultProgress,
  type ChapterState,
  type GaugeValue,
  type ProgressRecord,
} from "@/content/chapters"
import {
  loadLevel,
  loadTerms,
  shuffle,
  type FillStageDef,
  type JudgeStageDef,
  type LevelDef,
  type MatchQuoteDef,
  type MatchStageDef,
  type QuizQuestionDef,
  type QuizStageDef,
  type SortStageDef,
  type TermDef,
} from "@/content/loader"
import {
  deriveJudgeProblems,
  judgeMatch,
  judgeQuizOne,
  judgeSort,
  type JudgeProblem,
  type MatchResult,
  type QuizResult,
  type SortResult,
} from "@/game/judge"
import { addStudyDay } from "@/game/streak"
import {
  applyGaugeDeltas,
  computeChapterScore,
  settleByContent,
  settleChapter1,
  type ChapterScoreResult,
  type GaugeDelta,
} from "@/game/settlement"

function progressApi(): string {
  return `${getPocketBaseUrl()}/api/player_progress`
}

/** 从任意返回体里安全抽取进度字段（缺字段用默认值兜底） */
function normalizeRecord(raw: Partial<ProgressRecord> & { id?: string }): ProgressRecord {
  const fallback = buildDefaultProgress()
  const normalized: ProgressRecord = {
    id: raw.id,
    chapter_status: raw.chapter_status ?? fallback.chapter_status,
    gauges: raw.gauges ?? fallback.gauges,
    review_queue: Array.isArray(raw.review_queue) ? raw.review_queue : [],
    term_mastery: raw.term_mastery ?? {},
    review_state: raw.review_state ?? {},
    study_days: Array.isArray(raw.study_days) ? raw.study_days : [],
    last_route: raw.last_route ?? "/home",
  }
  return normalized
}

/** 抽题：题库打乱，配了 perRound 就截取子集（每局进关时定格一次，重玩抽到不同题） */
function pickRound<T>(items: T[], perRound?: number): T[] {
  const shuffled = shuffle(items)
  if (perRound && perRound > 0 && perRound < shuffled.length) return shuffled.slice(0, perRound)
  return shuffled
}

export type LevelPhase = "story" | "match" | "judge" | "quiz" | "fill" | "sort" | "result"

export function useLevel() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const chapterParam = Number(searchParams.get("ch") ?? "1")
  const chapterMeta = CHAPTERS.find((c) => Number(c.id) === chapterParam) ?? null

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [terms, setTerms] = useState<Record<string, TermDef>>({})
  const [level, setLevel] = useState<LevelDef | null>(null)

  // 存档
  const [recordId, setRecordId] = useState("")
  const [chapterState, setChapterState] = useState<Record<string, ChapterState>>({})
  const [gauges, setGauges] = useState<Record<string, GaugeValue>>({})
  const [reviewQueue, setReviewQueue] = useState<string[]>([])
  const [termMastery, setTermMastery] = useState<Record<string, number>>({})
  const [studyDays, setStudyDays] = useState<string[]>([])

  // 本局抽中的题目（bootstrap 时定格；判定、计分、复习队列都只针对本局子集）
  const [roundMatch, setRoundMatch] = useState<MatchQuoteDef[] | null>(null)
  const [roundQuiz, setRoundQuiz] = useState<QuizQuestionDef[] | null>(null)
  const [roundFill, setRoundFill] = useState<QuizQuestionDef[] | null>(null)

  // 游玩状态
  const [phase, setPhase] = useState<LevelPhase>("story")
  const [storyIdx, setStoryIdx] = useState(0)
  const [matchAnswers, setMatchAnswers] = useState<Record<string, string>>({})
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null)
  const [matchResults, setMatchResults] = useState<MatchResult[] | null>(null)
  const [matchCorrect, setMatchCorrect] = useState(0)
  const [activeWrongQuote, setActiveWrongQuote] = useState<MatchQuoteDef | null>(null)
  // 场景抉择：逐题作答，答完立即判定并展示讲解
  const [quizIdx, setQuizIdx] = useState(0)
  const [quizPick, setQuizPick] = useState("")
  const [quizVerdict, setQuizVerdict] = useState<QuizResult | null>(null)
  const [quizResults, setQuizResults] = useState<QuizResult[]>([])
  // 限时填空：同抉择的逐题模式，另有每题倒计时（超时按未作答判错）
  const [fillIdx, setFillIdx] = useState(0)
  const [fillPick, setFillPick] = useState("")
  const [fillVerdict, setFillVerdict] = useState<QuizResult | null>(null)
  const [fillResults, setFillResults] = useState<QuizResult[]>([])
  // 真假鉴定：从 match 题库衍生的「这句话是在说 X 吗」判断流
  const [judgeProblems, setJudgeProblems] = useState<JudgeProblem[]>([])
  const [judgeIdx, setJudgeIdx] = useState(0)
  const [judgePick, setJudgePick] = useState<"yes" | "no" | "">("")
  const [judgeVerdict, setJudgeVerdict] = useState<boolean | null>(null)
  const [judgeResults, setJudgeResults] = useState<Array<{ problemId: string; correct: boolean }>>([])
  const [sortOrder, setSortOrder] = useState<string[]>([])
  const [sortResults, setSortResults] = useState<SortResult[] | null>(null)
  const [sortAttempts, setSortAttempts] = useState(0)
  const [sortRevealed, setSortRevealed] = useState(false)
  const [resultDeltas, setResultDeltas] = useState<GaugeDelta[]>([])
  const [chapterScore, setChapterScore] = useState<ChapterScoreResult | null>(null)
  const [newReviewTerms, setNewReviewTerms] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [termCard, setTermCard] = useState<TermDef | null>(null)

  const matchStage: MatchStageDef | null = useMemo(() => {
    const st = level?.stages.find((s) => s.type === "match") ?? null
    return st && st.type === "match" ? st : null
  }, [level])

  // 连连看展示视图：本局抽中的引语 + 打乱的概念槽（每局定格一次）
  const matchStageView: MatchStageDef | null = useMemo(() => {
    if (!matchStage || !roundMatch) return null
    const view: MatchStageDef = {
      ...matchStage,
      quotes: roundMatch,
      concepts: shuffle(matchStage.concepts),
    }
    return view
  }, [matchStage, roundMatch])

  const quizStage: QuizStageDef | null = useMemo(() => {
    const st = level?.stages.find((s) => s.type === "quiz") ?? null
    return st && st.type === "quiz" ? st : null
  }, [level])

  const fillStage: FillStageDef | null = useMemo(() => {
    const st = level?.stages.find((s) => s.type === "fill") ?? null
    return st && st.type === "fill" ? st : null
  }, [level])

  const judgeStage: JudgeStageDef | null = useMemo(() => {
    const st = level?.stages.find((s) => s.type === "judge") ?? null
    return st && st.type === "judge" ? st : null
  }, [level])

  const sortStage: SortStageDef | null = useMemo(() => {
    const st = level?.stages.find((s) => s.type === "sort") ?? null
    return st && st.type === "sort" ? st : null
  }, [level])

  // 进场：并行拉存档 + 术语 + 关卡内容
  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      if (!chapterMeta || !chapterMeta.playable) {
        if (!cancelled) {
          setLoading(false)
          setLoadError("这一章还没开放，先回章节地图看看能进哪一章。")
        }
        return
      }
      try {
        const fallback = buildDefaultProgress()
        const [termMap, levelDef, listRes] = await Promise.all([
          loadTerms(),
          loadLevel(chapterMeta.id),
          fetch(progressApi()),
        ])
        if (cancelled) return
        setTerms(termMap)
        setLevel(levelDef)
        // 每局抽题定格：match/quiz/fill 按 perRound 抽取，sort 保持完整流程
        const matchSt = levelDef.stages.find((s) => s.type === "match")
        if (matchSt && matchSt.type === "match") setRoundMatch(pickRound(matchSt.quotes, matchSt.perRound))
        const quizSt = levelDef.stages.find((s) => s.type === "quiz")
        if (quizSt && quizSt.type === "quiz") setRoundQuiz(pickRound(quizSt.questions, quizSt.perRound))
        const fillSt = levelDef.stages.find((s) => s.type === "fill")
        if (fillSt && fillSt.type === "fill") setRoundFill(pickRound(fillSt.questions, fillSt.perRound))
        // 真假鉴定：从 match 题库衍生（每句 2 道判断，组合随机）
        const judgeSt = levelDef.stages.find((s) => s.type === "judge")
        if (judgeSt && judgeSt.type === "judge") {
          const srcId = judgeSt.sourceStageId ?? "match"
          const srcSt = levelDef.stages.find((s) => s.id === srcId && s.type === "match")
          if (srcSt && srcSt.type === "match") {
            setJudgeProblems(deriveJudgeProblems(srcSt.quotes, srcSt.concepts, judgeSt.perRound ?? 6))
          }
        }
        const sortSt = levelDef.stages.find((s) => s.type === "sort")
        if (sortSt && sortSt.type === "sort") {
          setSortOrder(shuffle(sortSt.steps.map((s) => s.id)))
        }
        if (listRes.ok) {
          const listData = await listRes.json()
          const items: Array<Partial<ProgressRecord> & { id?: string }> = Array.isArray(listData?.items)
            ? listData.items
            : []
          const rec = items.length > 0 ? normalizeRecord(items[0]) : fallback
          if (items.length === 0) {
            // 无存档：立即创建默认进度（失败不阻塞游玩，结算时会再兜底 POST）
            void fetch(progressApi(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(fallback),
            })
              .then((r) => (r.ok ? r.json() : null))
              .then((created) => {
                if (!cancelled && created?.id) setRecordId(String(created.id))
              })
              .catch(() => {})
          }
          if (!cancelled) {
            if (rec.id) setRecordId(rec.id)
            setChapterState(rec.chapter_status)
            setGauges(rec.gauges)
            setReviewQueue(rec.review_queue)
            setTermMastery(rec.term_mastery)
            setStudyDays(rec.study_days ?? [])
          }
        }
        if (!cancelled) setPhase("story")
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "关卡内容加载失败")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [chapterMeta])

  // ---------- 剧情 ----------
  const storyTotal = level?.story.length ?? 0
  // 玩法关顺序完全跟随内容文件的 stages 数组（剧情结束后依次推进）
  const stageSequence = useMemo(() => {
    if (!level) return []
    const seq: LevelPhase[] = []
    for (const st of level.stages) seq.push(st.type as LevelPhase)
    return seq
  }, [level])

  const nextStory = useCallback(() => {
    if (storyIdx + 1 >= storyTotal) {
      setPhase(stageSequence[0] ?? "sort")
      return
    }
    setStoryIdx(storyIdx + 1)
  }, [storyIdx, storyTotal, stageSequence])

  // ---------- 连连看 ----------
  const selectQuote = useCallback(
    (quoteId: string) => {
      if (matchResults) return
      setSelectedQuote((cur) => (cur === quoteId ? null : quoteId))
    },
    [matchResults],
  )

  const assignConcept = useCallback(
    (conceptId: string, quoteId?: string) => {
      const target = quoteId ?? selectedQuote
      if (matchResults || !target) return
      setMatchAnswers((ans) => {
        const next = { ...ans }
        next[target] = conceptId
        return next
      })
      if (!quoteId) setSelectedQuote(null)
    },
    [matchResults, selectedQuote],
  )

  const clearQuoteAnswer = useCallback(
    (quoteId: string) => {
      if (matchResults) return
      setMatchAnswers((ans) => {
        const next = { ...ans }
        delete next[quoteId]
        return next
      })
      setSelectedQuote(null)
    },
    [matchResults],
  )

  const matchAllPlaced = roundMatch ? roundMatch.every((q) => !!matchAnswers[q.id]) : false

  const submitMatch = useCallback(() => {
    if (!roundMatch) return
    const { results, correctCount } = judgeMatch(
      roundMatch.map((q) => ({ id: q.id, answer: q.answer })),
      matchAnswers,
    )
    setMatchResults(results)
    setMatchCorrect(correctCount)
  }, [roundMatch, matchAnswers])

  const openQuoteFeedback = useCallback(
    (quoteId: string) => {
      const q = roundMatch?.find((x) => x.id === quoteId) ?? null
      setActiveWrongQuote(q)
    },
    [roundMatch],
  )

  const closeFeedback = useCallback(() => setActiveWrongQuote(null), [])

  const gotoQuiz = useCallback(() => {
    setPhase("quiz")
    setActiveWrongQuote(null)
  }, [])

  const pickQuizOption = useCallback(
    (optionId: string) => {
      if (quizVerdict) return
      setQuizPick(optionId)
    },
    [quizVerdict],
  )

  const submitQuizQuestion = useCallback(() => {
    if (!roundQuiz || quizVerdict || !quizPick) return
    const q = roundQuiz[quizIdx]
    if (!q) return
    const r = judgeQuizOne({ id: q.id, answer: q.answer }, quizPick)
    setQuizVerdict(r)
    setQuizResults((rs) => [...rs, r])
  }, [roundQuiz, quizVerdict, quizPick, quizIdx])

  // ---------- 限时填空 ----------
  const pickFillOption = useCallback(
    (optionId: string) => {
      if (fillVerdict) return
      setFillPick(optionId)
    },
    [fillVerdict],
  )

  /** 提交本题；倒计时归零时 View 调 submitFillTimeout（按未作答判错） */
  const submitFillQuestion = useCallback(() => {
    if (!roundFill || fillVerdict || !fillPick) return
    const q = roundFill[fillIdx]
    if (!q) return
    const r = judgeQuizOne({ id: q.id, answer: q.answer }, fillPick)
    setFillVerdict(r)
    setFillResults((rs) => [...rs, r])
  }, [roundFill, fillVerdict, fillPick, fillIdx])

  const submitFillTimeout = useCallback(() => {
    if (!roundFill || fillVerdict) return
    const q = roundFill[fillIdx]
    if (!q) return
    const r = judgeQuizOne({ id: q.id, answer: q.answer }, "")
    setFillVerdict(r)
    setFillResults((rs) => [...rs, r])
  }, [roundFill, fillVerdict, fillIdx])

  // ---------- 真假鉴定 ----------
  const pickJudgeAnswer = useCallback(
    (a: "yes" | "no") => {
      if (judgeVerdict !== null) return
      setJudgePick(a)
    },
    [judgeVerdict],
  )

  const submitJudgeProblem = useCallback(() => {
    const problem = judgeProblems[judgeIdx]
    if (!problem || judgeVerdict !== null || !judgePick) return
    const correct = judgePick === problem.answer
    setJudgeVerdict(correct)
    setJudgeResults((rs) => [...rs, { problemId: problem.id, correct }])
  }, [judgeProblems, judgeIdx, judgeVerdict, judgePick])

  const gotoSort = useCallback(() => {
    setPhase("sort")
    setActiveWrongQuote(null)
  }, [])

  // ---------- 排序 ----------
  const moveStep = useCallback(
    (index: number, dir: -1 | 1) => {
      if (sortRevealed) return
      setSortOrder((order) => {
        const target = index + dir
        if (target < 0 || target >= order.length) return order
        const next = [...order]
        const tmp = next[index]
        next[index] = next[target]
        next[target] = tmp
        return next
      })
    },
    [sortRevealed],
  )

  const sortMaxAttempts = sortStage?.maxAttempts ?? 2

  const submitSort = useCallback(() => {
    if (!sortStage) return
    const correctOrder = sortStage.steps.map((s) => s.id)
    const { results, perfect } = judgeSort(sortOrder, correctOrder)
    const attempts = sortAttempts + 1
    setSortAttempts(attempts)
    setSortResults(results)
    if (perfect || attempts >= sortMaxAttempts) {
      setSortRevealed(true)
      setSortOrder(correctOrder)
    }
  }, [sortStage, sortOrder, sortAttempts, sortMaxAttempts])

  const sortWrongCount = useMemo(() => {
    if (!sortResults) return 0
    return sortResults.filter((r) => !r.correct).length
  }, [sortResults])

  const matchWrongCount = useMemo(() => {
    if (!matchResults) return 0
    return matchResults.filter((r) => !r.correct).length
  }, [matchResults])

  const quizWrongCount = useMemo(() => quizResults.filter((r) => !r.correct).length, [quizResults])

  const fillWrongCount = useMemo(() => fillResults.filter((r) => !r.correct).length, [fillResults])

  const judgeWrongCount = useMemo(() => judgeResults.filter((r) => !r.correct).length, [judgeResults])

  // ---------- 结算与持久化 ----------
  const finishLevel = useCallback(async () => {
    if (!level) return
    setSaving(true)
    setSaveError("")
    // 错题涉及的术语进复习队列，掌握度 -1（只算本局抽中的题）
    const wrongTermIds: string[] = []
    if (roundMatch && matchResults) {
      for (const r of matchResults) {
        if (!r.correct) {
          const q = roundMatch.find((x) => x.id === r.quoteId)
          for (const tid of q?.term_ids ?? []) if (!wrongTermIds.includes(tid)) wrongTermIds.push(tid)
        }
      }
    }
    if (roundQuiz) {
      for (const r of quizResults) {
        if (!r.correct) {
          const q = roundQuiz.find((x) => x.id === r.questionId)
          for (const tid of q?.term_ids ?? []) if (!wrongTermIds.includes(tid)) wrongTermIds.push(tid)
        }
      }
    }
    if (roundFill) {
      for (const r of fillResults) {
        if (!r.correct) {
          const q = roundFill.find((x) => x.id === r.questionId)
          for (const tid of q?.term_ids ?? []) if (!wrongTermIds.includes(tid)) wrongTermIds.push(tid)
        }
      }
    }
    for (const r of judgeResults) {
      if (!r.correct) {
        const prob = judgeProblems.find((x) => x.id === r.problemId)
        if (prob) {
          for (const tid of prob.term_ids) if (!wrongTermIds.includes(tid)) wrongTermIds.push(tid)
          if (!wrongTermIds.includes(prob.actualConceptId)) wrongTermIds.push(prob.actualConceptId)
        }
      }
    }
    if (sortStage && sortResults) {
      for (const r of sortResults) {
        if (!r.correct) {
          const st = sortStage.steps.find((x) => x.id === r.expected)
          if (st && !wrongTermIds.includes("process_route")) wrongTermIds.push("process_route")
        }
      }
    }
    const nextQueue = [...reviewQueue]
    for (const tid of wrongTermIds) if (!nextQueue.includes(tid)) nextQueue.push(tid)
    const nextMastery = { ...termMastery }
    for (const tid of wrongTermIds) nextMastery[tid] = (nextMastery[tid] ?? 0) - 1

    // 结算规则：内容文件带 settlement 配置就用它（第二章起），否则走第一章默认规则
    const totalWrongAll = matchWrongCount + quizWrongCount + fillWrongCount + judgeWrongCount + sortWrongCount
    const deltas = level.result.settlement
      ? settleByContent(level.result.settlement, totalWrongAll)
      : settleChapter1({
          matchWrong: matchWrongCount,
          quizWrong: quizWrongCount + fillWrongCount + judgeWrongCount,
          sortWrong: sortWrongCount,
          progressReward: level.result.progressReward,
        })
    const score = computeChapterScore({
      matchTotal: roundMatch?.length ?? 0,
      matchWrong: matchWrongCount,
      quizTotal: (roundQuiz?.length ?? 0) + (roundFill?.length ?? 0),
      quizWrong: quizWrongCount + fillWrongCount,
      judgeTotal: judgeProblems.length,
      judgeWrong: judgeWrongCount,
      sortTotal: sortStage?.steps.length ?? 0,
      sortWrong: sortWrongCount,
    })
    const nextGauges = applyGaugeDeltas(gauges, deltas)
    const nextChapterState = { ...chapterState }
    nextChapterState[String(level.chapter)] = "cleared"
    const nextCh = CHAPTERS.find((c) => Number(c.id) === Number(level.chapter) + 1)
    if (nextCh && (nextChapterState[String(nextCh.id)] ?? "locked") === "locked") {
      nextChapterState[String(nextCh.id)] = "open"
    }

    // 通关即打卡：今天记入连续学习日
    const nextStudyDays = addStudyDay(studyDays, Date.now())
    const payload: ProgressRecord = {
      chapter_status: nextChapterState,
      gauges: nextGauges,
      review_queue: nextQueue,
      term_mastery: nextMastery,
      study_days: nextStudyDays,
      last_route: `/level?ch=${level.chapter}`,
    }
    try {
      if (recordId) {
        const res = await fetch(`${progressApi()}/${recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } else {
        const res = await fetch(progressApi(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const created = await res.json()
        if (created?.id) setRecordId(String(created.id))
      }
      setGauges(nextGauges)
      setChapterState(nextChapterState)
      setReviewQueue(nextQueue)
      setTermMastery(nextMastery)
      setStudyDays(nextStudyDays)
      setNewReviewTerms(wrongTermIds)
    } catch {
      // 保存失败不拦结算展示：给出提示，进度在本地状态先兑现
      setSaveError("进度保存失败（网络或存档服务问题），本页结算已展示，回首页可重试。")
      setGauges(nextGauges)
      setChapterState(nextChapterState)
      setReviewQueue(nextQueue)
      setStudyDays(nextStudyDays)
      setNewReviewTerms(wrongTermIds)
    } finally {
      setSaving(false)
      setResultDeltas(deltas)
      setChapterScore(score)
      setPhase("result")
    }
  }, [level, roundMatch, matchResults, roundQuiz, quizResults, roundFill, fillResults, judgeProblems, judgeResults, sortStage, sortResults, matchWrongCount, quizWrongCount, fillWrongCount, judgeWrongCount, sortWrongCount, reviewQueue, termMastery, studyDays, gauges, chapterState, recordId])

  // 玩法关按 stageSequence 顺序推进；已是最后一关则进结算
  const advanceStage = useCallback(
    (from: LevelPhase) => {
      const i = stageSequence.indexOf(from)
      const next = i >= 0 ? stageSequence[i + 1] : undefined
      if (!next) {
        void finishLevel()
        return
      }
      setPhase(next)
      setActiveWrongQuote(null)
    },
    [stageSequence, finishLevel],
  )

  // 抉择关：下一题；已是最后一题则推进到下一关
  const nextQuizQuestion = useCallback(() => {
    if (!roundQuiz) return
    if (quizIdx + 1 >= roundQuiz.length) {
      advanceStage("quiz")
      return
    }
    setQuizIdx(quizIdx + 1)
    setQuizPick("")
    setQuizVerdict(null)
  }, [roundQuiz, quizIdx, advanceStage])

  // 填空关：下一题；已是最后一题则推进到下一关
  const nextFillQuestion = useCallback(() => {
    if (!roundFill) return
    if (fillIdx + 1 >= roundFill.length) {
      advanceStage("fill")
      return
    }
    setFillIdx(fillIdx + 1)
    setFillPick("")
    setFillVerdict(null)
  }, [roundFill, fillIdx, advanceStage])

  // 鉴定关：下一题；已是最后一题则推进到下一关
  const nextJudgeProblem = useCallback(() => {
    if (judgeProblems.length === 0) return
    if (judgeIdx + 1 >= judgeProblems.length) {
      advanceStage("judge")
      return
    }
    setJudgeIdx(judgeIdx + 1)
    setJudgePick("")
    setJudgeVerdict(null)
  }, [judgeProblems, judgeIdx, advanceStage])

  // 连连看判定完的推进
  const advanceAfterMatch = useCallback(() => advanceStage("match"), [advanceStage])

  const goHome = useCallback(() => navigate("/"), [navigate])

  const openTermCard = useCallback(
    (termId: string) => {
      const t = terms[termId]
      if (t) setTermCard(t)
    },
    [terms],
  )

  const closeTermCard = useCallback(() => setTermCard(null), [])

  const sortStepViews = useMemo(() => {
    if (!sortStage) return []
    return sortOrder.map((sid, idx) => {
      const step = sortStage.steps.find((s) => s.id === sid)
      const verdict = sortResults?.find((r) => r.position === idx) ?? null
      const view = {
        stepId: sid,
        text: step?.text ?? sid,
        note: step?.note ?? "",
        position: idx,
        verdictCorrect: sortRevealed ? true : verdict ? verdict.correct : null,
        expectedStepId: verdict && !verdict.correct ? verdict.expected : "",
      }
      return view
    })
  }, [sortStage, sortOrder, sortResults, sortRevealed])

  // 抉择关当前题视图（View 只消费，不自己算）
  const quizQuestionView = useMemo(() => {
    if (!roundQuiz) return null
    const q = roundQuiz[quizIdx]
    if (!q) return null
    const expectedOption = q.options.find((o) => o.id === q.answer)
    const view = {
      id: q.id,
      prompt: q.prompt,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
      feedback: q.feedback,
      termIds: q.term_ids,
      judged: quizVerdict !== null,
      verdictCorrect: quizVerdict ? quizVerdict.correct : null,
      pickedOption: quizPick,
      expectedOptionId: q.answer,
      expectedOptionText: expectedOption?.text ?? "",
    }
    return view
  }, [roundQuiz, quizIdx, quizVerdict, quizPick])

  // 填空关当前题视图（题干含 ____ 挖空，View 只消费）
  const fillQuestionView = useMemo(() => {
    if (!roundFill || !fillStage) return null
    const q = roundFill[fillIdx]
    if (!q) return null
    const expectedOption = q.options.find((o) => o.id === q.answer)
    const view = {
      id: q.id,
      prompt: q.prompt,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
      feedback: q.feedback,
      termIds: q.term_ids,
      judged: fillVerdict !== null,
      verdictCorrect: fillVerdict ? fillVerdict.correct : null,
      pickedOption: fillPick,
      expectedOptionId: q.answer,
      expectedOptionText: expectedOption?.text ?? "",
      secondsPerQuestion: fillStage.secondsPerQuestion ?? 20,
    }
    return view
  }, [roundFill, fillStage, fillIdx, fillVerdict, fillPick])

  // 鉴定关当前题视图（View 只消费，不自己算）
  const judgeQuestionView = useMemo(() => {
    const problem = judgeProblems[judgeIdx]
    if (!problem) return null
    const view = {
      id: problem.id,
      quoteText: problem.quoteText,
      conceptId: problem.conceptId,
      conceptTerm: terms[problem.conceptId]?.term ?? problem.conceptId,
      actualConceptId: problem.actualConceptId,
      actualConceptTerm: terms[problem.actualConceptId]?.term ?? problem.actualConceptId,
      isMatch: problem.isMatch,
      judged: judgeVerdict !== null,
      picked: judgePick,
      verdictCorrect: judgeVerdict,
      feedback: problem.feedback,
      termIds: problem.term_ids,
    }
    return view
  }, [judgeProblems, judgeIdx, judgeVerdict, judgePick, terms])

  // 「进入下一关」按钮文案：跟随内容文件的关卡顺序自动取下一关短名
  const nextStageLabel = useMemo(() => {
    const SHORT: Record<string, string> = {
      match: "黑话连连看",
      judge: "真假鉴定",
      quiz: "场景抉择",
      fill: "限时填空",
      sort: "流程排序",
    }
    const i = stageSequence.indexOf("match")
    const next = i >= 0 ? stageSequence[i + 1] : undefined
    if (!next) return "进入结算"
    return `进入下一关：${SHORT[next] ?? "下一关"}`
  }, [stageSequence])

  // 结算页明细：每个玩法关的答对数（按本局抽中的题量）
  const scoreBreakdown = useMemo(() => {
    const rows: Array<{ label: string; correct: number; total: number }> = []
    if (matchStage && roundMatch) {
      rows.push({ label: matchStage.title, correct: matchCorrect, total: roundMatch.length })
    }
    if (judgeStage && judgeProblems.length > 0) {
      rows.push({
        label: judgeStage.title,
        correct: judgeResults.filter((r) => r.correct).length,
        total: judgeProblems.length,
      })
    }
    if (quizStage && roundQuiz) {
      rows.push({
        label: quizStage.title,
        correct: quizResults.filter((r) => r.correct).length,
        total: roundQuiz.length,
      })
    }
    if (fillStage && roundFill) {
      rows.push({
        label: fillStage.title,
        correct: fillResults.filter((r) => r.correct).length,
        total: roundFill.length,
      })
    }
    if (sortStage) {
      rows.push({ label: sortStage.title, correct: sortStage.steps.length - sortWrongCount, total: sortStage.steps.length })
    }
    return rows
  }, [matchStage, roundMatch, matchCorrect, judgeStage, judgeProblems, judgeResults, quizStage, roundQuiz, quizResults, fillStage, roundFill, fillResults, sortStage, sortWrongCount])

  const correctOrderHint = sortRevealed ? (sortStage?.steps.map((s) => s.text) ?? []) : []

  return {
    loading,
    loadError,
    chapterMeta,
    level,
    terms,
    phase,
    storyIdx,
    storyTotal,
    nextStory,
    matchStage,
    matchStageView,
    roundMatch,
    roundQuiz,
    roundFill,
    matchAnswers,
    selectedQuote,
    matchResults,
    matchCorrect,
    matchAllPlaced,
    matchWrongCount,
    selectQuote,
    assignConcept,
    clearQuoteAnswer,
    submitMatch,
    activeWrongQuote,
    openQuoteFeedback,
    closeFeedback,
    gotoSort,
    quizStage,
    quizIdx,
    quizTotal: roundQuiz?.length ?? 0,
    quizQuestionView,
    quizPick,
    quizVerdict,
    quizCorrectCount: quizResults.length - quizWrongCount,
    quizWrongCount,
    pickQuizOption,
    submitQuizQuestion,
    nextQuizQuestion,
    gotoQuiz,
    fillStage,
    fillIdx,
    fillTotal: roundFill?.length ?? 0,
    fillQuestionView,
    fillPick,
    fillVerdict,
    fillCorrectCount: fillResults.length - fillWrongCount,
    fillWrongCount,
    pickFillOption,
    submitFillQuestion,
    submitFillTimeout,
    nextFillQuestion,
    judgeStage,
    judgeIdx,
    judgeTotal: judgeProblems.length,
    judgeQuestionView,
    judgePick,
    judgeVerdict,
    judgeCorrectCount: judgeResults.length - judgeWrongCount,
    judgeWrongCount,
    pickJudgeAnswer,
    submitJudgeProblem,
    nextJudgeProblem,
    nextStageLabel,
    advanceAfterMatch,
    advanceStage,
    sortStage,
    sortStepViews,
    sortAttempts,
    sortMaxAttempts,
    sortRevealed,
    sortSubmitted: sortResults !== null,
    sortWrongCount,
    correctOrderHint,
    moveStep,
    submitSort,
    finishLevel,
    resultDeltas,
    chapterScore,
    scoreBreakdown,
    newReviewTerms,
    saving,
    saveError,
    goHome,
    termCard,
    openTermCard,
    closeTermCard,
    chapterState,
  }
}
