// 运维训练营 Logic：域选择 → 训练清单 → 终端演练/场景决策/流程排序 → 演练报告
// 严肃练习模块：无剧情无拟人，评分依据 = 提示次数/错误尝试/答对率
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { getPocketBaseUrl } from "@/lib/pb"
import { loadTerms, shuffle, type TermDef } from "@/content/loader"
import {
  OPS_DOMAIN_ORDER,
  loadOpsBanks,
  loadOpsIndex,
  type OpsChoiceGroup,
  type OpsChoiceQuestion,
  type OpsDomainBank,
  type OpsDomainId,
  type OpsItem,
  type OpsOrderGroup,
  type OpsTerminalDrill,
} from "@/content/opsTraining"
import {
  initRun,
  rankForOpsScore,
  requestHint,
  scoreRun,
  submitCommand,
  type TerminalRun,
} from "@/game/opsTerminal"
import { addStudyDay } from "@/game/streak"
import type { OpsHistoryEntry, ProgressRecord } from "@/content/chapters"
import { useRealServer } from "./useRealServer"

function progressApi(): string {
  return `${getPocketBaseUrl()}/api/player_progress`
}

/** 本地日期时间串 YYYY-MM-DD HH:mm（存档用，不用 UTC） */
function localStamp(now: number): string {
  const d = new Date(now)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export type OpsPhase = "domains" | "list" | "terminal" | "choice" | "order" | "report" | "server"

/** 决策题作答记录 */
interface OpsAnswerRecord {
  questionId: string
  given: string
  correct: boolean
}

/** 演练报告（终端/决策/排序共用） */
export interface OpsReport {
  kind: OpsItem["kind"]
  title: string
  score: number
  rank: "S" | "A" | "B" | "C"
  rankText: string
  terminal?: { steps: number; hintsUsed: number; wrongAttempts: number; sop: string[] }
  choice?: { correctCount: number; total: number; perQuestion: OpsAnswerRecord[]; questions: OpsChoiceQuestion[] }
  order?: { attemptsUsed: number; totalSteps: number; solved: boolean; steps: Array<{ id: string; text: string; note: string }> }
}

export function useOpsTraining() {
  const navigate = useNavigate()
  const realServer = useRealServer()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saveError, setSaveError] = useState("")
  const [banks, setBanks] = useState<OpsDomainBank[]>([])
  const [rankTexts, setRankTexts] = useState<Record<string, string>>({})
  const [terms, setTerms] = useState<Record<string, TermDef>>({})

  const [recordId, setRecordId] = useState("")
  const [reviewQueue, setReviewQueue] = useState<string[]>([])
  const [studyDays, setStudyDays] = useState<string[]>([])
  const [opsHistory, setOpsHistory] = useState<OpsHistoryEntry[]>([])

  const [phase, setPhase] = useState<OpsPhase>("domains")
  const [currentDomain, setCurrentDomain] = useState<OpsDomainId | null>(null)
  const [currentItem, setCurrentItem] = useState<OpsItem | null>(null)

  // 终端演练
  const [terminalRun, setTerminalRun] = useState<TerminalRun | null>(null)
  // 场景决策
  const [choiceQuestions, setChoiceQuestions] = useState<OpsChoiceQuestion[]>([])
  const [choiceIdx, setChoiceIdx] = useState(0)
  const [choiceSelected, setChoiceSelected] = useState<string | null>(null)
  const [choiceJudged, setChoiceJudged] = useState(false)
  const [choiceAnswers, setChoiceAnswers] = useState<OpsAnswerRecord[]>([])
  // 流程排序
  const [orderIds, setOrderIds] = useState<string[]>([])
  const [orderAttempts, setOrderAttempts] = useState(0)
  const [orderJudged, setOrderJudged] = useState(false)
  const [orderSolved, setOrderSolved] = useState(false)
  const [orderWrongFlash, setOrderWrongFlash] = useState(false)
  // 报告
  const [report, setReport] = useState<OpsReport | null>(null)
  const [newReviewTerms, setNewReviewTerms] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        const [idxData, bankList, termMap, listRes] = await Promise.all([
          loadOpsIndex(),
          loadOpsBanks(),
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
            setOpsHistory(Array.isArray(rec.ops_history) ? rec.ops_history : [])
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "运维训练内容加载失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const activeBank = useMemo(() => banks.find((b) => b.domain === currentDomain) ?? null, [banks, currentDomain])

  /** 成绩落档：历史 + 打卡 + 复习队列（决策题错词），PATCH 存档 */
  const commitResult = useCallback(
    (entry: Omit<OpsHistoryEntry, "at">, wrongTerms: string[]) => {
      const nextQueue = [...reviewQueue, ...wrongTerms.filter((t) => !reviewQueue.includes(t))]
      const nextDays = addStudyDay(studyDays, Date.now())
      const nextHistory = [...opsHistory, { ...entry, at: localStamp(Date.now()) }]
      setReviewQueue(nextQueue)
      setStudyDays(nextDays)
      setOpsHistory(nextHistory)
      setNewReviewTerms(wrongTerms)
      if (recordId) {
        void fetch(`${progressApi()}/${recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ review_queue: nextQueue, study_days: nextDays, ops_history: nextHistory }),
        })
          .then((r) => {
            if (!r.ok) setSaveError("练习记录保存失败，回首页重试一次即可。")
          })
          .catch(() => setSaveError("练习记录保存失败（网络问题），本次成绩只在本地生效。"))
      } else {
        setSaveError("存档还没就绪，这次成绩只在本地生效。")
      }
    },
    [reviewQueue, studyDays, opsHistory, recordId],
  )

  const domainsView = useMemo(() => {
    const domainViews = banks.map((b) => {
      const trained = opsHistory.filter((h) => h.domain === b.domain).length
      const view = {
        domain: b.domain,
        domainName: b.domainName,
        brief: b.brief,
        itemCount: b.items.length,
        terminalCount: b.items.filter((i) => i.kind === "terminal").length,
        trained,
      }
      return view
    })
    domainViews.sort((a, b) => OPS_DOMAIN_ORDER.indexOf(a.domain) - OPS_DOMAIN_ORDER.indexOf(b.domain))
    const view = { domainViews, practiced: opsHistory.length }
    return view
  }, [banks, opsHistory])

  const listView = useMemo(() => {
    if (!activeBank) return null
    const itemViews = activeBank.items.map((item) => {
      const records = opsHistory.filter((h) => h.itemId === item.id)
      const bestScore = records.length > 0 ? Math.max(...records.map((r) => r.score)) : null
      const view = {
        id: item.id,
        kind: item.kind,
        title: item.title,
        difficulty: item.difficulty,
        minutes: item.minutes,
        attempts: records.length,
        bestScore,
      }
      return view
    })
    const view = { domainName: activeBank.domainName, brief: activeBank.brief, itemViews }
    return view
  }, [activeBank, opsHistory])

  const chooseDomain = useCallback((domain: OpsDomainId) => {
    setCurrentDomain(domain)
    setSaveError("")
    setPhase("list")
  }, [])

  const backToDomains = useCallback(() => {
    setPhase("domains")
    setCurrentDomain(null)
    setCurrentItem(null)
    setReport(null)
  }, [])

  const backToList = useCallback(() => {
    setPhase("list")
    setCurrentItem(null)
    setReport(null)
  }, [])

  /** 进入某个训练项目 */
  const startItem = useCallback((itemId: string) => {
    if (!activeBank) return
    const item = activeBank.items.find((i) => i.id === itemId)
    if (!item) return
    setCurrentItem(item)
    setSaveError("")
    setReport(null)
    if (item.kind === "terminal") {
      setTerminalRun(initRun(item as OpsTerminalDrill))
      setPhase("terminal")
    } else if (item.kind === "choice") {
      const group = item as OpsChoiceGroup
      setChoiceQuestions(group.questions)
      setChoiceIdx(0)
      setChoiceSelected(null)
      setChoiceJudged(false)
      setChoiceAnswers([])
      setPhase("choice")
    } else {
      const group = item as OpsOrderGroup
      setOrderIds(shuffle(group.steps.map((s) => s.id)))
      setOrderAttempts(0)
      setOrderJudged(false)
      setOrderSolved(false)
      setPhase("order")
    }
  }, [activeBank])

  // ── 终端演练 ─────────────────────────────────────────────
  const activeDrill = currentItem?.kind === "terminal" ? (currentItem as OpsTerminalDrill) : null

  const runCommand = useCallback(
    (cmd: string) => {
      if (!activeDrill || !terminalRun) return
      setTerminalRun(submitCommand(terminalRun, activeDrill, cmd))
    },
    [activeDrill, terminalRun],
  )

  const askHint = useCallback(() => {
    if (!activeDrill || !terminalRun) return
    setTerminalRun(requestHint(terminalRun, activeDrill))
  }, [activeDrill, terminalRun])

  const finishDrill = useCallback(() => {
    if (!activeDrill || !terminalRun || !terminalRun.finished) return
    const score = scoreRun(terminalRun)
    const rank = rankForOpsScore(score)
    commitResult({ domain: currentDomain ?? "", itemId: activeDrill.id, kind: "terminal", score, total: 100 }, [])
    setReport({
      kind: "terminal",
      title: activeDrill.title,
      score,
      rank,
      rankText: rankTexts[rank] ?? "",
      terminal: {
        steps: activeDrill.steps.length,
        hintsUsed: terminalRun.hintsUsed,
        wrongAttempts: terminalRun.wrongAttempts,
        sop: activeDrill.sop,
      },
    })
    setPhase("report")
  }, [activeDrill, terminalRun, commitResult, currentDomain, rankTexts])

  const terminalView = useMemo(() => {
    if (!activeDrill || !terminalRun) return null
    const step = activeDrill.steps[Math.min(terminalRun.stepIndex, activeDrill.steps.length - 1)]
    const view = {
      drill: activeDrill,
      run: terminalRun,
      stepIndex: terminalRun.stepIndex,
      stepTotal: activeDrill.steps.length,
      currentObjective: terminalRun.finished ? "全部步骤完成" : step?.objective ?? "",
      canFinish: terminalRun.finished,
    }
    return view
  }, [activeDrill, terminalRun])

  // ── 场景决策 ─────────────────────────────────────────────
  const currentQuestion = choiceQuestions[choiceIdx] ?? null

  const pickChoice = useCallback(
    (optionId: string) => {
      if (!currentQuestion || choiceJudged) return
      setChoiceSelected(optionId)
    },
    [currentQuestion, choiceJudged],
  )

  const submitChoice = useCallback(() => {
    if (!currentQuestion || choiceJudged || !choiceSelected) return
    const correct = choiceSelected === currentQuestion.answer
    setChoiceAnswers((prev) => [...prev, { questionId: currentQuestion.id, given: choiceSelected, correct }])
    setChoiceJudged(true)
  }, [currentQuestion, choiceJudged, choiceSelected])

  const finishChoice = useCallback(
    (finalAnswers: OpsAnswerRecord[]) => {
      if (!currentItem || currentItem.kind !== "choice") return
      const group = currentItem as OpsChoiceGroup
      const correctCount = finalAnswers.filter((a) => a.correct).length
      const score = Math.round((correctCount / Math.max(1, group.questions.length)) * 100)
      const rank = rankForOpsScore(score)
      // 错题关联术语进复习队列
      const wrongTerms: string[] = []
      for (const a of finalAnswers) {
        if (a.correct) continue
        const q = group.questions.find((qq) => qq.id === a.questionId)
        for (const t of q?.term_ids ?? []) if (!wrongTerms.includes(t)) wrongTerms.push(t)
      }
      commitResult({ domain: currentDomain ?? "", itemId: group.id, kind: "choice", score, total: 100 }, wrongTerms)
      setReport({
        kind: "choice",
        title: group.title,
        score,
        rank,
        rankText: rankTexts[rank] ?? "",
        choice: { correctCount, total: group.questions.length, perQuestion: finalAnswers, questions: group.questions },
      })
      setPhase("report")
    },
    [currentItem, currentDomain, commitResult, rankTexts],
  )

  const nextChoice = useCallback(() => {
    if (!currentQuestion || !choiceJudged) return
    if (choiceIdx + 1 >= choiceQuestions.length) {
      finishChoice(choiceAnswers)
      return
    }
    setChoiceIdx(choiceIdx + 1)
    setChoiceSelected(null)
    setChoiceJudged(false)
  }, [currentQuestion, choiceJudged, choiceIdx, choiceQuestions, choiceAnswers, finishChoice])

  const choiceView = useMemo(() => {
    if (!currentQuestion || !currentItem || currentItem.kind !== "choice") return null
    const view = {
      groupTitle: (currentItem as OpsChoiceGroup).title,
      question: currentQuestion,
      index: choiceIdx,
      total: choiceQuestions.length,
      selected: choiceSelected,
      judged: choiceJudged,
      judgedCorrect: choiceJudged && choiceSelected === currentQuestion.answer,
      canSubmit: choiceSelected !== null && !choiceJudged,
      isLast: choiceIdx + 1 >= choiceQuestions.length,
    }
    return view
  }, [currentQuestion, currentItem, choiceIdx, choiceQuestions, choiceSelected, choiceJudged])

  // ── 流程排序 ─────────────────────────────────────────────
  const activeOrder = currentItem?.kind === "order" ? (currentItem as OpsOrderGroup) : null

  const moveOrderStep = useCallback((index: number, dir: -1 | 1) => {
    if (orderJudged) return
    setOrderIds((prev) => {
      const target = index + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const tmp = next[index]
      next[index] = next[target]
      next[target] = tmp
      return next
    })
  }, [orderJudged])

  const submitOrder = useCallback(() => {
    if (!activeOrder || orderJudged) return
    const correctOrder = activeOrder.steps.map((s) => s.id)
    const solved = orderIds.every((id, i) => id === correctOrder[i])
    const attemptsUsed = orderAttempts + 1
    setOrderAttempts(attemptsUsed)
    if (solved) {
      setOrderSolved(true)
      setOrderJudged(true)
      return
    }
    if (attemptsUsed >= activeOrder.maxAttempts) {
      // 机会用完：展示正解，按 60 分计
      setOrderIds(correctOrder)
      setOrderJudged(true)
      return
    }
    // 还有次数：只判定不锁定，标记本次错误让界面提示
    setOrderJudged(false)
    setOrderSolved(false)
    setOrderAttempts(attemptsUsed)
    setOrderWrongFlash(true)
  }, [activeOrder, orderIds, orderAttempts, orderJudged])

  const finishOrder = useCallback(() => {
    if (!activeOrder || !orderJudged) return
    const score = orderSolved ? (orderAttempts <= 1 ? 100 : 80) : 60
    const rank = rankForOpsScore(score)
    commitResult({ domain: currentDomain ?? "", itemId: activeOrder.id, kind: "order", score, total: 100 }, [])
    setReport({
      kind: "order",
      title: activeOrder.title,
      score,
      rank,
      rankText: rankTexts[rank] ?? "",
      order: {
        attemptsUsed: orderAttempts,
        totalSteps: activeOrder.steps.length,
        solved: orderSolved,
        steps: activeOrder.steps,
      },
    })
    setPhase("report")
  }, [activeOrder, orderJudged, orderSolved, orderAttempts, commitResult, currentDomain, rankTexts])

  const orderView = useMemo(() => {
    if (!activeOrder) return null
    const correctOrder = activeOrder.steps.map((s) => s.id)
    const stepById = Object.fromEntries(activeOrder.steps.map((s) => [s.id, s]))
    const rows = orderIds.map((id, i) => {
      const s = stepById[id]
      const inPlace = id === correctOrder[i]
      const row = {
        id,
        index: i,
        text: s?.text ?? "",
        note: s?.note ?? "",
        inPlace,
        canUp: i > 0 && !orderJudged,
        canDown: i < orderIds.length - 1 && !orderJudged,
      }
      return row
    })
    const view = {
      title: activeOrder.title,
      intro: activeOrder.intro,
      rows,
      attemptsUsed: orderAttempts,
      maxAttempts: activeOrder.maxAttempts,
      judged: orderJudged,
      solved: orderSolved,
      wrongFlash: orderWrongFlash,
      canSubmit: !orderJudged,
    }
    return view
  }, [activeOrder, orderIds, orderAttempts, orderJudged, orderSolved, orderWrongFlash])

  const dismissOrderFlash = useCallback(() => setOrderWrongFlash(false), [])

  const retryCurrent = useCallback(() => {
    if (currentItem) startItem(currentItem.id)
  }, [currentItem, startItem])

  // 真实服务器模式进出
  const openServerMode = useCallback(() => {
    setPhase("server")
    setSaveError("")
  }, [])

  const backFromServer = useCallback(() => {
    setPhase("domains")
  }, [])

  const goHome = useCallback(() => navigate("/"), [navigate])

  return {
    loading,
    loadError,
    saveError,
    phase,
    terms,
    domainsView,
    chooseDomain,
    backToDomains,
    listView,
    backToList,
    startItem,
    terminalView,
    runCommand,
    askHint,
    finishDrill,
    choiceView,
    pickChoice,
    submitChoice,
    nextChoice,
    orderView,
    moveOrderStep,
    submitOrder,
    finishOrder,
    dismissOrderFlash,
    report,
    newReviewTerms,
    retryCurrent,
    openServerMode,
    backFromServer,
    goHome,
    ...realServer,
  }
}
