import { useEffect, useRef, useState } from "react"
import { ClipboardList, Lightbulb, Send, FileCheck2, RotateCcw, CircleAlert, Copy, Check } from "lucide-react"
import { LabScriptPanel } from "@/components/lab/LabScriptPanel"
import type { LabConnection } from "@/game/labScripts"
import type { OpsTerminalDrill } from "@/content/opsTraining"
import type { TerminalRun } from "@/game/opsTerminal"

export interface TerminalView {
  drill: OpsTerminalDrill
  run: TerminalRun
  stepIndex: number
  stepTotal: number
  currentObjective: string
  canFinish: boolean
}

const LINE_CLASS: Record<string, string> = {
  cmd: "font-semibold text-foreground",
  out: "whitespace-pre-wrap text-muted-foreground",
  info: "whitespace-pre-wrap text-primary/90",
  warn: "whitespace-pre-wrap text-destructive",
  ok: "whitespace-pre-wrap text-primary",
}

/** 剪贴板兜底：clipboard API 在非安全上下文/iframe 里可能不可用，退回 execCommand */
function legacyCopy(text: string) {
  const ta = document.createElement("textarea")
  ta.value = text
  ta.setAttribute("readonly", "")
  ta.style.position = "fixed"
  ta.style.opacity = "0"
  document.body.appendChild(ta)
  ta.select()
  document.execCommand("copy")
  document.body.removeChild(ta)
}

/** 交互式模拟终端：事故工单 + 逐步目标 + 命令输入 + 模拟输出 */
export function TerminalDrill({
  view,
  onCommand,
  onHint,
  onFinish,
  onRetry,
  onExit,
  labConnectionId,
  labConnection,
}: {
  view: TerminalView
  onCommand: (cmd: string) => void
  onHint: () => void
  onFinish: () => void
  onRetry: () => void
  onExit: () => void
  /** 真实服务器连接（AI 生成脚本用；没有连接时不出这个面板） */
  labConnectionId?: string
  labConnection?: LabConnection
}) {
  const [input, setInput] = useState("")
  const [ticketOpen, setTicketOpen] = useState(true)
  const [copyState, setCopyState] = useState<"" | "ok" | "fail">("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const copyTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [view.run.lines.length])

  useEffect(() => () => {
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
  }, [])

  const submit = () => {
    const cmd = input.trim()
    if (!cmd) return
    onCommand(cmd)
    setInput("")
    inputRef.current?.focus()
  }

  /** 复制全部：工单上下文 + 完整终端记录，可直接贴给 AI 提问 */
  const copyTranscript = async () => {
    const t = view.drill.ticket
    const parts = [
      `【演练】${view.drill.title}`,
      `【背景】${t.background}`,
      `【现象】${t.symptom}`,
      `【处置目标】${t.objective}`,
    ]
    if (!view.run.finished) parts.push(`【当前步骤目标】${view.currentObjective}`)
    parts.push("—— 终端记录 ——")
    for (const line of view.run.lines) {
      parts.push(line.kind === "cmd" ? `${view.drill.prompt} ${line.text}` : line.text)
    }
    const text = parts.join("\n")
    let ok = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        ok = true
      }
    } catch {
      ok = false
    }
    if (!ok) {
      try {
        legacyCopy(text)
        ok = true
      } catch {
        ok = false
      }
    }
    setCopyState(ok ? "ok" : "fail")
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
    copyTimerRef.current = window.setTimeout(() => setCopyState(""), ok ? 1500 : 2500)
  }

  const doneCount = view.run.finished ? view.stepTotal : view.stepIndex

  return (
    <section className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
      {/* 事故工单 */}
      <div className="mb-3 rounded-xl border border-border bg-card shadow-sm">
        <button
          type="button"
          onClick={() => setTicketOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left focus-visible:shadow-[var(--focus-ring)]"
        >
          <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-xs font-bold text-foreground">事故工单 · {view.drill.title}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">{ticketOpen ? "收起" : "展开"}</span>
        </button>
        {ticketOpen && (
          <dl className="grid gap-2 border-t border-border px-4 py-3 text-xs leading-relaxed sm:grid-cols-3">
            <div>
              <dt className="font-semibold text-muted-foreground">背景</dt>
              <dd className="mt-0.5 text-foreground">{view.drill.ticket.background}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted-foreground">现象</dt>
              <dd className="mt-0.5 text-foreground">{view.drill.ticket.symptom}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted-foreground">处置目标</dt>
              <dd className="mt-0.5 text-foreground">{view.drill.ticket.objective}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* 步骤进度 + 当前目标 */}
      <div className="mb-2 flex items-center gap-3">
        <div className="flex items-center gap-1.5" aria-label={`处置进度 ${doneCount}/${view.stepTotal}`}>
          {Array.from({ length: view.stepTotal }, (_, i) => (
            <span
              key={i}
              className={
                "h-1.5 w-6 rounded-full " +
                (i < doneCount ? "bg-primary" : i === doneCount && !view.run.finished ? "bg-primary/40" : "bg-border")
              }
            />
          ))}
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {doneCount}/{view.stepTotal}
        </span>
        <button
          type="button"
          onClick={onHint}
          disabled={view.run.finished}
          className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 focus-visible:shadow-[var(--focus-ring)]"
        >
          <Lightbulb className="h-3.5 w-3.5" />
          提示（计次扣分）
        </button>
      </div>
      <p className="mb-2 flex items-start gap-1.5 text-xs font-semibold text-foreground">
        <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        当前目标：{view.currentObjective}
      </p>

      {/* 终端窗口 */}
      <div className="overflow-hidden rounded-xl border border-border bg-muted/60 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border bg-muted/80 px-3 py-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground">演练终端 · 文字可选中复制</span>
          <button
            type="button"
            onClick={copyTranscript}
            aria-label="复制全部终端记录"
            className="ml-auto flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:shadow-[var(--focus-ring)]"
          >
            {copyState === "ok" ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
            {copyState === "ok" ? "已复制" : copyState === "fail" ? "复制失败，请手动全选" : "复制全部"}
          </button>
        </div>
        <div
          ref={scrollRef}
          className="h-[46vh] min-h-[280px] select-text overflow-y-auto px-3 py-2.5 font-mono text-xs leading-relaxed sm:h-[52vh]"
          onClick={() => {
            // 有选中文本时不抢焦点，保护复制操作（手机端尤其重要）
            const sel = window.getSelection()
            if (sel && sel.toString().length > 0) return
            inputRef.current?.focus()
          }}
          role="log"
          aria-live="polite"
        >
          {view.run.lines.map((line, i) => (
            <p key={i} className={"mb-1 " + (LINE_CLASS[line.kind] ?? "")}>
              {line.kind === "cmd" ? `${view.drill.prompt} ${line.text}` : line.text}
            </p>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-border bg-muted/80 px-3 py-2">
          <span className="shrink-0 font-mono text-xs text-primary">{view.drill.prompt}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit()
            }}
            disabled={view.run.finished}
            placeholder={view.run.finished ? "演练已完成" : "输入命令后回车…"}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="终端命令输入"
            className="min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={submit}
            disabled={view.run.finished || !input.trim()}
            aria-label="执行命令"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40 focus-visible:shadow-[var(--focus-ring)]"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 底部动作 */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {view.run.finished && (
          <button
            type="button"
            onClick={onFinish}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground focus-visible:shadow-[var(--focus-ring)]"
          >
            <FileCheck2 className="h-4 w-4" />
            查看演练报告
          </button>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:text-foreground focus-visible:shadow-[var(--focus-ring)]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          重新演练
        </button>
        <button
          type="button"
          onClick={onExit}
          className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:shadow-[var(--focus-ring)]"
        >
          退出，返回训练清单
        </button>
      </div>

      {/* AI 演练助手：读本题文档 + 你填的服务器连接，生成准备与执行脚本 */}
      {labConnectionId && labConnection && (
        <div className="mt-4">
          <LabScriptPanel
            questionId={view.drill.id}
            title={view.drill.title}
            kind="server"
            connectionId={labConnectionId}
            connection={labConnection}
          />
        </div>
      )}
    </section>
  )
}
