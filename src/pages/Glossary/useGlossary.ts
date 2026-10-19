import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { getPocketBaseUrl } from "@/lib/pb"
import { loadTerms, type TermDef } from "@/content/loader"
import { dueTerms, masteryLabel, nextDueLabel, rateTerm, type Rating, type ReviewState } from "@/game/srs"
import { addStudyDay, computeStreak } from "@/game/streak"

function progressApi(): string {
  return `${getPocketBaseUrl()}/api/player_progress`
}

/** 知识域展示名：knowledge_id 前缀 → 实施阶段（与章节主线对应） */
const KNOWLEDGE_DOMAINS: Record<string, string> = {
  K0: "数据意识",
  K1: "调研与认知",
  K2: "静态数据与脏数据",
  K3: "建模与配置",
  K4: "执行与报工",
  K5: "质量与库存",
  K6: "上线陪产",
  K7: "厂型认知",
}

export type GlossaryMode = "browse" | "review" | "done"

export function useGlossary() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [terms, setTerms] = useState<Record<string, TermDef>>({})
  const [recordId, setRecordId] = useState("")
  const [reviewState, setReviewState] = useState<Record<string, ReviewState>>({})
  const [reviewQueue, setReviewQueue] = useState<string[]>([])
  const [studyDays, setStudyDays] = useState<string[]>([])
  const [saveError, setSaveError] = useState("")

  const [mode, setMode] = useState<GlossaryMode>("browse")
  // 复习会话
  const [sessionQueue, setSessionQueue] = useState<string[]>([])
  const [sessionIdx, setSessionIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [ratedCount, setRatedCount] = useState(0)
  const [termCardId, setTermCardId] = useState<string | null>(null)

  const persist = useCallback(
    (nextState: Record<string, ReviewState>, nextQueue: string[]) => {
      if (!recordId) {
        setSaveError("存档还没就绪，这次复习进度只在本地生效。")
        return
      }
      void fetch(`${progressApi()}/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_state: nextState, review_queue: nextQueue }),
      })
        .then((r) => {
          if (!r.ok) setSaveError("复习进度保存失败，回首页重试一次即可。")
        })
        .catch(() => setSaveError("复习进度保存失败（网络问题），本次调度只在本地生效。"))
    },
    [recordId],
  )

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        const [termMap, listRes] = await Promise.all([loadTerms(), fetch(progressApi())])
        if (cancelled) return
        setTerms(termMap)
        if (listRes.ok) {
          const data = await listRes.json()
          const items = Array.isArray(data?.items) ? data.items : []
          const rec = items[0]
          if (rec) {
            setRecordId(String(rec.id))
            setReviewState(rec.review_state && typeof rec.review_state === "object" ? rec.review_state : {})
            setReviewQueue(Array.isArray(rec.review_queue) ? rec.review_queue : [])
            setStudyDays(Array.isArray(rec.study_days) ? rec.study_days : [])
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "术语卡加载失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  // 到期复习队列（浏览页角标 + 开始复习用）
  const dueList = useMemo(() => dueTerms(reviewState, reviewQueue, Date.now()), [reviewState, reviewQueue])

  // 浏览网格视图
  const cardViews = useMemo(() => {
    const list = Object.values(terms)
    const views = list.map((t) => {
      const st = reviewState[t.id]
      const level = st?.level ?? 0
      const mastery = masteryLabel(st ? level : reviewQueue.includes(t.id) ? 0 : -1)
      const view = {
        id: t.id,
        term: t.term,
        dialect: t.dialect,
        knowledge_id: t.knowledge_id,
        level: st ? level : -1,
        masteryLabel: st ? mastery.label : reviewQueue.includes(t.id) ? "待复习" : "未学",
        masteryTone: st ? mastery.tone : reviewQueue.includes(t.id) ? ("mid" as const) : ("none" as const),
        dueLabel: st ? nextDueLabel(st, Date.now()) : "",
        inQueue: reviewQueue.includes(t.id),
      }
      return view
    })
    // 待复习/不熟的排前面，已掌握的沉底
    const order = { bad: 0, mid: 1, none: 2, good: 3 } as const
    views.sort((a, b) => {
      const ta = a.masteryTone === "none" ? (a.inQueue ? 0 : 2) : order[a.masteryTone]
      const tb = b.masteryTone === "none" ? (b.inQueue ? 0 : 2) : order[b.masteryTone]
      return ta - tb
    })
    return views
  }, [terms, reviewState, reviewQueue])

  const stats = useMemo(() => {
    const mastered = cardViews.filter((c) => c.level >= 5).length
    const learning = cardViews.filter((c) => c.level > 0 && c.level < 5).length
    const fresh = cardViews.length - mastered - learning
    const view = { total: cardViews.length, mastered, learning, fresh, due: dueList.length }
    return view
  }, [cardViews, dueList])

  // 知识点地图：按 knowledge_id 前缀分域统计掌握进度
  const knowledgeGroups = useMemo(() => {
    const groups: Record<string, { code: string; domain: string; total: number; mastered: number; learning: number }> = {}
    for (const t of Object.values(terms)) {
      const code = t.knowledge_id.split("-")[0] || "K0"
      let g = groups[code]
      if (!g) {
        const created = { code, domain: KNOWLEDGE_DOMAINS[code] ?? code, total: 0, mastered: 0, learning: 0 }
        groups[code] = created
        g = created
      }
      g.total++
      const st = reviewState[t.id]
      if (st && st.level >= 3) g.mastered++
      else if (st && st.level > 0) g.learning++
    }
    const list = Object.values(groups).sort((a, b) => a.code.localeCompare(b.code))
    return list
  }, [terms, reviewState])

  const streak = computeStreak(studyDays, Date.now())

  const startReview = useCallback(() => {
    if (dueList.length === 0) return
    setSessionQueue([...dueList])
    setSessionIdx(0)
    setFlipped(false)
    setRatedCount(0)
    setMode("review")
  }, [dueList])

  const currentTermId = sessionQueue[sessionIdx] ?? ""
  const currentTerm = terms[currentTermId] ?? null

  // 四档自评按钮上的「下次复习」预览
  const ratingPreviews = useMemo(() => {
    if (!currentTermId) {
      const empty = { again: "", hard: "", good: "", easy: "" }
      return empty
    }
    const now = Date.now()
    const cur = reviewState[currentTermId]
    const preview = {
      again: nextDueLabel(rateTerm(cur, "again", now), now),
      hard: nextDueLabel(rateTerm(cur, "hard", now), now),
      good: nextDueLabel(rateTerm(cur, "good", now), now),
      easy: nextDueLabel(rateTerm(cur, "easy", now), now),
    }
    return preview
  }, [currentTermId, reviewState])

  const flipCard = useCallback(() => setFlipped(true), [])

  const rateCurrent = useCallback(
    (rating: Rating) => {
      if (!currentTermId || !flipped) return
      const now = Date.now()
      const nextState = { ...reviewState, [currentTermId]: rateTerm(reviewState[currentTermId], rating, now) }
      // 评过级就从「标记不熟」队列毕业，之后由调度器管到期
      const nextQueue = reviewQueue.filter((tid) => tid !== currentTermId)
      setReviewState(nextState)
      setReviewQueue(nextQueue)
      persist(nextState, nextQueue)
      setRatedCount((n) => n + 1)
      // 「忘了」的卡本次会话末尾重新入队（Anki 学习步骤）
      let nextQueueSession = sessionQueue
      if (rating === "again") {
        nextQueueSession = [...sessionQueue, currentTermId]
        setSessionQueue(nextQueueSession)
      }
      if (sessionIdx + 1 >= nextQueueSession.length) {
        // 复习完成 = 今日打卡
        const nextDays = addStudyDay(studyDays, Date.now())
        setStudyDays(nextDays)
        if (recordId) {
          void fetch(`${progressApi()}/${recordId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ study_days: nextDays }),
          }).catch(() => {})
        }
        setMode("done")
        return
      }
      setSessionIdx(sessionIdx + 1)
      setFlipped(false)
    },
    [currentTermId, flipped, reviewState, reviewQueue, persist, sessionQueue, sessionIdx, studyDays, recordId],
  )

  const markUnknown = useCallback(
    (termId: string) => {
      if (reviewQueue.includes(termId)) return
      const nextQueue = [...reviewQueue, termId]
      setReviewQueue(nextQueue)
      persist(reviewState, nextQueue)
    },
    [reviewQueue, reviewState, persist],
  )

  const backToBrowse = useCallback(() => {
    setMode("browse")
    setSessionQueue([])
    setSessionIdx(0)
    setFlipped(false)
  }, [])

  const openTermCard = useCallback((termId: string) => setTermCardId(termId), [])
  const closeTermCard = useCallback(() => setTermCardId(null), [])
  const goHome = useCallback(() => navigate("/"), [navigate])

  const termCard = termCardId ? terms[termCardId] ?? null : null
  const nextDueSummary = useMemo(() => {
    if (mode !== "done") return ""
    const upcoming = Object.values(reviewState)
      .map((s) => s.dueAt)
      .filter((d) => d > Date.now())
      .sort((a, b) => a - b)
    if (upcoming.length === 0) return "暂时没有到期的卡，标记几张「不熟」再来"
    return nextDueLabel({ level: 0, dueAt: upcoming[0], lastRatedAt: 0 }, Date.now())
  }, [mode, reviewState])

  return {
    loading,
    loadError,
    saveError,
    mode,
    stats,
    streak,
    knowledgeGroups,
    cardViews,
    dueList,
    startReview,
    currentTerm,
    sessionIdx,
    sessionTotal: sessionQueue.length,
    flipped,
    ratingPreviews,
    ratedCount,
    flipCard,
    rateCurrent,
    markUnknown,
    backToBrowse,
    termCard,
    openTermCard,
    closeTermCard,
    nextDueSummary,
    goHome,
  }
}
