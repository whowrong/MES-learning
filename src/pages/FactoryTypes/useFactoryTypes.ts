import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { pbFetch, getPocketBaseUrl } from "@/lib/pb"
import { loadTerms, type TermDef } from "@/content/loader"
import {
  FACTORY_TYPE_ORDER,
  loadFactoryBanks,
  loadFactoryIndex,
  pickFactoryQuiz,
  type FactoryBank,
  type FactoryQuizQuestion,
  type FactoryTypeId,
} from "@/content/factoryTypes"
import {
  factoryWrongTermIds,
  rankForScore,
  scoreFactoryQuiz,
  type FactoryAnswerRecord,
  type FactoryQuizResult,
} from "@/game/factory"
import { addStudyDay } from "@/game/streak"
import type { FactoryHistoryEntry, ProgressRecord } from "@/content/chapters"

function progressApi(): string {
  return `${getPocketBaseUrl()}/api/player_progress`
}

/** 本地日期时间串 YYYY-MM-DD HH:mm（存档用，不用 UTC） */
function localStamp(now: number): string {
  const d = new Date(now)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export type FactoryPhase = "select" | "dossier" | "quiz" | "result"

export function useFactoryTypes() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saveError, setSaveError] = useState("")
  const [banks, setBanks] = useState<FactoryBank[]>([])
  const [rankTexts, setRankTexts] = useState<Record<string, string>>({})
  const [terms, setTerms] = useState<Record<string, TermDef>>({})

  const [recordId, setRecordId] = useState("")
  const [reviewQueue, setReviewQueue] = useState<string[]>([])
  const [studyDays, setStudyDays] = useState<string[]>([])
  const [factoryHistory, setFactoryHistory] = useState<FactoryHistoryEntry[]>([])

  const [phase, setPhase] = useState<FactoryPhase>("select")
  const [currentType, setCurrentType] = useState<FactoryTypeId | null>(null)
  // 档案学习
  const [dossierIdx, setDossierIdx] = useState(0)
  // 测验作答
  const [paper, setPaper] = useState<FactoryQuizQuestion[]>([])
  const [qIdx, setQIdx] = useState(0)
  const [answers, setAnswers] = useState<FactoryAnswerRecord[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [judged, setJudged] = useState(false)
  const [judgedCorrect, setJudgedCorrect] = useState(false)
  const [termCardId, setTermCardId] = useState<string | null>(null)
  // 结算
  const [result, setResult] = useState<FactoryQuizResult | null>(null)
  const [newReviewTerms, setNewReviewTerms] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        const [idxData, bankList, termMap, listRes] = await Promise.all([
          loadFactoryIndex(),
          loadFactoryBanks(),
          loadTerms(),
          pbFetch(progressApi()),
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
            setFactoryHistory(Array.isArray(rec.factory_history) ? rec.factory_history : [])
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "厂型内容加载失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const activeBank = useMemo(() => banks.find((b) => b.type === currentType) ?? null, [banks, currentType])

  const selectView = useMemo(() => {
    const typeViews = banks.map((b) => {
      const trained = factoryHistory.filter((h) => h.type === b.type).length
      const view = {
        type: b.type,
        typeName: b.typeName,
        tagline: b.tagline,
        industries: b.industries,
        questionCount: b.quiz.questions.length,
        trained,
      }
      return view
    })
    typeViews.sort((a, b) => FACTORY_TYPE_ORDER.indexOf(a.type) - FACTORY_TYPE_ORDER.indexOf(b.type))
    const view = { typeViews, practiced: factoryHistory.length }
    return view
  }, [banks, factoryHistory])

  const chooseType = useCallback((type: FactoryTypeId) => {
    setCurrentType(type)
    setDossierIdx(0)
    setSaveError("")
    setPhase("dossier")
  }, [])

  const dossierView = useMemo(() => {
    if (!activeBank) return null
    const pages = activeBank.brief
    const page = pages[Math.min(dossierIdx, pages.length - 1)] ?? null
    const view = {
      typeName: activeBank.typeName,
      tagline: activeBank.tagline,
      page,
      pageIdx: dossierIdx,
      totalPages: pages.length,
      isFirst: dossierIdx <= 0,
      isLast: dossierIdx >= pages.length - 1,
    }
    return view
  }, [activeBank, dossierIdx])

  const dossierPrev = useCallback(() => setDossierIdx((i) => Math.max(0, i - 1)), [])
  const dossierNext = useCallback(() => setDossierIdx((i) => i + 1), [])

  const startQuiz = useCallback(() => {
    if (!activeBank) return
    setPaper(pickFactoryQuiz(activeBank.quiz.questions, activeBank.quiz.perRound))
    setQIdx(0)
    setAnswers([])
    setSelected(null)
    setJudged(false)
    setJudgedCorrect(false)
    setResult(null)
    setSaveError("")
    setPhase("quiz")
  }, [activeBank])

  const current = paper[qIdx] ?? null

  const pickOption = useCallback(
    (optionId: string) => {
      if (!current || judged) return
      setSelected(optionId)
    },
    [current, judged],
  )

  const finishQuiz = useCallback(
    (finalAnswers: FactoryAnswerRecord[]) => {
      const quizResult = scoreFactoryQuiz(paper, finalAnswers)
      const wrongTerms = factoryWrongTermIds(quizResult)
      const nextQueue = [...reviewQueue, ...wrongTerms.filter((t) => !reviewQueue.includes(t))]
      const nextDays = addStudyDay(studyDays, Date.now())
      const entry: FactoryHistoryEntry = {
        at: localStamp(Date.now()),
        type: currentType ?? "",
        score: quizResult.score,
        total: quizResult.total,
      }
      const nextHistory = [...factoryHistory, entry]
      setResult(quizResult)
      setNewReviewTerms(wrongTerms)
      setReviewQueue(nextQueue)
      setStudyDays(nextDays)
      setFactoryHistory(nextHistory)
      setPhase("result")
      if (recordId) {
        void pbFetch(`${progressApi()}/${recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ review_queue: nextQueue, study_days: nextDays, factory_history: nextHistory }),
        })
          .then((r) => {
            if (!r.ok) setSaveError("练习记录保存失败，回首页重试一次即可。")
          })
          .catch(() => setSaveError("练习记录保存失败（网络问题），本次成绩只在本地生效。"))
      } else {
        setSaveError("存档还没就绪，这次成绩只在本地生效。")
      }
    },
    [paper, reviewQueue, studyDays, factoryHistory, recordId, currentType],
  )

  const submitAnswer = useCallback(() => {
    if (!current || judged || !selected) return
    const correct = selected === current.answer
    setAnswers((prev) => [...prev.filter((a) => a.questionId !== current.id), { questionId: current.id, given: selected }])
    setJudgedCorrect(correct)
    setJudged(true)
  }, [current, judged, selected])

  const nextQuestion = useCallback(() => {
    if (!current || !judged) return
    if (qIdx + 1 >= paper.length) {
      finishQuiz(answers)
      return
    }
    setQIdx(qIdx + 1)
    setSelected(null)
    setJudged(false)
    setJudgedCorrect(false)
  }, [current, judged, qIdx, paper, answers, finishQuiz])

  const backToSelect = useCallback(() => {
    setPhase("select")
    setCurrentType(null)
    setPaper([])
    setQIdx(0)
    setAnswers([])
    setResult(null)
  }, [])

  const retrySameType = useCallback(() => {
    startQuiz()
  }, [startQuiz])

  const quizView = useMemo(() => {
    if (!current || !activeBank) return null
    const view = {
      question: current,
      typeName: activeBank.typeName,
      index: qIdx,
      total: paper.length,
      selected,
      judged,
      judgedCorrect,
      canSubmit: selected !== null && !judged,
      isLast: qIdx + 1 >= paper.length,
    }
    return view
  }, [current, activeBank, qIdx, paper, selected, judged, judgedCorrect])

  const resultView = useMemo(() => {
    if (!result || !activeBank) return null
    const rank = rankForScore(result.score)
    const view = {
      score: result.score,
      rank,
      rankText: rankTexts[rank] ?? "",
      typeName: activeBank.typeName,
      correctCount: result.correctCount,
      total: result.total,
      perQuestion: result.perQuestion,
      newReviewTerms,
      practiced: factoryHistory.length,
    }
    return view
  }, [result, rankTexts, activeBank, newReviewTerms, factoryHistory])

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
    selectView,
    chooseType,
    dossierView,
    dossierPrev,
    dossierNext,
    startQuiz,
    quizView,
    pickOption,
    submitAnswer,
    nextQuestion,
    backToSelect,
    retrySameType,
    resultView,
    termCard,
    openTermCard,
    closeTermCard,
    goHome,
  }
}
