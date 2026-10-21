import { RotateCcw, ListOrdered, Home, ChevronLeft, CheckCircle2, XCircle, BookMarked } from "lucide-react"
import type { OpsReport } from "@/pages/OpsTraining/useOpsTraining"

const RANK_STYLE: Record<string, string> = {
  S: "border-primary bg-primary/15 text-primary",
  A: "border-primary/60 bg-primary/10 text-primary",
  B: "border-border bg-muted text-foreground",
  C: "border-destructive/50 bg-destructive/10 text-destructive",
}

/** 演练报告：评分评级 + 分形式明细（终端 SOP 回放 / 决策逐题回顾 / 排序正解与理由） */
export function OpsReportPanel({
  report,
  newReviewTerms,
  onRetry,
  onBackToList,
  onBackToDomains,
  onHome,
}: {
  report: OpsReport
  newReviewTerms: string[]
  onRetry: () => void
  onBackToList: () => void
  onBackToDomains: () => void
  onHome: () => void
}) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <span
            className={
              "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 text-2xl font-black " +
              (RANK_STYLE[report.rank] ?? RANK_STYLE.C)
            }
          >
            {report.rank}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{report.title} · 演练报告</p>
            <p className="mt-0.5 text-2xl font-black tabular-nums text-foreground">
              {report.score}
              <span className="text-sm font-semibold text-muted-foreground"> / {report.kind === "terminal" ? 100 : 100} 分</span>
            </p>
          </div>
        </div>
        {report.rankText && <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{report.rankText}</p>}

        {report.terminal && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-muted/60 p-3 text-center">
              <p className="text-lg font-bold tabular-nums text-foreground">{report.terminal.steps}</p>
              <p className="text-[11px] text-muted-foreground">处置步骤</p>
            </div>
            <div className="rounded-xl bg-muted/60 p-3 text-center">
              <p className="text-lg font-bold tabular-nums text-foreground">{report.terminal.hintsUsed}</p>
              <p className="text-[11px] text-muted-foreground">使用提示（每次 -10）</p>
            </div>
            <div className="rounded-xl bg-muted/60 p-3 text-center">
              <p className="text-lg font-bold tabular-nums text-foreground">{report.terminal.wrongAttempts}</p>
              <p className="text-[11px] text-muted-foreground">错误尝试（每次 -5）</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4 sm:col-span-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <ListOrdered className="h-3.5 w-3.5 text-primary" />
                标准操作序列（SOP）——背下来，下次照做
              </p>
              <ol className="mt-2 flex flex-col gap-1.5">
                {report.terminal.sop.map((cmd, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">{i + 1}.</span>
                    <code className="min-w-0 flex-1 break-all rounded bg-muted/70 px-2 py-1 font-mono text-[11px] text-foreground">
                      {cmd}
                    </code>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {report.choice && (
          <div className="mt-5">
            <p className="text-xs font-bold text-foreground">
              答对 {report.choice.correctCount}/{report.choice.total} 题 · 逐题回顾
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {report.choice.questions.map((q, i) => {
                const rec = report.choice?.perQuestion.find((a) => a.questionId === q.id)
                const correct = rec?.correct ?? false
                return (
                  <details key={q.id} className="rounded-xl border border-border bg-background">
                    <summary className="flex cursor-pointer items-center gap-2 px-3.5 py-2.5 text-xs text-foreground">
                      {correct ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {i + 1}. {q.prompt}
                      </span>
                    </summary>
                    <div className="border-t border-border px-3.5 py-2.5 text-xs leading-relaxed">
                      <p className="text-primary">正确：{q.options.find((o) => o.id === q.answer)?.text}</p>
                      <p className="mt-1.5 text-muted-foreground">{q.feedback.consultant}</p>
                    </div>
                  </details>
                )
              })}
            </div>
          </div>
        )}

        {report.order && (
          <div className="mt-5">
            <p className="text-xs font-bold text-foreground">
              {report.order.solved ? `第 ${report.order.attemptsUsed} 次提交排对` : "机会用完，以下是正解"} · 每步的定位理由
            </p>
            <ol className="mt-2 flex flex-col gap-2">
              {report.order.steps.map((s, i) => (
                <li key={s.id} className="rounded-xl border border-border bg-background px-3.5 py-2.5">
                  <p className="text-xs text-foreground">
                    <span className="mr-1.5 font-mono text-[10px] text-primary tabular-nums">{i + 1}.</span>
                    {s.text}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{s.note}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {newReviewTerms.length > 0 && (
          <p className="mt-4 flex items-center gap-1.5 rounded-xl bg-primary/10 px-3.5 py-2.5 text-[11px] text-primary">
            <BookMarked className="h-3.5 w-3.5 shrink-0" />
            本次答错的关联术语已加入术语卡复习队列（{newReviewTerms.length} 个）。
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground focus-visible:shadow-[var(--focus-ring)]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          再做一遍
        </button>
        <button
          type="button"
          onClick={onBackToList}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-xs text-foreground focus-visible:shadow-[var(--focus-ring)]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          返回训练清单
        </button>
        <button
          type="button"
          onClick={onBackToDomains}
          className="rounded-lg border border-border bg-card px-4 py-2 text-xs text-foreground focus-visible:shadow-[var(--focus-ring)]"
        >
          换个训练域
        </button>
        <button
          type="button"
          onClick={onHome}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-xs text-muted-foreground hover:text-foreground focus-visible:shadow-[var(--focus-ring)]"
        >
          <Home className="h-3.5 w-3.5" />
          回首页
        </button>
      </div>
    </section>
  )
}
