import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { pbFetch, getPocketBaseUrl } from "@/lib/pb"
import {
  CAREER_TRACK_ORDER,
  loadCareerIndex,
  loadCareerTracks,
  type CareerIndex,
  type CareerPaperSize,
  type CareerQuestion,
  type CareerTrack,
} from "@/content/careerPrep"
import {
  buildCareerPaper,
  careerRank,
  judgeCareerQuestion,
  scoreCareerPaper,
  wrongCareerTermIds,
  type CareerPaper,
  type CareerPaperScore,
} from "@/game/careerPrep"
import { addStudyDay } from "@/game/streak"
import type { ProgressRecord } from "@/content/chapters"
import { loadTerms, type TermDef } from "@/content/loader"

function progressApi(): string {
  return `${getPocketBaseUrl()}/api/player_progress`
}

/** 本地日期时间串 YYYY-MM-DD HH:mm（与其它训练营一致） */
function localStamp(now: number): string {
  const d = new Date(now)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export type CareerPhase = "select" | "track" | "quiz" | "order" | "result"

export interface CareerTrackView {
  id: string
  name: string
  hint: string
  cardCount: number
  questionCount: number
  orderCount: number
  /** 该赛道历史最好成绩（0~100），没有记录时为 0 */
  best: number
  attempts: number
}

export interface CareerQuestionView {
  index: number
  total: number
  question: CareerQuestion
  options: CareerQuestion["options"]
  selected: string[]
  judged: boolean
  judgedCorrect: boolean
}

export interface CareerResultView {
  score: number
  total: number
  rank: "S" | "A" | "B" | "C"
  rankText: string
  objectiveCorrect: number
  objectiveTotal: number
  orderCorrect: boolean
  perQuestion: CareerPaperScore["perQuestion"]
  orderVerdict: CareerPaperScore["orderVerdict"]
  orderTitle: string
  orderSteps: Array<{ id: string; text: string; note: string }>
  newReviewTerms: string[]
}

export function useCareerPrep() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saveError, setSaveError] = useState("")
  const [index, setIndex] = useState<CareerIndex | null>(null)
  const [tracks, setTracks] = useState<CareerTrack[]>([])
  const [terms, setTerms] = useState<Record<string, TermDef>>({})
  const [phase, setPhase] = useState<CareerPhase>("select")
  const [trackId, setTrackId] = useState("")
  const [sizeId, setSizeId] = useState("standard")
  const [paper, setPaper] = useState<CareerPaper | null>(null)
  const [answers, setAnswers] = useState<Map<string, string | string[]>>(new Map())
  const [selected, setSelected] = useState<string[]>([])
  const [judged, setJudged] = useState(false)
  const [judgedCorrect, setJudgedCorrect] = useState(false)
  const [idx, setIdx] = useState(0)
  const [orderPick, setOrderPick] = useState<string[]>([])
  const [result, setResult] = useState<CareerResultView | null>(null)
  const [recordId, setRecordId] = useState("")
  const [reviewQueue, setReviewQueue] = useState<string[]>([])
  const [studyDays, setStudyDays] = useState<string[]>([])
  const [careerHistory, setCareerHistory] = useState<Array<{ at: string; track: string; score: number; total: number }>>([])
  const [termCard, setTermCard] = useState<TermDef | null>(null)

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        const idxData = await loadCareerIndex()
        const [trackList, termMap, listRes] = await Promise.all([
          loadCareerTracks(idxData),
          loadTerms(),
          pbFetch(progressApi()),
        ])
        if (cancelled) return
        setIndex(idxData)
        setTracks(trackList)
        setTerms(termMap)
        if (listRes.ok) {
          const data = await listRes.json()
          const items = Array.isArray(data?.items) ? data.items : []
          const rec = items[0] as (Partial<ProgressRecord> & { id?: string }) | undefined
          if (rec) {
            setRecordId(String(rec.id))
            setReviewQueue(Array.isArray(rec.review_queue) ? rec.review_queue : [])
            setStudyDays(Array.isArray(rec.study_days) ? rec.study_days : [])
            setCareerHistory(Array.isArray(rec.career_history) ? rec.career_history : [])
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "实习准备营内容加载失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const activeTrack = useMemo(() => tracks.find((t) => t.trackId === trackId) ?? null, [tracks, trackId])

  const trackViews = useMemo<CareerTrackView[]>(() => {
    const entryById = new Map((index?.tracks ?? []).map((t) => [t.id, t]))
    const out: CareerTrackView[] = []
    for (const id of CAREER_TRACK_ORDER) {
      const track = tracks.find((t) => t.trackId === id)
      if (!track) continue
      const entry = entryById.get(id)
      const hist = careerHistory.filter((h) => h.track === id)
      out.push({
        id,
        name: entry?.name ?? track.trackName,
        hint: entry?.hint ?? track.subtitle,
        cardCount: track.cards.length,
        questionCount: track.questions.length,
        orderCount: (track.orders ?? []).length,
        best: hist.length > 0 ? Math.max(...hist.map((h) => h.score)) : 0,
        attempts: hist.length,
      })
    }
    return out
  }, [tracks, index, careerHistory])

  const paperSizes = useMemo<CareerPaperSize[]>(() => index?.paperSizes ?? [], [index])
  const activeSize = useMemo<CareerPaperSize>(
    () =>
      paperSizes.find((s) => s.id === sizeId) ??
      paperSizes[0] ??
      { id: "standard", label: "标准卷", questionCount: 10, orderCount: 1 },
    [paperSizes, sizeId],
  )

  const current = paper?.questions[idx] ?? null

  const chooseTrack = useCallback((id: string) => {
    setTrackId(id)
    setPhase("track")
    setResult(null)
  }, [])

  const startPaper = useCallback(() => {
    if (!activeTrack) return
    const built = buildCareerPaper(activeTrack, activeSize.questionCount, activeSize.orderCount)
    setPaper(built)
    setAnswers(new Map())
    setSelected([])
    setJudged(false)
    setJudgedCorrect(false)
    setIdx(0)
    setOrderPick([])
    setResult(null)
    setPhase("quiz")
  }, [activeTrack, activeSize])

  const pickOption = useCallback(
    (optionId: string) => {
      if (judged || !current) return
      if (current.type === "multiple") {
        setSelected((prev) => (prev.includes(optionId) ? prev.filter((x) => x !== optionId) : [...prev, optionId]))
        return
      }
      setSelected([optionId])
    },
    [judged, current],
  )

  const submitAnswer = useCallback(() => {
    if (judged || !current) return
    const given = current.type === "multiple" ? selected : selected[0]
    if (given === undefined || (Array.isArray(given) && given.length === 0)) return
    const next = new Map(answers)
    next.set(current.id, given)
    setAnswers(next)
    setJudgedCorrect(judgeCareerQuestion(current, given))
    setJudged(true)
  }, [judged, current, selected, answers])

  const finishPaper = useCallback(
    (finalAnswers: Map<string, string | string[]>, finalOrder: string[] | null) => {
      if (!paper) return
      const scored = scoreCareerPaper(paper, finalAnswers, finalOrder)
      const rank = careerRank(scored.score)
      const wrongTerms = wrongCareerTermIds(scored)
      const nextQueue = [...reviewQueue, ...wrongTerms.filter((t) => !reviewQueue.includes(t))]
      const nextDays = addStudyDay(studyDays, Date.now())
      const entry = { at: localStamp(Date.now()), track: trackId, score: scored.score, total: scored.total }
      const nextHistory = [...careerHistory, entry]
      setResult({
        score: scored.score,
        total: scored.total,
        rank,
        rankText: index?.rankTexts?.[rank] ?? "",
        objectiveCorrect: scored.objectiveCorrect,
        objectiveTotal: scored.objectiveTotal,
        orderCorrect: scored.orderCorrect,
        perQuestion: scored.perQuestion,
        orderVerdict: scored.orderVerdict,
        orderTitle: paper.order?.title ?? "",
        orderSteps: paper.order?.steps ?? [],
        newReviewTerms: wrongTerms,
      })
      setReviewQueue(nextQueue)
      setStudyDays(nextDays)
      setCareerHistory(nextHistory)
      setPhase("result")
      if (recordId) {
        void pbFetch(`${progressApi()}/${recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            review_queue: nextQueue,
            study_days: nextDays,
            career_history: nextHistory,
          }),
        })
          .then((r) => {
            if (!r.ok) setSaveError("练习记录保存失败，回首页重试一次即可。")
          })
          .catch(() => setSaveError("练习记录保存失败（网络问题），本次成绩只在本地生效。"))
      } else {
        setSaveError("存档还没就绪，这次成绩只在本地生效。")
      }
    },
    [paper, reviewQueue, studyDays, careerHistory, trackId, index, recordId],
  )

  const nextQuestion = useCallback(() => {
    if (!paper || !current || !judged) return
    if (idx + 1 >= paper.questions.length) {
      if (paper.order) {
        setOrderPick([])
        setPhase("order")
      } else {
        finishPaper(answers, null)
      }
      return
    }
    setIdx(idx + 1)
    setSelected([])
    setJudged(false)
    setJudgedCorrect(false)
  }, [paper, current, judged, idx, answers, finishPaper])

  const addOrderStep = useCallback((stepId: string) => {
    setOrderPick((prev) => (prev.includes(stepId) ? prev : [...prev, stepId]))
  }, [])

  const removeOrderStep = useCallback((stepId: string) => {
    setOrderPick((prev) => prev.filter((x) => x !== stepId))
  }, [])

  const submitOrder = useCallback(() => {
    if (!paper?.order) return
    if (orderPick.length !== paper.order.steps.length) return
    finishPaper(answers, orderPick)
  }, [paper, orderPick, answers, finishPaper])

  const backToSelect = useCallback(() => {
    setPhase("select")
    setTrackId("")
    setPaper(null)
    setResult(null)
  }, [])

  const backToTrack = useCallback(() => {
    setPhase("track")
    setPaper(null)
    setResult(null)
  }, [])

  const retrySameTrack = useCallback(() => {
    setResult(null)
    setPhase("track")
  }, [])

  const goHome = useCallback(() => {
    navigate("/")
  }, [navigate])

  const openTermCard = useCallback(
    (termId: string) => {
      const t = terms[termId]
      if (t) setTermCard(t)
    },
    [terms],
  )

  const closeTermCard = useCallback(() => setTermCard(null), [])

  const questionView: CareerQuestionView | null = useMemo(() => {
    if (!current) return null
    return {
      index: idx,
      total: paper?.questions.length ?? 0,
      question: current,
      options: current.options,
      selected,
      judged,
      judgedCorrect,
    }
  }, [current, idx, paper, selected, judged, judgedCorrect])

  return {
    loading,
    loadError,
    saveError,
    phase,
    trackId,
    trackViews,
    paperSizes,
    activeSize,
    activeTrack,
    questionView,
    orderPick,
    orderTitle: paper?.order?.title ?? "",
    orderIntro: paper?.order?.intro ?? "",
    orderSteps: paper?.order?.steps ?? [],
    result,
    terms,
    termCard,
    historyCount: careerHistory.length,
    chooseTrack,
    startPaper,
    pickOption,
    submitAnswer,
    nextQuestion,
    addOrderStep,
    removeOrderStep,
    submitOrder,
    backToSelect,
    backToTrack,
    retrySameTrack,
    goHome,
    setSizeId,
    openTermCard,
    closeTermCard,
  }
}
