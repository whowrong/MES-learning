// 数据库实操营 Logic：任务练习（内置练习库真实执行 SQL）+ 自由工作台（可连真实远程库）
// 严肃练习模块：评分依据 = 提交校验次数 / 提示 / 看答案
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { pbFetch, getPocketBaseUrl } from "@/lib/pb"
import { loadTerms, type TermDef } from "@/content/loader"
import {
  DB_TYPE_META,
  loadDbGroups,
  loadDbIndex,
  type DbConnectionView,
  type DbGroupBank,
  type DbGroupId,
  type DbTask,
} from "@/content/dbTraining"
import {
  detectDangerousSql,
  judgeTaskResult,
  rankForDbScore,
  scoreByAttempts,
  scoreTaskGroup,
  type JudgeVerdict,
  type SqlDanger,
} from "@/game/dbTraining"
import { addStudyDay } from "@/game/streak"
import { dblabApi, type NewDbConnection, type SqlExecResult } from "@/lib/labApi"
import type { DbHistoryEntry, ProgressRecord } from "@/content/chapters"

function progressApi(): string {
  return `${getPocketBaseUrl()}/api/player_progress`
}

/** 本地日期时间串 YYYY-MM-DD HH:mm（存档用，不用 UTC） */
function localStamp(now: number): string {
  const d = new Date(now)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export type DbPhase = "home" | "task" | "report" | "workbench"

/** 单个任务的作答结果 */
export interface DbTaskResult {
  taskId: string
  title: string
  score: number
  attempts: number
  hintUsed: boolean
  viewedAnswer: boolean
  answerSql: string
  explanation: string
  termIds: string[]
}

/** 任务组报告 */
export interface DbGroupReport {
  groupId: DbGroupId
  groupName: string
  score: number
  rank: "S" | "A" | "B" | "C"
  rankText: string
  results: DbTaskResult[]
}

/** 工作台执行历史（本地会话内，不落库） */
export interface WbHistoryEntry {
  at: string
  sql: string
  ok: boolean
  summary: string
}

/** 连接表单（明文密码只存在于表单提交瞬间） */
export interface ConnForm {
  id?: string
  label: string
  type: "mysql" | "sqlserver" | "postgres"
  host: string
  port: string
  database: string
  username: string
  password: string
}

const EMPTY_CONN_FORM: ConnForm = { label: "", type: "mysql", host: "", port: "3306", database: "", username: "", password: "" }

export function useDbTraining() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saveError, setSaveError] = useState("")
  const [groups, setGroups] = useState<DbGroupBank[]>([])
  const [rankTexts, setRankTexts] = useState<Record<string, string>>({})
  const [terms, setTerms] = useState<Record<string, TermDef>>({})

  const [recordId, setRecordId] = useState("")
  const [reviewQueue, setReviewQueue] = useState<string[]>([])
  const [studyDays, setStudyDays] = useState<string[]>([])
  const [dbHistory, setDbHistory] = useState<DbHistoryEntry[]>([])

  const [phase, setPhase] = useState<DbPhase>("home")
  const [activeGroupId, setActiveGroupId] = useState<DbGroupId | null>(null)
  const [taskIndex, setTaskIndex] = useState(0)

  // 任务作答
  const [sqlText, setSqlText] = useState("")
  const [execResult, setExecResult] = useState<SqlExecResult | null>(null)
  const [execBusy, setExecBusy] = useState(false)
  const [execError, setExecError] = useState("")
  const [checkAttempts, setCheckAttempts] = useState(0)
  const [verdict, setVerdict] = useState<JudgeVerdict | null>(null)
  const [solved, setSolved] = useState(false)
  const [viewedAnswer, setViewedAnswer] = useState(false)
  const [hintVisible, setHintVisible] = useState(false)
  const [taskResults, setTaskResults] = useState<DbTaskResult[]>([])

  // 报告
  const [report, setReport] = useState<DbGroupReport | null>(null)
  const [newReviewTerms, setNewReviewTerms] = useState<string[]>([])

  // 自由工作台
  const [connections, setConnections] = useState<DbConnectionView[]>([])
  const [wbConnId, setWbConnId] = useState("builtin")
  const [wbSql, setWbSql] = useState("")
  const [wbResult, setWbResult] = useState<SqlExecResult | null>(null)
  const [wbBusy, setWbBusy] = useState(false)
  const [wbError, setWbError] = useState("")
  const [wbHistory, setWbHistory] = useState<WbHistoryEntry[]>([])
  const [readOnlyGuard, setReadOnlyGuard] = useState(false)
  const [dangerConfirm, setDangerConfirm] = useState<SqlDanger[] | null>(null)
  const [wbNotice, setWbNotice] = useState("")

  // 连接表单弹窗
  const [connDialogOpen, setConnDialogOpen] = useState(false)
  const [connForm, setConnForm] = useState<ConnForm>(EMPTY_CONN_FORM)
  const [connTestResult, setConnTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [connBusy, setConnBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        const [idxData, groupList, termMap, listRes, connRes] = await Promise.all([
          loadDbIndex(),
          loadDbGroups(),
          loadTerms(),
          pbFetch(progressApi()),
          dblabApi.listConnections().catch(() => ({ ok: false, connections: [] })),
        ])
        if (cancelled) return
        setRankTexts(idxData.rankTexts ?? {})
        setGroups(groupList)
        setTerms(termMap)
        setConnections(connRes.connections ?? [])
        if (listRes.ok) {
          const data = await listRes.json()
          const items = Array.isArray(data?.items) ? data.items : []
          const rec = items[0] as (Partial<ProgressRecord> & { id?: string }) | undefined
          if (rec) {
            setRecordId(String(rec.id))
            setReviewQueue(Array.isArray(rec.review_queue) ? rec.review_queue : [])
            setStudyDays(Array.isArray(rec.study_days) ? rec.study_days : [])
            setDbHistory(Array.isArray(rec.db_history) ? rec.db_history : [])
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "数据库练习内容加载失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const activeGroup = useMemo(() => groups.find((g) => g.group === activeGroupId) ?? null, [groups, activeGroupId])
  const currentTask: DbTask | null = activeGroup ? (activeGroup.tasks[taskIndex] ?? null) : null

  /** 成绩落档：历史 + 打卡 + 复习队列（未满分任务关联术语），PATCH 存档 */
  const commitResult = useCallback(
    (entry: Omit<DbHistoryEntry, "at">, wrongTerms: string[]) => {
      const nextQueue = [...reviewQueue, ...wrongTerms.filter((t) => !reviewQueue.includes(t))]
      const nextDays = addStudyDay(studyDays, Date.now())
      const nextHistory = [...dbHistory, { ...entry, at: localStamp(Date.now()) }]
      setReviewQueue(nextQueue)
      setStudyDays(nextDays)
      setDbHistory(nextHistory)
      setNewReviewTerms(wrongTerms)
      if (recordId) {
        void pbFetch(`${progressApi()}/${recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ review_queue: nextQueue, study_days: nextDays, db_history: nextHistory }),
        })
          .then((r) => {
            if (!r.ok) setSaveError("练习记录保存失败，回首页重试一次即可。")
          })
          .catch(() => setSaveError("练习记录保存失败（网络问题），本次成绩只在本地生效。"))
      } else {
        setSaveError("存档还没就绪，这次成绩只在本地生效。")
      }
    },
    [reviewQueue, studyDays, dbHistory, recordId],
  )

  const homeView = useMemo(() => {
    const groupViews = groups.map((g) => {
      const records = dbHistory.filter((h) => h.group === g.group)
      const bestScore = records.length > 0 ? Math.max(...records.map((r) => r.score)) : null
      const view = {
        group: g.group,
        groupName: g.groupName,
        brief: g.brief,
        taskCount: g.tasks.length,
        attempts: records.length,
        bestScore,
      }
      return view
    })
    const view = { groupViews, practiced: dbHistory.length, connectionCount: connections.length }
    return view
  }, [groups, dbHistory, connections])

  // ── 任务练习 ─────────────────────────────────────────────
  const resetTaskState = useCallback((task: DbTask | null) => {
    setSqlText(task?.starterSql ?? "")
    setExecResult(null)
    setExecBusy(false)
    setExecError("")
    setCheckAttempts(0)
    setVerdict(null)
    setSolved(false)
    setViewedAnswer(false)
    setHintVisible(false)
  }, [])

  const chooseGroup = useCallback(
    (groupId: DbGroupId) => {
      const g = groups.find((x) => x.group === groupId)
      if (!g) return
      setActiveGroupId(groupId)
      setTaskIndex(0)
      setTaskResults([])
      setSaveError("")
      setReport(null)
      resetTaskState(g.tasks[0] ?? null)
      setPhase("task")
    },
    [groups, resetTaskState],
  )

  /** 在内置练习库上执行当前 SQL（自由执行，不计次——真实结果就是最好的反馈） */
  const runSql = useCallback(async () => {
    if (!sqlText.trim() || execBusy) return
    setExecBusy(true)
    setExecError("")
    try {
      const r = await dblabApi.exec("builtin", sqlText)
      if (r.ok) {
        setExecResult(r)
      } else {
        setExecResult(null)
        setExecError(r.error || "执行失败")
      }
    } catch (e) {
      setExecResult(null)
      setExecError(e instanceof Error ? e.message : "执行失败")
    } finally {
      setExecBusy(false)
    }
  }, [sqlText, execBusy])

  const finishTask = useCallback(
    (task: DbTask, attempts: number, hintUsed: boolean, lookedAnswer: boolean) => {
      const base = scoreByAttempts(attempts, lookedAnswer)
      const score = Math.max(0, base - (hintUsed ? 10 : 0))
      const result: DbTaskResult = {
        taskId: task.id,
        title: task.title,
        score,
        attempts,
        hintUsed,
        viewedAnswer: lookedAnswer,
        answerSql: task.answerSql,
        explanation: task.explanation,
        termIds: task.term_ids,
      }
      setTaskResults((prev) => [...prev, result])
      return result
    },
    [],
  )

  /** 提交校验：result 模式比对最近执行结果；state 模式在库上跑校验 SQL 验证状态 */
  const submitCheck = useCallback(async () => {
    if (!currentTask || solved) return
    const task = currentTask
    if (task.check.mode === "result") {
      if (!execResult || !execResult.ok) {
        setExecError("先执行你的 SQL，拿到结果后再提交校验。")
        return
      }
      const v = judgeTaskResult((execResult.rows ?? []) as unknown[][], task.check.expect, task.check.unorderedTieColumns)
      const attempts = checkAttempts + 1
      setCheckAttempts(attempts)
      setVerdict(v)
      if (v.passed) {
        setSolved(true)
        finishTask(task, attempts, hintVisible, viewedAnswer)
      }
      return
    }
    // state 模式：执行校验 SQL 看库状态
    try {
      const r = await dblabApi.exec("builtin", task.check.sql)
      if (!r.ok) {
        setExecError(r.error || "校验执行失败")
        return
      }
      const v = judgeTaskResult((r.rows ?? []) as unknown[][], task.check.expect, task.check.unorderedTieColumns)
      const attempts = checkAttempts + 1
      setCheckAttempts(attempts)
      setVerdict(v)
      if (v.passed) {
        setSolved(true)
        finishTask(task, attempts, hintVisible, viewedAnswer)
      }
    } catch (e) {
      setExecError(e instanceof Error ? e.message : "校验执行失败")
    }
  }, [currentTask, solved, execResult, checkAttempts, hintVisible, viewedAnswer, finishTask])

  const viewAnswerNow = useCallback(() => {
    if (!currentTask || solved) return
    setViewedAnswer(true)
    setSolved(true)
    setVerdict({ passed: true, diffHint: "" })
    finishTask(currentTask, checkAttempts, hintVisible, true)
  }, [currentTask, solved, checkAttempts, hintVisible, finishTask])

  const showHint = useCallback(() => setHintVisible(true), [])

  const finishGroupNow = useCallback(
    (results: DbTaskResult[]) => {
      if (!activeGroup) return
      const score = scoreTaskGroup(results.map((r) => r.score))
      const rank = rankForDbScore(score)
      const wrongTerms: string[] = []
      for (const r of results) {
        if (r.score >= 100) continue
        for (const t of r.termIds) if (!wrongTerms.includes(t)) wrongTerms.push(t)
      }
      commitResult({ group: activeGroup.group, score, total: 100 }, wrongTerms)
      setReport({
        groupId: activeGroup.group,
        groupName: activeGroup.groupName,
        score,
        rank,
        rankText: rankTexts[rank] ?? "",
        results,
      })
      setPhase("report")
    },
    [activeGroup, commitResult, rankTexts],
  )

  const nextTask = useCallback(() => {
    if (!activeGroup || !solved) return
    const nextIdx = taskIndex + 1
    if (nextIdx >= activeGroup.tasks.length) {
      finishGroupNow(taskResults)
      return
    }
    setTaskIndex(nextIdx)
    resetTaskState(activeGroup.tasks[nextIdx] ?? null)
  }, [activeGroup, solved, taskIndex, taskResults, finishGroupNow, resetTaskState])

  const taskView = useMemo(() => {
    if (!activeGroup || !currentTask) return null
    const view = {
      groupName: activeGroup.groupName,
      task: currentTask,
      index: taskIndex,
      total: activeGroup.tasks.length,
      sqlText,
      execResult,
      execBusy,
      execError,
      checkAttempts,
      verdict,
      solved,
      viewedAnswer,
      hintVisible,
      isLast: taskIndex + 1 >= activeGroup.tasks.length,
    }
    return view
  }, [activeGroup, currentTask, taskIndex, sqlText, execResult, execBusy, execError, checkAttempts, verdict, solved, viewedAnswer, hintVisible])

  // ── 自由工作台 ─────────────────────────────────────────────
  const openWorkbench = useCallback(() => {
    setSaveError("")
    setWbNotice("")
    setPhase("workbench")
  }, [])

  const chooseWbConn = useCallback(
    (connId: string) => {
      setWbConnId(connId)
      setWbResult(null)
      setWbError("")
      setDangerConfirm(null)
      // 真连默认开只读保护，内置练习库默认放开（可随时重置）
      setReadOnlyGuard(connId !== "builtin")
    },
    [],
  )

  const execWbNow = useCallback(
    async (sql: string) => {
      if (!sql.trim() || wbBusy) return
      setWbBusy(true)
      setWbError("")
      try {
        const r = await dblabApi.exec(wbConnId, sql)
        if (r.ok) {
          setWbResult(r)
          const summary = r.columns && r.columns.length > 0
            ? `返回 ${r.rows?.length ?? 0} 行${r.truncated ? `（已截断，共 ${r.total} 行）` : ""}`
            : `执行成功${r.affectedRows !== undefined ? `，影响 ${r.affectedRows} 行` : ""}`
          setWbHistory((prev) => [...prev.slice(-29), { at: localStamp(Date.now()), sql: sql.trim(), ok: true, summary }])
        } else {
          setWbResult(null)
          setWbError(r.error || "执行失败")
          setWbHistory((prev) => [...prev.slice(-29), { at: localStamp(Date.now()), sql: sql.trim(), ok: false, summary: r.error || "执行失败" }])
        }
      } catch (e) {
        setWbResult(null)
        setWbError(e instanceof Error ? e.message : "执行失败")
      } finally {
        setWbBusy(false)
      }
    },
    [wbConnId, wbBusy],
  )

  const runWbSql = useCallback(() => {
    const sql = wbSql
    if (!sql.trim()) return
    // 只读保护只对真连生效；内置练习库放开（有重置按钮兜底）
    const guard = readOnlyGuard && wbConnId !== "builtin"
    const dangers = detectDangerousSql(sql, guard)
    if (dangers.some((d) => d.level === "block")) {
      setDangerConfirm(dangers)
      return
    }
    if (dangers.length > 0) {
      setDangerConfirm(dangers)
      return
    }
    void execWbNow(sql)
  }, [wbSql, readOnlyGuard, wbConnId, execWbNow])

  const confirmDangerExec = useCallback(() => {
    const sql = wbSql
    setDangerConfirm(null)
    // block 级（只读保护）不允许确认执行，只能关保护后重来
    if (sql.trim()) void execWbNow(sql)
  }, [wbSql, execWbNow])

  const cancelDangerExec = useCallback(() => setDangerConfirm(null), [])

  const resetBuiltinDb = useCallback(async () => {
    setWbBusy(true)
    try {
      const r = await dblabApi.resetBuiltin()
      setWbNotice(r.ok ? "内置练习库已重置为初始状态" : (r.error || "重置失败"))
      setWbResult(null)
    } catch (e) {
      setWbNotice(e instanceof Error ? e.message : "重置失败")
    } finally {
      setWbBusy(false)
    }
  }, [])

  // ── 连接管理 ─────────────────────────────────────────────
  const openConnDialog = useCallback((existing?: DbConnectionView) => {
    if (existing) {
      setConnForm({
        id: existing.id,
        label: existing.label,
        type: existing.type,
        host: existing.host,
        port: String(existing.port ?? DB_TYPE_META[existing.type]?.defaultPort ?? ""),
        database: existing.database,
        username: existing.username,
        password: "",
      })
    } else {
      setConnForm(EMPTY_CONN_FORM)
    }
    setConnTestResult(null)
    setConnDialogOpen(true)
  }, [])

  const closeConnDialog = useCallback(() => setConnDialogOpen(false), [])

  const updateConnForm = useCallback((patch: Partial<ConnForm>) => {
    setConnForm((prev) => ({ ...prev, ...patch }))
    setConnTestResult(null)
  }, [])

  const buildInlineConn = useCallback((): NewDbConnection | null => {
    if (!connForm.label.trim() || !connForm.host.trim() || !connForm.username.trim()) return null
    return {
      id: connForm.id,
      label: connForm.label.trim(),
      type: connForm.type,
      host: connForm.host.trim(),
      port: connForm.port ? Number(connForm.port) : DB_TYPE_META[connForm.type]?.defaultPort,
      database: connForm.database.trim(),
      username: connForm.username.trim(),
      password: connForm.password || undefined,
    }
  }, [connForm])

  const testConnForm = useCallback(async () => {
    const inline = buildInlineConn()
    if (!inline) {
      setConnTestResult({ ok: false, message: "名称、主机、用户名必填" })
      return
    }
    setConnBusy(true)
    try {
      const r = await dblabApi.test(inline.id && !inline.password ? inline.id : undefined, inline)
      setConnTestResult({ ok: Boolean(r.ok), message: r.ok ? (r.message || "连接成功") : (r.error || "连接失败") })
    } catch (e) {
      setConnTestResult({ ok: false, message: e instanceof Error ? e.message : "连接失败" })
    } finally {
      setConnBusy(false)
    }
  }, [buildInlineConn])

  const saveConnForm = useCallback(async () => {
    const inline = buildInlineConn()
    if (!inline) {
      setConnTestResult({ ok: false, message: "名称、主机、用户名必填" })
      return
    }
    setConnBusy(true)
    try {
      const r = await dblabApi.saveConnection(inline)
      if (r.ok && r.connection) {
        const list = await dblabApi.listConnections()
        setConnections(list.connections ?? [])
        setConnDialogOpen(false)
        setWbNotice(`连接「${r.connection.label}」已保存（密码只存在服务端）`)
      } else {
        setConnTestResult({ ok: false, message: r.error || "保存失败" })
      }
    } catch (e) {
      setConnTestResult({ ok: false, message: e instanceof Error ? e.message : "保存失败" })
    } finally {
      setConnBusy(false)
    }
  }, [buildInlineConn])

  const deleteConn = useCallback(async (id: string) => {
    try {
      await dblabApi.deleteConnection(id)
      const list = await dblabApi.listConnections()
      setConnections(list.connections ?? [])
      setWbConnId((prev) => (prev === id ? "builtin" : prev))
    } catch {
      setWbError("删除连接失败")
    }
  }, [])

  const workbenchView = useMemo(() => {
    const activeConn = connections.find((c) => c.id === wbConnId) ?? null
    const view = {
      connections,
      wbConnId,
      activeConn,
      isBuiltin: wbConnId === "builtin",
      wbSql,
      wbResult,
      wbBusy,
      wbError,
      wbHistory,
      readOnlyGuard,
      dangerConfirm,
      wbNotice,
      typeMeta: DB_TYPE_META,
    }
    return view
  }, [connections, wbConnId, wbSql, wbResult, wbBusy, wbError, wbHistory, readOnlyGuard, dangerConfirm, wbNotice])

  const backToHome = useCallback(() => {
    setPhase("home")
    setActiveGroupId(null)
    setReport(null)
    setDangerConfirm(null)
  }, [])

  const retryGroup = useCallback(() => {
    if (activeGroupId) chooseGroup(activeGroupId)
  }, [activeGroupId, chooseGroup])

  const goHome = useCallback(() => navigate("/"), [navigate])

  return {
    loading,
    loadError,
    saveError,
    phase,
    terms,
    homeView,
    chooseGroup,
    backToHome,
    taskView,
    setSqlText,
    runSql,
    submitCheck,
    viewAnswerNow,
    showHint,
    nextTask,
    report,
    newReviewTerms,
    retryGroup,
    openWorkbench,
    workbenchView,
    chooseWbConn,
    setWbSql,
    runWbSql,
    confirmDangerExec,
    cancelDangerExec,
    resetBuiltinDb,
    setReadOnlyGuard,
    openConnDialog,
    closeConnDialog,
    connForm,
    connDialogOpen,
    connTestResult,
    connBusy,
    updateConnForm,
    testConnForm,
    saveConnForm,
    deleteConn,
    goHome,
  }
}
