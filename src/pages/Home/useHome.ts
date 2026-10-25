import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { pbFetch, getPocketBaseUrl } from "@/lib/pb"
import {
  CHAPTERS,
  GAUGE_DEFS,
  buildDefaultProgress,
  type ChapterDef,
  type ChapterState,
  type GaugeValue,
  type ProgressRecord,
} from "@/content/chapters"
import { computeStreak } from "@/game/streak"

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
    interview_history: Array.isArray(raw.interview_history) ? raw.interview_history : [],
    factory_history: Array.isArray(raw.factory_history) ? raw.factory_history : [],
    ops_history: Array.isArray(raw.ops_history) ? raw.ops_history : [],
    db_history: Array.isArray(raw.db_history) ? raw.db_history : [],
    last_route: raw.last_route ?? "/home",
  }
  return normalized
}

export function useHome() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [recordId, setRecordId] = useState("")
  const [chapterState, setChapterState] = useState<Record<string, ChapterState>>({})
  const [gauges, setGauges] = useState<Record<string, GaugeValue>>({})
  const [reviewCount, setReviewCount] = useState(0)
  const [studyDays, setStudyDays] = useState<string[]>([])
  const [interviewCount, setInterviewCount] = useState(0)
  const [factoryCount, setFactoryCount] = useState(0)
  const [opsCount, setOpsCount] = useState(0)
  const [dbCount, setDbCount] = useState(0)
  // 锁定章节提示弹窗（点未开放章节卡时）
  const [lockedChapter, setLockedChapter] = useState<ChapterDef | null>(null)
  // 施工中占位弹窗（目标页面尚未上线时，避免跳白屏）
  const [constructionNote, setConstructionNote] = useState<{ title: string; body: string } | null>(null)

  const applyRecord = useCallback((rec: ProgressRecord) => {
    setChapterState(rec.chapter_status)
    setGauges(rec.gauges)
    setReviewCount(rec.review_queue.length)
    setStudyDays(rec.study_days ?? [])
    setInterviewCount((rec.interview_history ?? []).length)
    setFactoryCount((rec.factory_history ?? []).length)
    setOpsCount((rec.ops_history ?? []).length)
    setDbCount((rec.db_history ?? []).length)
    if (rec.id) setRecordId(rec.id)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadProgress() {
      const fallback = buildDefaultProgress()
      try {
        const listRes = await pbFetch(progressApi())
        if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`)
        const listData = await listRes.json()
        const items: Array<Partial<ProgressRecord> & { id?: string }> = Array.isArray(listData?.items)
          ? listData.items
          : []
        if (items.length > 0) {
          if (!cancelled) applyRecord(normalizeRecord(items[0]))
          return
        }
        // 无存档：创建默认进度
        const createRes = await pbFetch(progressApi(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fallback),
        })
        if (!createRes.ok) throw new Error(`HTTP ${createRes.status}`)
        const created = await createRes.json()
        if (!cancelled) applyRecord(normalizeRecord({ ...fallback, id: created?.id ?? created?.record?.id }))
      } catch {
        // 存档读取失败不阻塞首页：用默认值展示，给出可重试提示
        if (!cancelled) {
          applyRecord(fallback)
          setLoadError("存档读取失败，当前按新游戏展示；点击右上角按钮可重试。")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadProgress()
    return () => {
      cancelled = true
    }
  }, [applyRecord])

  const retryLoad = useCallback(async () => {
    setLoadError("")
    setLoading(true)
    try {
      const res = await pbFetch(progressApi())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const items: Array<Partial<ProgressRecord> & { id?: string }> = Array.isArray(data?.items) ? data.items : []
      if (items.length > 0) applyRecord(normalizeRecord(items[0]))
    } catch {
      setLoadError("存档还是读不出来，稍后再试；不影响先看章节地图。")
    } finally {
      setLoading(false)
    }
  }, [applyRecord])

  const openChapter = useCallback((ch: ChapterDef) => {
    const state = chapterState[String(ch.id)] ?? (ch.playable ? "open" : "locked")
    if (state === "locked" || !ch.playable) {
      setLockedChapter(ch)
      return
    }
    navigate(`/level?ch=${ch.id}`)
  }, [chapterState, navigate])

  const continueProgress = useCallback(() => {
    const stateOf = (ch: ChapterDef) => chapterState[String(ch.id)] ?? (ch.playable ? "open" : "locked")
    // 优先：已开放且关卡内容可玩的章节；其次任意未锁定章节（会弹锁定/施工提示）
    const firstPlayable = CHAPTERS.find((ch) => ch.playable && stateOf(ch) !== "locked")
    openChapter(firstPlayable ?? CHAPTERS.find((ch) => stateOf(ch) !== "locked") ?? CHAPTERS[0])
  }, [chapterState, openChapter])

  const openGlossary = useCallback(() => {
    navigate("/glossary")
  }, [navigate])

  const openInterview = useCallback(() => {
    navigate("/interview")
  }, [navigate])

  const openFactoryTypes = useCallback(() => {
    navigate("/factory-types")
  }, [navigate])

  const openOpsTraining = useCallback(() => {
    navigate("/ops-training")
  }, [navigate])

  const openDbTraining = useCallback(() => {
    navigate("/db-training")
  }, [navigate])

  const openDebug = useCallback(() => {
    navigate("/debug")
  }, [navigate])

  const openSandbox = useCallback(() => {
    setConstructionNote({
      title: "自由沙盘",
      body: "第三章通关后开放：随便建工单、改库存，看物料在工序之间怎么流动。先用剧情关卡把基本功练扎实。",
    })
  }, [])

  const closeDialogs = useCallback(() => {
    setLockedChapter(null)
    setConstructionNote(null)
  }, [])

  const gaugeViews = GAUGE_DEFS.map((def) => {
    const gv = gauges[def.key] ?? { value: def.defaultValue }
    const delta = typeof gv.prev === "number" ? gv.value - gv.prev : 0
    const view = { def, value: gv.value, delta }
    return view
  })

  const streak = computeStreak(studyDays, Date.now())

  return {
    loading,
    loadError,
    recordId,
    chapters: CHAPTERS,
    chapterState,
    gaugeViews,
    streak,
    reviewCount,
    interviewCount,
    factoryCount,
    opsCount,
    dbCount,
    lockedChapter,
    constructionNote,
    openChapter,
    continueProgress,
    openGlossary,
    openInterview,
    openFactoryTypes,
    openOpsTraining,
    openDbTraining,
    openDebug,
    openSandbox,
    closeDialogs,
    retryLoad,
  }
}
