import { useState } from "react"
import { AlertTriangle, Bot, CheckCircle2, Loader2, Play, ShieldAlert, XCircle } from "lucide-react"
import { getBasename } from "@/lib/pb"
import { dblabApi, sshlabApi } from "@/lib/labApi"
import { callLlmWithFallback } from "@/lib/llm"
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
  readOnly = false,
}: {
  questionId: string
  title: string
  kind: "db" | "server"
  connectionId: string
  connection: LabConnection
  readOnly?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [script, setScript] = useState<LabScript | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [results, setResults] = useState<Record<string, StepResult>>({})
  const [pending, setPending] = useState<LabStep | null>(null)

  async function loadDoc(): Promise<string> {
    const base = getBasename().replace(/\/$/, "")
    const res = await fetch(`${base}/content/labs/${questionId}.md`)
    if (!res.ok) throw new Error(`该题文档缺失（HTTP ${res.status}），无法据此生成脚本。`)
    return res.text()
  }

  async function generate() {
    setBusy(true)
    setError("")
    setNotice("")
    setResults({})
    try {
      const doc = await loadDoc()
      const mismatch = environmentMismatch(doc, connection)
      if (mismatch) {
        setError(mismatch)
        return
      }
      const prompt = buildLabScriptPrompt({ title, doc, connection })
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
        kind === "db"
          ? await runSql(connectionId, step.command)
          : await runShell(connectionId, step.command)
      if (!output.ok) {
        setResults((r) => ({ ...r, [step.id]: { ok: false, output: output.text, error: output.error } }))
        return
      }
      const passed = matchLabAssert(step, output.text)
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
            读本题文档 + 你填的{kind === "db" ? "数据库" : "服务器"}连接，生成准备与执行脚本（先预览、再确认执行）
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

async function runSql(connectionId: string, sql: string): Promise<{ ok: boolean; text: string; error?: string }> {
  try {
    const r = await dblabApi.exec(connectionId, sql)
    if (!r.ok) return { ok: false, text: "", error: r.error || "SQL 执行失败" }
    const text = (r.rows ?? []).map((row) => row.map((c) => String(c)).join(" | ")).join("\n")
    return { ok: true, text: text || `执行成功${r.affectedRows !== undefined ? `，影响 ${r.affectedRows} 行` : ""}` }
  } catch (e) {
    return { ok: false, text: "", error: e instanceof Error ? e.message : "SQL 执行失败" }
  }
}

async function runShell(connectionId: string, command: string): Promise<{ ok: boolean; text: string; error?: string }> {
  try {
    const r = await sshlabApi.exec(connectionId, command, 120000)
    const text = [r.stdout ?? "", r.stderr ?? ""].filter(Boolean).join("\n")
    if (!r.ok) return { ok: false, text, error: r.error || r.message || "命令执行失败" }
    return { ok: true, text }
  } catch (e) {
    return { ok: false, text: "", error: e instanceof Error ? e.message : "命令执行失败" }
  }
}
