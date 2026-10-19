import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { getPocketBaseUrl } from "@/lib/pb"
import { loadTerms, type TermDef } from "@/content/loader"
import {
  CATEGORY_LIST,
  JUDGE_OPTIONS,
  PAPER_SIZES,
  TIER_ORDER,
  TYPE_LABELS,
  loadInterviewBanks,
  loadInterviewIndex,
  pickPaper,
  type InterviewBank,
  type InterviewCategory,
  type InterviewQuestion,
  type PaperSizeId,
  type TierId,
} from "@/content/interview"
import {
  SHORT_RATINGS,
  isObjective,
  judgeObjective,
  rankForScore,
  scorePaper,
  wrongTermIds,
  type AnswerRecord,
  type PaperScore,
  type ShortRatingId,
} from "@/game/interview"
import { addStudyDay } from "@/game/streak"
import type { InterviewHistoryEntry, ProgressRecord } from "@/content/chapters"

function progressApi(): string {
  return `${getPocketBaseUrl()}/api/player_progress`
}

/** 本地日期时间串 YYYY-MM-DD HH:mm（存档用，不用 UTC） */
function localStamp(now: number): string {
  const d = new Date(now)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export type InterviewPhase = "compose" | "paper" | "result"

export function useInterview() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saveError, setSaveError] = useState("")
  const [banks, setBanks] = useState<InterviewBank[]>([])
  const [rankTexts, setRankTexts] = useState<Record<string, string>>({})
  const [terms, setTerms] = useState<Record<string, TermDef>>({})

  const [recordId, setRecordId] = useState("")
  const [reviewQueue, setReviewQueue] = useState<string[]>([])
  const [studyDays, setStudyDays] = useState<string[]>([])
  const [interviewHistory, setInterviewHistory] = useState<InterviewHistoryEntry[]>([])

  const [phase, setPhase] = useState<InterviewPhase>("compose")
  // 组卷设置
  const [tier, setTier] = useState<TierId>("campus")
  const [categories, setCategories] = useState<Record<InterviewCategory, boolean>>(() => {
    const all: Record<string, boolean> = {}
    for (const c of CATEGORY_LIST) all[c] = true
    return all as Record<InterviewCategory, boolean>
  })
  const [paperSize, setPaperSize] = useState<PaperSizeId>("quick")
  // 答卷状态
  const [paper, setPaper] = useState<InterviewQuestion[]>([])
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [judged, setJudged] = useState(false)
  const [judgedCorrect, setJudgedCorrect] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [termCardId, setTermCardId] = useState<string | null>(null)
  // 结算
  const [result, setResult] = useState<PaperScore | null>(null)
  const [newReviewTerms, setNewReviewTerms] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        const [idxData, bankList, termMap, listRes] = await Promise.all([
          loadInterviewIndex(),
          loadInterviewBanks(),
          loadTerms(),
          fetch(progressApi()),
        ])
        if (cancelled) return
        setRankTexts(idxData.rankTexts ?? {})
        setBanks(bankList)
        setTerms(termMap)
        if (listRes.ok) {
          const data = await listRes.json()
          const items = Array.isArray(data?.items) ? data.items : []
          const rec = items[0] as (Partial<ProgressRecord> & { id?: string }) | undefined
          if (rec) {
            setRecordId(String(rec.id))
            setReviewQueue(Array.isArray(rec.review_queue) ? rec.review_queue : [])
            setStudyDays(Array.isArray(rec.study_days) ? rec.study_days : [])
            setInterviewHistory(Array.isArray(rec.interview_history) ? rec.interview_history : [])
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "面试题库加载失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const activeBank = useMemo(() => banks.find((b) => b.tier === tier) ?? null, [banks, tier])

  /** 当前档位+分类勾选下的候选题 */
  const candidates = useMemo(() => {
    if (!activeBank) return []
    return activeBank.questions.filter((q) => categories[q.category])
  }, [activeBank, categories])

  const composeView = useMemo(() => {
    const tierViews = banks.map((b) => {
      const matchCount = b.questions.filter((q) => categories[q.category]).length
      const view = { tier: b.tier, tierName: b.tierName, tierHint: b.tierHint, total: b.questions.length, matchCount }
      return view
    })
    // 固定档位顺序，防止题库加载顺序影响展示
    tierViews.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))
    const categoryViews = CATEGORY_LIST.map((c) => {
      const count = activeBank ? activeBank.questions.filter((q) => q.category === c).length : 0
      const view = { id: c, checked: categories[c], count }
      return view
    })
    const sizeViews = PAPER_SIZES.map((s) => {
      const view = { id: s.id, label: s.label, count: s.count, disabled: s.count > 0 && s.count > candidates.length && candidates.length > 0 }
      return view
    })
    const chosenSize = PAPER_SIZES.find((s) => s.id === paperSize) ?? PAPER_SIZES[0]
    const willTake = chosenSize.count > 0 ? Math.min(chosenSize.count, candidates.length) : candidates.length
    const view = { tierViews, categoryViews, sizeViews, candidateCount: candidates.length, willTake, practiced: interviewHistory.length }
    return view
  }, [banks, categories, activeBank, candidates, paperSize, interviewHistory])

  const toggleCategory = useCallback((c: InterviewCategory) => {
    setCategories((prev) => {
      const next = { ...prev, [c]: !prev[c] }
      // 至少留一个分类，全取消等于没得做
      if (CATEGORY_LIST.every((k) => !next[k])) return prev
      return next
    })
  }, [])

  const startPaper = useCallback(() => {
    if (candidates.length === 0) return
    const chosenSize = PAPER_SIZES.find((s) => s.id === paperSize) ?? PAPER_SIZES[0]
    setPaper(pickPaper(candidates, chosenSize.count))
    setIdx(0)
    setAnswers([])
    setSelected([])
    setJudged(false)
    setJudgedCorrect(false)
    setRevealed(false)
    setResult(null)
    setSaveError("")
    setPhase("paper")
  }, [candidates, paperSize])

  const current = paper[idx] ?? null

  const pickOption = useCallback(
    (optionId: string) => {
      if (!current || judged) return
      if (current.type === "multiple") {
        setSelected((prev) => (prev.includes(optionId) ? prev.filter((x) => x !== optionId) : [...prev, optionId]))
      } else {
        setSelected([optionId])
      }
    },
    [current, judged],
  )

  const submitObjective = useCallback(() => {
    if (!current || judged || selected.length === 0) return
    const given = current.type === "multiple" ? [...selected] : selected[0]
    const correct = judgeObjective(current, given)
    setAnswers((prev) => [...prev.filter((a) => a.questionId !== current.id), { questionId: current.id, given }])
    setJudgedCorrect(correct)
    setJudged(true)
  }, [current, judged, selected])

  const revealReference = useCallback(() => {
    if (!current || current.type !== "short") return
    setRevealed(true)
  }, [current])

  const finishPaper = useCallback(
    (finalAnswers: AnswerRecord[]) => {
      const paperResult = scorePaper(paper, finalAnswers)
      const wrongTerms = wrongTermIds(paperResult)
      const nextQueue = [...reviewQueue, ...wrongTerms.filter((t) => !reviewQueue.includes(t))]
      const nextDays = addStudyDay(studyDays, Date.now())
      const entry: InterviewHistoryEntry = {
        at: localStamp(Date.now()),
        tier,
        score: paperResult.score,
        total: paperResult.total,
      }
      const nextHistory = [...interviewHistory, entry]
      setResult(paperResult)
      setNewReviewTerms(wrongTerms)
      setReviewQueue(nextQueue)
      setStudyDays(nextDays)
      setInterviewHistory(nextHistory)
      setPhase("result")
      if (recordId) {
        void fetch(`${progressApi()}/${recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ review_queue: nextQueue, study_days: nextDays, interview_history: nextHistory }),
        })
          .then((r) => {
            if (!r.ok) setSaveError("练习记录保存失败，回首页重试一次即可。")
          })
          .catch(() => setSaveError("练习记录保存失败（网络问题），本次成绩只在本地生效。"))
      } else {
        setSaveError("存档还没就绪，这次成绩只在本地生效。")
      }
    },
    [paper, reviewQueue, studyDays, interviewHistory, recordId, tier],
  )

  const rateShort = useCallback(
    (rating: ShortRatingId) => {
      if (!current || current.type !== "short" || !revealed) return
      const nextAnswers = [...answers.filter((a) => a.questionId !== current.id), { questionId: current.id, shortRating: rating }]
      setAnswers(nextAnswers)
      if (idx + 1 >= paper.length) {
        finishPaper(nextAnswers)
        return
      }
      setIdx(idx + 1)
      setSelected([])
      setJudged(false)
      setJudgedCorrect(false)
      setRevealed(false)
    },
    [current, revealed, answers, idx, paper, finishPaper],
  )

  const nextQuestion = useCallback(() => {
    if (!current || !judged) return
    if (idx + 1 >= paper.length) {
      finishPaper(answers)
      return
    }
    setIdx(idx + 1)
    setSelected([])
    setJudged(false)
    setJudgedCorrect(false)
    setRevealed(false)
  }, [current, judged, idx, paper, answers, finishPaper])

  const backToCompose = useCallback(() => {
    setPhase("compose")
    setPaper([])
    setIdx(0)
    setAnswers([])
    setResult(null)
  }, [])

  const questionView = useMemo(() => {
    if (!current) return null
    const bank = activeBank
    const options = current.type === "judge" ? JUDGE_OPTIONS : current.options
    const view = {
      question: current,
      typeLabel: TYPE_LABELS[current.type],
      tierName: bank?.tierName ?? "",
      index: idx,
      total: paper.length,
      options,
      selected,
      judged,
      judgedCorrect,
      revealed,
      isShort: current.type === "short",
      objective: isObjective(current),
      canSubmit: selected.length > 0 && !judged,
      isLast: idx + 1 >= paper.length,
    }
    return view
  }, [current, activeBank, idx, paper, selected, judged, judgedCorrect, revealed])

  const resultView = useMemo(() => {
    if (!result) return null
    const rank = rankForScore(result.score)
    const bank = banks.find((b) => b.tier === tier)
    const view = {
      score: result.score,
      rank,
      rankText: rankTexts[rank] ?? "",
      tierName: bank?.tierName ?? "",
      objectiveTotal: result.objectiveTotal,
      objectiveCorrect: result.objectiveCorrect,
      shortTotal: result.shortTotal,
      perQuestion: result.perQuestion,
      newReviewTerms,
      practiced: interviewHistory.length,
    }
    return view
  }, [result, rankTexts, banks, tier, newReviewTerms, interviewHistory])

  const termCard = termCardId ? terms[termCardId] ?? null : null
  const openTermCard = useCallback((id: string) => setTermCardId(id), [])
  const closeTermCard = useCallback(() => setTermCardId(null), [])
  const goHome = useCallback(() => navigate("/"), [navigate])

  return {
    loading,
    loadError,
    saveError,
    phase,
    terms,
    tier,
    setTier,
    categories,
    toggleCategory,
    paperSize,
    setPaperSize,
    composeView,
    startPaper,
    questionView,
    pickOption,
    submitObjective,
    revealReference,
    rateShort,
    shortRatings: SHORT_RATINGS,
    nextQuestion,
    backToCompose,
    resultView,
    termCard,
    openTermCard,
    closeTermCard,
    goHome,
  }
}
