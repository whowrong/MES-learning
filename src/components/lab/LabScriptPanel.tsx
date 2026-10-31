import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Bot, CheckCircle2, Container, Loader2, Play, ShieldAlert, Trash2, XCircle } from "lucide-react"
import { getBasename } from "@/lib/pb"
import {
  labEnvApi,
  runLabJob,
  LAB_STEP_TIMEOUT_MS,
  type LabEnvConnection,
  type LabEnvInfo,
} from "@/lib/labApi"
import { callLlmWithFallback } from "@/lib/llm"
import { LAB_ENV_MODES, labEnvModeSpec, type LabEnvMode } from "@/game/labEnv"
import {
  LAB_LLM_MODEL,
  buildLabScriptPrompt,
  detectLabDanger,
  environmentMismatch,
  matchLabAssert,
  parseLabScriptResponse,
  type LabConnection,
  type LabScript,
  type LabStep,
} from "@/game/labScripts"

interface StepResult {
  ok: boolean
  output: string
  error?: string
}

export function LabScriptPanel({
  questionId,
  title,
  kind,
  connectionId,
  connection,
  dbType,
  readOnly = false,
}: {
  questionId: string
  title: string
  kind: "db" | "server"
  connectionId: string
  connection: LabConnection
  /** 数据库题型：模式 B 建容器时用它决定引擎 */
  dbType?: "mysql" | "postgres" | "sqlserver"
  readOnly?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [script, setScript] = useState<LabScript | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [results, setResults] = useState<Record<string, StepResult>>({})
  const [pending, setPending] = useState<LabStep | null>(null)

  // —— 两种演练环境模式 ——
  const [mode, setMode] = useState<LabEnvMode>("remote")
  const [env, setEnv] = useState<LabEnvInfo | null>(null)
  const [envBusy, setEnvBusy] = useState(false)
  const [envError, setEnvError] = useState("")
  const [useExisting, setUseExisting] = useState(false)
  const [existing, setExisting] = useState({
    host: "127.0.0.1",
    port: "",
    username: "lab",
    password: "",
    database: "lab",
  })
  /** 模式 B 的执行目标（口令只在内存里，不落连接登记） */
  const [inlineTarget, setInlineTarget] = useState<LabEnvConnection | null>(null)

  const modeSpec = labEnvModeSpec(mode)

  /** 提示词与执行用的连接描述（永远不含口令） */
  const targetConnection: LabConnection = useMemo(() => {
    if (mode === "site" && inlineTarget) {
      return {
        kind,
        type: kind === "db" ? (inlineTarget.type ?? dbType ?? "mysql") : undefined,
        host: inlineTarget.host,
        port: inlineTarget.port,
        database: kind === "db" ? inlineTarget.database : undefined,
        username: inlineTarget.username,
      }
    }
    return connection
  }, [mode, inlineTarget, kind, dbType, connection])

  async function loadDoc(): Promise<string> {
    const base = getBasename().replace(/\/$/, "")
    const res = await fetch(`${base}/content/labs/${questionId}.md`)
    if (!res.ok) throw new Error(`该题文档缺失（HTTP ${res.status}），无法据此生成脚本。`)
    return res.text()
  }

  async function createSiteEnv() {
    setEnvBusy(true)
    setEnvError("")
    try {
      // 建容器要拉镜像、等就绪，耗时常常超过网关的单请求上限，所以走作业通道
      const job = await runLabJob(
        { kind: "labenv", action: "create", envKind: kind, dbType: kind === "db" ? dbType ?? "mysql" : undefined },
        { timeoutMs: LAB_STEP_TIMEOUT_MS * 2 + 60000 },
      )
      const res = (job.result ?? {}) as { ok?: boolean; env?: LabEnvInfo; error?: string }
      if (!job.ok || !res.ok || !res.env) {
        setEnvError(res.error || job.error || "创建一次性演练环境失败，可重试。")
        return
      }
      setEnv(res.env)
      setInlineTarget(res.env.connection)
      setNotice(
        `一次性${kind === "db" ? "数据库" : "服务器"}环境已就绪（${res.env.engine}，127.0.0.1:${res.env.port}）。` +
          "口令只回显一次、不落盘；演练结束请点「结束演练并销毁环境」。",
      )
    } catch (e) {
      setEnvError(e instanceof Error ? e.message : "创建一次性演练环境失败，可重试。")
    } finally {
      setEnvBusy(false)
    }
  }

  async function destroySiteEnv() {
    if (!env) return
    setEnvBusy(true)
    try {
      const res = await labEnvApi.destroy(env.id)
      setEnv(null)
      setInlineTarget(null)
      setNotice(res.ok ? "一次性演练环境已销毁，端口已释放。" : res.error || "销毁失败，可重试。")
    } catch (e) {
      setEnvError(e instanceof Error ? e.message : "销毁失败，可重试。")
    } finally {
      setEnvBusy(false)
    }
  }

  // 离开页面时尽量销毁一次性环境（演练结束自动清理的后台兜底）
  useEffect(() => {
    return () => {
      const id = env?.id
      if (!id) return
      void labEnvApi.destroy(id).catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env?.id])

  function applyExistingConnection() {
    const port = Number(existing.port)
    if (!existing.host || !port || !existing.username) {
      setEnvError("请填写主机、端口与账号（端口为数字）。")
      return
    }
    if (!existing.password) {
      setEnvError("请填写该环境的口令；站点不会替你保管。")
      return
    }
    setEnvError("")
    setInlineTarget({
      type: kind === "db" ? dbType ?? "mysql" : undefined,
      host: existing.host,
      port,
      database: kind === "db" ? existing.database : undefined,
      username: existing.username,
      password: existing.password,
    })
    setNotice("已切换到你在目标机上已有的容器/端口，站点不会创建或销毁它。")
  }

  async function generate() {
    if (mode === "site" && !useExisting && !inlineTarget) {
      setError("模式 B 需要先创建一次性演练环境（或选择使用已有容器/端口），再生成脚本。")
      return
    }
    setBusy(true)
    setError("")
    setNotice("")
    setResults({})
    try {
      const doc = await loadDoc()
      const mismatch = environmentMismatch(doc, targetConnection)
      if (mismatch) {
        setError(mismatch)
        return
      }
      const prompt = buildLabScriptPrompt({ title, doc, connection: targetConnection })
      const res = await callLlmWithFallback(LAB_LLM_MODEL, {
        messages: [{ role: "user", content: prompt }],
      })
      if (!res.ok) {
        setError(
          res.error === "not_found"
            ? "AI 上游（mimo-v2.6-pro）当前不可用，无法生成脚本。可以按题目文档手工执行，或稍后重试。"
            : `AI 生成失败：${res.error || "上游返回异常"}。可以按题目文档手工执行。`,
        )
        return
      }
      const parsed = parseLabScriptResponse(res.text)
      if (!parsed.ok) {
        setError(parsed.error)
        return
      }
      setScript(parsed.script)
      setNotice("脚本已生成。执行前请逐条确认命令作用范围，危险命令需要二次确认。")
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成脚本失败")
    } finally {
      setBusy(false)
    }
  }

  async function execute(step: LabStep) {
    setPending(null)
    setBusy(true)
    try {
      const isWrite = /\b(insert|update|delete|drop|truncate|alter|create)\b/i.test(step.command)
      if (readOnly && isWrite && kind === "db") {
        setResults((r) => ({
          ...r,
          [step.id]: { ok: false, output: "", error: "当前连接开启了只读保护，写操作已被拦下。可在「数据库工作台」里显式关闭只读保护后再执行。" },
        }))
        return
      }
      const output =
        mode === "site" && inlineTarget
          ? kind === "db"
            ? await runSqlInline(inlineTarget, step.command)
            : await runShellInline(inlineTarget, step.command)
          : kind === "db"
            ? await runSql(connectionId, step.command)
            : await runShell(connectionId, step.command)
      if (!output.ok) {
        setResults((r) => ({ ...r, [step.id]: { ok: false, output: output.text, error: output.error } }))
        return
      }
      // 判分口径两种模式完全一致：命中验收正则即达标（输出优先，命令片段兜底）
      const passed = matchLabAssert(step, output.text) || matchLabAssert(step, step.command)
      setResults((r) => ({
        ...r,
        [step.id]: {
          ok: passed,
          output: output.text,
          error: passed ? undefined : "执行成功，但没有命中本步的验收正则，判为未达标。",
        },
      }))
    } finally {
      setBusy(false)
    }
  }

  function onRun(step: LabStep) {
    const danger = detectLabDanger(step.command)
    if (danger.danger) {
      setPending(step)
      return
    }
    void execute(step)
  }

  const steps = script ? [...script.prep_steps, ...script.exec_steps] : []

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Bot className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold text-foreground">AI 演练助手</p>
          <p className="text-[11px] text-muted-foreground">
            读本题文档 + 目标环境连接，生成准备与执行脚本（先预览、再确认执行）
          </p>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="ml-auto rounded-md border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          {busy ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : null}
          生成环境脚本
        </button>
      </div>

      {/* 执行环境模式：两种并列模式，只切换执行目标 */}
      <div className="mt-3 rounded-lg border border-border/60 p-3">
        <p className="text-xs font-semibold text-foreground">这道题在哪台环境上做？</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {LAB_ENV_MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              onClick={() => {
                setMode(m.mode)
                setEnvError("")
                if (m.mode === "remote") {
                  setEnv(null)
                  setInlineTarget(null)
                }
              }}
              className={`rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                mode === m.mode
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{modeSpec.hint}</p>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">取舍：{modeSpec.tradeoff}</p>

        {mode === "site" && (
          <div className="mt-3 space-y-2 rounded-lg bg-muted/40 p-3">
            {useExisting ? (
              <>
                <p className="text-[11px] leading-5 text-muted-foreground">
                  使用你在部署机上已存在的容器/端口：站点不会创建，也不会销毁它。
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <label className="col-span-1 block space-y-1">
                    <span>主机</span>
                    <input
                      value={existing.host}
                      onChange={(e) => setExisting({ ...existing, host: e.target.value })}
                      className="w-full rounded-md border bg-background px-2 py-1"
                    />
                  </label>
                  <label className="col-span-1 block space-y-1">
                    <span>端口</span>
                    <input
                      value={existing.port}
                      onChange={(e) => setExisting({ ...existing, port: e.target.value })}
                      className="w-full rounded-md border bg-background px-2 py-1"
                    />
                  </label>
                  <label className="col-span-1 block space-y-1">
                    <span>账号</span>
                    <input
                      value={existing.username}
                      onChange={(e) => setExisting({ ...existing, username: e.target.value })}
                      className="w-full rounded-md border bg-background px-2 py-1"
                    />
                  </label>
                  <label className="col-span-1 block space-y-1">
                    <span>口令</span>
                    <input
                      type="password"
                      value={existing.password}
                      onChange={(e) => setExisting({ ...existing, password: e.target.value })}
                      className="w-full rounded-md border bg-background px-2 py-1"
                    />
                  </label>
                  {kind === "db" && (
                    <label className="col-span-2 block space-y-1">
                      <span>库名</span>
                      <input
                        value={existing.database}
                        onChange={(e) => setExisting({ ...existing, database: e.target.value })}
                        className="w-full rounded-md border bg-background px-2 py-1"
                      />
                    </label>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={applyExistingConnection}
                    className="rounded-md border px-3 py-1.5 text-[11px] text-foreground"
                  >
                    使用这个环境
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUseExisting(false)
                      setInlineTarget(null)
                    }}
                    className="rounded-md border px-3 py-1.5 text-[11px] text-foreground"
                  >
                    改用站点新建的一次性环境
                  </button>
                </div>
              </>
            ) : env ? (
              <div className="space-y-2">
                <p className="text-[11px] leading-5 text-muted-foreground">
                  已就绪：{env.engine} · 127.0.0.1:{env.port} · 容器 {env.container}。
                  口令只回显一次、不落盘、不进日志；演练结束请销毁。
                </p>
                <button
                  type="button"
                  onClick={() => void destroySiteEnv()}
                  disabled={envBusy}
                  className="rounded-md border border-destructive/40 px-3 py-1.5 text-[11px] text-destructive disabled:opacity-60"
                >
                  <Trash2 className="mr-1 inline h-3 w-3" />
                  结束演练并销毁环境
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] leading-5 text-muted-foreground">
                  站点会在部署机上起一个可丢弃的容器（{kind === "db" ? "数据库容器" : "sshd 容器"}），
                  端口与随机口令自动生成；演练结束或超时自动销毁、释放端口。
                </p>
                <button
                  type="button"
                  onClick={() => void createSiteEnv()}
                  disabled={envBusy}
                  className="rounded-md border px-3 py-1.5 text-[11px] text-foreground disabled:opacity-60"
                >
                  {envBusy ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : <Container className="mr-1 inline h-3.5 w-3.5" />}
                  创建一次性演练环境
                </button>
              </div>
            )}
            {envError && (
              <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-[11px] leading-5 text-destructive">{envError}</p>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {notice && !error && (
        <p className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-xs leading-5 text-muted-foreground">{notice}</p>
      )}

      {script && (
        <div className="mt-3 space-y-3">
          {script.env_check.length > 0 && (
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-xs font-semibold text-foreground">执行前只读检查</p>
              <ul className="mt-1 space-y-1 text-[11px] leading-5 text-muted-foreground">
                {script.env_check.map((c) => (
                  <li key={c}>· {c}</li>
                ))}
              </ul>
            </div>
          )}
          {script.notes && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] leading-5 text-amber-700">
              ⚠️ {script.notes}
            </p>
          )}
          {steps.map((step, idx) => {
            const result = results[step.id]
            const danger = detectLabDanger(step.command)
            return (
              <div key={step.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {idx < script.prep_steps.length ? `准备 ${idx + 1}` : `执行 ${idx - script.prep_steps.length + 1}`}
                  </span>
                  <span className="text-xs font-medium text-foreground">{step.title}</span>
                  {(step.danger || danger.danger) && (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">破坏性操作</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onRun(step)}
                    disabled={busy}
                    className="ml-auto rounded-md border px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-muted disabled:opacity-60"
                  >
                    <Play className="mr-1 inline h-3 w-3" />
                    执行这一步
                  </button>
                </div>
                <pre className="mt-2 overflow-x-auto rounded-md bg-muted/60 px-2 py-1.5 text-[11px] leading-5 text-foreground">
                  {step.command}
                </pre>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">预期：{step.expect || "（模型未给出）"}</p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  验收正则：{step.assert.map((a) => a).join(" 或 ") || "（无）"}
                </p>
                {result && (
                  <p
                    className={`mt-2 flex items-start gap-2 rounded-md px-2 py-1.5 text-[11px] leading-5 ${
                      result.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {result.ok ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>
                      {result.ok ? "已命中验收正则，这一步达标。" : result.error}
                      {result.output && (
                        <span className="mt-1 block whitespace-pre-wrap font-mono text-[10px] opacity-80">
                          {result.output.slice(0, 800)}
                        </span>
                      )}
                    </span>
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {pending && (
        <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="flex items-center gap-2 text-xs font-semibold text-destructive">
            <ShieldAlert className="h-4 w-4" />
            这条命令可能造成不可逆破坏
          </p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted/60 px-2 py-1.5 text-[11px] leading-5 text-foreground">
            {pending.command}
          </pre>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
            {pending.dangerNote || detectLabDanger(pending.command).note}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void execute(pending)}
              className="rounded-md bg-destructive px-3 py-1.5 text-[11px] font-medium text-destructive-foreground"
            >
              我确认在演练环境，执行
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-md border px-3 py-1.5 text-[11px] text-foreground"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * 四种执行入口统一走作业通道：
 * 网关对单个 HTTP 请求约 20 秒硬截断，同步执行长步骤必然 502；
 * 作业通道把执行搬出请求生命周期，浏览器轮询取结果。
 */
async function runSql(connectionId: string, sql: string): Promise<{ ok: boolean; text: string; error?: string }> {
  try {
    const job = await runLabJob({ kind: "db", connectionId, sql }, { timeoutMs: 120000 })
    const r = (job.result ?? {}) as { ok?: boolean; rows?: unknown[][]; affectedRows?: number; error?: string }
    if (!job.ok || r.ok === false) return { ok: false, text: "", error: r.error || job.error || "SQL 执行失败" }
    const text = (r.rows ?? []).map((row) => row.map((c) => String(c)).join(" | ")).join("\n")
    return { ok: true, text: text || `执行成功${r.affectedRows !== undefined ? `，影响 ${r.affectedRows} 行` : ""}` }
  } catch (e) {
    return { ok: false, text: "", error: e instanceof Error ? e.message : "SQL 执行失败" }
  }
}

async function runSqlInline(connection: LabEnvConnection, sql: string): Promise<{ ok: boolean; text: string; error?: string }> {
  try {
    const job = await runLabJob({ kind: "db", connection, sql }, { timeoutMs: 120000 })
    const r = (job.result ?? {}) as { ok?: boolean; rows?: unknown[][]; affectedRows?: number; error?: string }
    if (!job.ok || r.ok === false) return { ok: false, text: "", error: r.error || job.error || "SQL 执行失败" }
    const text = (r.rows ?? []).map((row) => row.map((c) => String(c)).join(" | ")).join("\n")
    return { ok: true, text: text || `执行成功${r.affectedRows !== undefined ? `，影响 ${r.affectedRows} 行` : ""}` }
  } catch (e) {
    return { ok: false, text: "", error: e instanceof Error ? e.message : "SQL 执行失败" }
  }
}

async function runShell(connectionId: string, command: string): Promise<{ ok: boolean; text: string; error?: string }> {
  try {
    const job = await runLabJob(
      { kind: "server", connectionId, command, timeoutMs: LAB_STEP_TIMEOUT_MS },
      { timeoutMs: LAB_STEP_TIMEOUT_MS + 30000 },
    )
    const r = (job.result ?? {}) as { ok?: boolean; stdout?: string; stderr?: string; error?: string; message?: string }
    const text = [r.stdout ?? "", r.stderr ?? ""].filter(Boolean).join("\n")
    if (!job.ok || r.ok === false) return { ok: false, text, error: r.error || r.message || job.error || "命令执行失败" }
    return { ok: true, text }
  } catch (e) {
    return { ok: false, text: "", error: e instanceof Error ? e.message : "命令执行失败" }
  }
}

async function runShellInline(connection: LabEnvConnection, command: string): Promise<{ ok: boolean; text: string; error?: string }> {
  try {
    const job = await runLabJob(
      { kind: "server", connection, command, timeoutMs: LAB_STEP_TIMEOUT_MS },
      { timeoutMs: LAB_STEP_TIMEOUT_MS + 30000 },
    )
    const r = (job.result ?? {}) as { ok?: boolean; stdout?: string; stderr?: string; error?: string; message?: string }
    const text = [r.stdout ?? "", r.stderr ?? ""].filter(Boolean).join("\n")
    if (!job.ok || r.ok === false) return { ok: false, text, error: r.error || r.message || job.error || "命令执行失败" }
    return { ok: true, text }
  } catch (e) {
    return { ok: false, text: "", error: e instanceof Error ? e.message : "命令执行失败" }
  }
}
