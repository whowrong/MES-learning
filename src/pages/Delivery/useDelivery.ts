// 上线陪产 · 交付闭环 页面状态机。
//
// 三件事：讲解卡阅读、交付物工作区写作与结构校验、实战测验（判分题 + 流程排序题）。
// 进度沿用站内既有存档（player_progress）：练习历史进 delivery_history，草稿进
// delivery_workspace，答错的术语照旧进 review_queue 走间隔重复。
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { pbFetch, getPocketBaseUrl } from "@/lib/pb"
import { callLlmWithFallback, listLlmModels, type LlmModelInfo } from "@/lib/llm"
import {
  loadDeliveryModule,
  type DeliveryModule,
  type DeliveryQuestion,
  type DeliveryOrder,
} from "@/content/delivery"
import {
  buildDeliveryPaper,
  checkWorkspace,
  deliveryRank,
  judgeDeliveryQuestion,
  scoreDeliveryPaper,
  wrongDeliveryTermIds,
  type DeliveryCheck,
  type DeliveryPaper,
} from "@/game/delivery"
import { addStudyDay } from "@/game/streak"
import type { DeliveryHistoryEntry, ProgressRecord } from "@/content/chapters"
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

export type DeliveryPhase = "cards" | "workspace" | "quiz" | "order" | "result"

export interface DeliveryQuestionView {
  index: number
  total: number
  question: DeliveryQuestion
  options: DeliveryQuestion["options"]
  selected: string[]
  judged: boolean
  judgedCorrect: boolean
}

export interface DeliveryResultView {
  score: number
  total: number
  rank: "S" | "A" | "B" | "C"
  objectiveCorrect: number
  objectiveTotal: number
  orderCorrect: boolean
  perQuestion: ReturnType<typeof scoreDeliveryPaper>["perQuestion"]
  orderVerdict: ReturnType<typeof scoreDeliveryPaper>["orderVerdict"]
  orderTitle: string
  orderSteps: DeliveryOrder["steps"]
  newReviewTerms: string[]
}

export type AiState = "loading" | "ready" | "empty" | "error"

export function useDelivery() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saveError, setSaveError] = useState("")
  const [phase, setPhase] = useState<DeliveryPhase>("cards")
  const [mod, setMod] = useState<DeliveryModule | null>(null)
  const [terms, setTerms] = useState<Record<string, TermDef>>({})
  const [recordId, setRecordId] = useState("")
  const [reviewQueue, setReviewQueue] = useState<string[]>([])
  const [studyDays, setStudyDays] = useState<string[]>([])
  const [history, setHistory] = useState<DeliveryHistoryEntry[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [activeDeliverableId, setActiveDeliverableId] = useState("")
  const [paper, setPaper] = useState<DeliveryPaper | null>(null)
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [judged, setJudged] = useState(false)
  const [judgedCorrect, setJudgedCorrect] = useState(false)
  const [answers, setAnswers] = useState<Map<string, string | string[]>>(new Map())
  const [orderPick, setOrderPick] = useState<string[]>([])
  const [result, setResult] = useState<DeliveryResultView | null>(null)
  const [termCard, setTermCard] = useState<TermDef | null>(null)
  const [aiModels, setAiModels] = useState<LlmModelInfo[]>([])
  const [aiState, setAiState] = useState<AiState>("loading")
  const [aiReview, setAiReview] = useState("")
  const [aiReviewing, setAiReviewing] = useState(false)
  const [aiError, setAiError] = useState("")

  const current = paper?.questions[idx] ?? null

  // 进场：拉模块内容、术语表、存档
  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        const [modDef, termMap, listRes] = await Promise.all([
          loadDeliveryModule(),
          loadTerms(),
          pbFetch(progressApi()),
        ])
        if (cancelled) return
        setMod(modDef)
        setTerms(termMap)
        setActiveDeliverableId(modDef.workspace.deliverables[0]?.id ?? "")
        if (listRes.ok) {
          const listData = await listRes.json()
          const items = Array.isArray(listData?.items) ? listData.items : []
          const rec = items[0] as Partial<ProgressRecord> & { id?: string } | undefined
          if (rec) {
            if (rec.id) setRecordId(String(rec.id))
            setReviewQueue(Array.isArray(rec.review_queue) ? rec.review_queue : [])
            setStudyDays(Array.isArray(rec.study_days) ? rec.study_days : [])
            setHistory(Array.isArray(rec.delivery_history) ? (rec.delivery_history as DeliveryHistoryEntry[]) : [])
            const ws = rec.delivery_workspace as Record<string, string> | undefined
            if (ws && typeof ws === "object") setDrafts({ ...ws })
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "交付闭环内容加载失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  // AI 能力探测：服务端模型清单为空时，前端明确显示「未接入」而不是静默降级
  useEffect(() => {
    let cancelled = false
    async function probe() {
      try {
        const models = await listLlmModels()
        if (cancelled) return
        setAiModels(models)
        setAiState(models.length > 0 ? "ready" : "empty")
      } catch {
        if (!cancelled) setAiState("error")
      }
    }
    probe()
    return () => {
      cancelled = true
    }
  }, [])

  const checks: DeliveryCheck[] = useMemo(() => {
    if (!mod) return []
    return checkWorkspace(mod.workspace.deliverables, drafts).checks
  }, [mod, drafts])

  const workspaceRatio = useMemo(() => {
    if (!mod) return 0
    return checkWorkspace(mod.workspace.deliverables, drafts).ratio
  }, [mod, drafts])

  const activeDeliverable = useMemo(() => {
    if (!mod) return null
    return mod.workspace.deliverables.find((d) => d.id === activeDeliverableId) ?? null
  }, [mod, activeDeliverableId])

  const goHome = useCallback(() => navigate("/"), [navigate])
  const goCards = useCallback(() => setPhase("cards"), [])
  const goWorkspace = useCallback(() => setPhase("workspace"), [])

  const openTermCard = useCallback(
    (termId: string) => {
      const t = terms[termId]
      if (t) setTermCard(t)
    },
    [terms],
  )
  const closeTermCard = useCallback(() => setTermCard(null), [])

  // ---------- 交付物工作区 ----------
  const setDraft = useCallback((id: string, text: string) => {
    setDrafts((prev) => ({ ...prev, [id]: text }))
  }, [])

  const saveDrafts = useCallback(async () => {
    if (!recordId) {
      setSaveError("存档还没就绪，草稿先留在本页，刷新前点一次保存。")
      return false
    }
    try {
      const res = await pbFetch(`${progressApi()}/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_workspace: drafts }),
      })
      if (!res.ok) {
        setSaveError("草稿保存失败（HTTP " + res.status + "），内容仍在本页。")
        return false
      }
      setSaveError("")
      return true
    } catch {
      setSaveError("草稿保存失败（网络问题），内容仍在本页。")
      return false
    }
  }, [recordId, drafts])

  // ---------- 测验 ----------
  const startQuiz = useCallback(() => {
    if (!mod) return
    const built = buildDeliveryPaper(mod, 0, 1)
    setPaper(built)
    setIdx(0)
    setSelected([])
    setJudged(false)
    setJudgedCorrect(false)
    setAnswers(new Map())
    setOrderPick([])
    setResult(null)
    setPhase("quiz")
  }, [mod])

  const pickOption = useCallback(
    (optionId: string) => {
      if (judged || !current) return
      setSelected((prev) => {
        if (current.type === "multiple") {
          return prev.includes(optionId) ? prev.filter((x) => x !== optionId) : [...prev, optionId]
        }
        return [optionId]
      })
    },
    [judged, current],
  )

  const submitAnswer = useCallback(() => {
    if (!current || judged) return
    const given = current.type === "multiple" ? [...selected] : selected[0] ?? ""
    if (!given) return
    const correct = judgeDeliveryQuestion(current, given)
    setJudged(true)
    setJudgedCorrect(correct)
    setAnswers((prev) => {
      const next = new Map(prev)
      next.set(current.id, given)
      return next
    })
  }, [current, judged, selected])

  const finishPaper = useCallback(
    (finalAnswers: Map<string, string | string[]>, finalOrder: string[] | null) => {
      if (!paper) return
      const scored = scoreDeliveryPaper(paper, finalAnswers, finalOrder)
      const rank = deliveryRank(scored.score)
      const wrongTerms = wrongDeliveryTermIds(scored)
      const nextQueue = [...reviewQueue, ...wrongTerms.filter((t) => !reviewQueue.includes(t))]
      const nextDays = addStudyDay(studyDays, Date.now())
      const entry = { at: localStamp(Date.now()), score: scored.score, total: scored.total }
      setResult({
        score: scored.score,
        total: scored.total,
        rank,
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
      setHistory((prev) => [...prev, entry])
      setPhase("result")
      if (recordId) {
        void pbFetch(`${progressApi()}/${recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            review_queue: nextQueue,
            study_days: nextDays,
            delivery_history: [...history, entry],
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
    [paper, reviewQueue, studyDays, recordId, history],
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

  const retryQuiz = useCallback(() => {
    setResult(null)
    startQuiz()
  }, [startQuiz])

  // ---------- AI 交付物评审 ----------
  const runAiReview = useCallback(async () => {
    if (!mod || !activeDeliverable) return
    const text = drafts[activeDeliverable.id] ?? ""
    if (!text.trim()) {
      setAiError("这一稿还是空的，先写点东西再让 AI 评。")
      return
    }
    const model = aiModels[0]?.model
    if (!model) {
      setAiError("服务端没有可用模型，先在目标机配置 MES_LLM_MODELS 与密钥。")
      return
    }
    setAiReviewing(true)
    setAiError("")
    setAiReview("")
    const rubric = activeDeliverable.required_elements
      .map((el, i) => `${i + 1}. ${el.label}（${el.hint}）`)
      .join("\n")
    const prompt = [
      `交付物：${activeDeliverable.title}`,
      `读者：${activeDeliverable.audience}`,
      `它要回答：${activeDeliverable.purpose}`,
      "",
      "必备要素清单（逐条对照，指出缺哪条）：",
      rubric,
      "",
      "交付物初稿：",
      text,
      "",
      "请按四段输出，不要寒暄：",
      "① 缺什么：对照必备要素逐条点名，缺的说清缺在哪、为什么必须补",
      "② 写得不好的地方：直接引用初稿里的原句，说明问题出在哪",
      "③ 可直接替换的句子：给 3 段改写后的文本，能直接贴回文档",
      "④ 评分：给 0-100 分，说明扣分点在哪",
    ].join("\n")
    try {
      const res = await callLlmWithFallback(model, {
        messages: [
          {
            role: "system",
            content:
              "你是一名做了多年 MES 实施的交付负责人，负责审阅实施交付物初稿。评审要具体、可执行，不说空话套话，也不客套。",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 1500,
      })
      if (!res.ok) {
        setAiError(res.error === "not_found" ? "服务端未装 LLM 路由" : "AI 调用失败：" + (res.error || "未知错误"))
        return
      }
      setAiReview(res.text || "（模型没有返回内容）")
    } catch {
      setAiError("AI 调用失败（网络问题）。")
    } finally {
      setAiReviewing(false)
    }
  }, [mod, activeDeliverable, drafts, aiModels])

  const questionView: DeliveryQuestionView | null = useMemo(() => {
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
    mod,
    terms,
    termCard,
    historyCount: history.length,
    drafts,
    checks,
    workspaceRatio,
    activeDeliverableId,
    activeDeliverable,
    questionView,
    orderPick,
    orderTitle: paper?.order?.title ?? "",
    orderIntro: paper?.order?.intro ?? "",
    orderSteps: paper?.order?.steps ?? [],
    result,
    aiState,
    aiModels,
    aiReview,
    aiReviewing,
    aiError,
    setActiveDeliverableId,
    setDraft,
    saveDrafts,
    goCards,
    goWorkspace,
    startQuiz,
    pickOption,
    submitAnswer,
    nextQuestion,
    addOrderStep,
    removeOrderStep,
    submitOrder,
    retryQuiz,
    goHome,
    openTermCard,
    closeTermCard,
    runAiReview,
  }
}
