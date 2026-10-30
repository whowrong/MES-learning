import { ClipboardList, Lightbulb, Play, FileCheck2, Eye, ArrowRight, LogOut, CheckCircle2, XCircle } from "lucide-react"
import type { useDbTraining } from "@/pages/DbTraining/useDbTraining"
import { SqlResultTable } from "./SqlResultTable"
import { LabScriptPanel } from "@/components/lab/LabScriptPanel"
import type { LabConnection } from "@/game/labScripts"

type P = ReturnType<typeof useDbTraining>

/** 任务练习：业务场景卡 + SQL 编辑器（真实执行）+ 提交校验 + 讲解 */
export function TaskStage({
  view,
  setSqlText,
  runSql,
  submitCheck,
  showHint,
  viewAnswerNow,
  nextTask,
  onExit,
  labConnectionId,
  labConnection,
  labReadOnly,
}: {
  view: NonNullable<P["taskView"]>
  labConnectionId?: string
  labConnection?: LabConnection
  labReadOnly?: boolean
  setSqlText: (v: string) => void
  runSql: () => void
  submitCheck: () => void
  showHint: () => void
  viewAnswerNow: () => void
  nextTask: () => void
  onExit: () => void
}) {
  const { task } = view
  const isStateMode = task.check.mode === "state"

  return (
    <section className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
      {/* 顶部：退出 + 进度 */}
      <div className="mb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:shadow-[var(--focus-ring)]"
        >
          <LogOut className="h-3.5 w-3.5" />
          退出本组
        </button>
        <span className="text-[11px] text-muted-foreground">{view.groupName}</span>
        <div className="ml-auto flex items-center gap-1.5" aria-label={`任务进度 ${view.index + 1}/${view.total}`}>
          {Array.from({ length: view.total }, (_, i) => (
            <span
              key={i}
              className={
                "h-1.5 w-6 rounded-full " + (i < view.index ? "bg-primary" : i === view.index ? "bg-primary/40" : "bg-border")
              }
            />
          ))}
          <span className="ml-1 text-[11px] tabular-nums text-muted-foreground">
            {view.index + 1}/{view.total}
          </span>
        </div>
      </div>

      {/* 业务场景卡 */}
      <div className="mb-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="text-sm font-bold text-foreground">{task.title}</h2>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{task.difficulty}</span>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">约 {task.minutes} 分钟</span>
          {isStateMode && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">清洗实操 · 真的会改库</span>
          )}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{task.scene}</p>
        <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-xs font-semibold leading-relaxed text-foreground">
          目标：{task.goal}
        </p>
      </div>

      {/* SQL 编辑器 */}
      <div className="overflow-hidden rounded-xl border border-border bg-muted/60 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border bg-muted/80 px-3 py-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground">SQL 编辑器 · 在内置练习库上真实执行</span>
          <span className="ml-auto text-[10px] text-muted-foreground">Ctrl+Enter 执行</span>
        </div>
        <textarea
          value={view.sqlText}
          onChange={(e) => setSqlText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) runSql()
          }}
          disabled={view.solved}
          rows={6}
          spellCheck={false}
          aria-label="SQL 编辑区"
          className="w-full resize-y bg-transparent px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-60"
          placeholder="-- 在这里写 SQL，先执行看结果，再提交校验"
        />
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/80 px-3 py-2">
          <button
            type="button"
            onClick={runSql}
            disabled={view.execBusy || view.solved || !view.sqlText.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-40 focus-visible:shadow-[var(--focus-ring)]"
          >
            <Play className="h-3.5 w-3.5" />
            执行（不限次数）
          </button>
          <button
            type="button"
            onClick={submitCheck}
            disabled={view.solved || view.execBusy}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40 focus-visible:shadow-[var(--focus-ring)]"
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            {isStateMode ? "提交校验（验证库状态）" : "提交校验（比对结果）"}
          </button>
          {!view.solved && !view.hintVisible && (
            <button
              type="button"
              onClick={showHint}
              className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:shadow-[var(--focus-ring)]"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              提示（计次扣分）
            </button>
          )}
          {!view.solved && (
            <button
              type="button"
              onClick={viewAnswerNow}
              className="flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline focus-visible:shadow-[var(--focus-ring)]"
            >
              <Eye className="h-3.5 w-3.5" />
              看参考答案（按 60 分计）
            </button>
          )}
          {view.checkAttempts > 0 && !view.solved && (
            <span className="ml-auto text-[10px] text-muted-foreground">已提交 {view.checkAttempts} 次</span>
          )}
        </div>
      </div>

      {/* 提示 */}
      {view.hintVisible && !view.solved && (
        <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground">
          <span className="font-semibold text-primary">提示：</span>
          {task.hint}
        </div>
      )}

      {/* 校验判定 */}
      {view.verdict && !view.verdict.passed && !view.solved && (
        <div className="mt-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs">
          <p className="flex items-start gap-1.5 font-semibold text-destructive">
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            校验未通过（第 {view.checkAttempts} 次提交）
          </p>
          <p className="mt-1 text-muted-foreground">{view.verdict.diffHint}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">回去改 SQL 再执行、再提交。提交次数越少得分越高。</p>
        </div>
      )}

      {/* 执行结果 */}
      <div className="mt-3">
        <SqlResultTable result={view.execResult} error={view.execError || undefined} busy={view.execBusy} />
      </div>

      {/* 通过后的讲解 */}
      {view.solved && (
        <div className="mt-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <CheckCircle2 className="h-4 w-4" />
            {view.viewedAnswer ? "已查看参考答案——把它读懂再自己重写一遍才算真会" : `校验通过（第 ${view.checkAttempts} 次提交）`}
          </p>
          <div className="mt-2">
            <p className="text-[11px] font-semibold text-muted-foreground">参考答案</p>
            <pre className="mt-1 overflow-x-auto rounded-lg bg-muted/70 p-2.5 font-mono text-[11px] leading-relaxed text-foreground">
              {task.answerSql}
            </pre>
          </div>
          <p className="mt-2 text-[11px] font-semibold text-muted-foreground">为什么这么写 · 实施现场会怎样</p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">{task.explanation}</p>
          <button
            type="button"
            onClick={nextTask}
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground focus-visible:shadow-[var(--focus-ring)]"
          >
            {view.isLast ? "完成本组，出报告" : "下一个任务"}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* AI 演练助手：读本题文档 + 你填的数据库连接，生成准备与执行脚本 */}
      {labConnectionId && labConnection && (
        <div className="mt-4">
          <LabScriptPanel
            questionId={task.id}
            title={task.title}
            kind="db"
            connectionId={labConnectionId}
            connection={labConnection}
            readOnly={labReadOnly}
          />
        </div>
      )}
    </section>
  )
}
