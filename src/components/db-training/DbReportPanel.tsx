import { Trophy, RotateCcw, Home, BookOpen, CheckCircle2, XCircle } from "lucide-react"
import type { DbGroupReport } from "@/pages/DbTraining/useDbTraining"
import type { TermDef } from "@/content/loader"

const RANK_STYLE: Record<string, string> = {
  S: "border-primary bg-primary/10 text-primary",
  A: "border-primary/60 bg-primary/5 text-primary",
  B: "border-border bg-card text-foreground",
  C: "border-border bg-card text-muted-foreground",
}

/** 任务组练习报告：评级 + 逐任务明细 + 参考答案回顾 */
export function DbReportPanel({
  report,
  newReviewTerms,
  terms,
  onRetry,
  onBackHome,
  onGoHome,
}: {
  report: DbGroupReport
  newReviewTerms: string[]
  terms: Record<string, TermDef>
  onRetry: () => void
  onBackHome: () => void
  onGoHome: () => void
}) {
  const perfectCount = report.results.filter((r) => r.score >= 100).length

  return (
    <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* 评级卡 */}
      <div className={"rounded-xl border p-5 text-center shadow-sm " + (RANK_STYLE[report.rank] ?? RANK_STYLE.C)}>
        <p className="text-xs text-muted-foreground">{report.groupName} · 练习报告</p>
        <p className="mt-1 text-4xl font-black tabular-nums">{report.score}</p>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-sm font-bold">
          <Trophy className="h-4 w-4" />
          {report.rank} 级 · {perfectCount}/{report.results.length} 个任务一次通过
        </p>
        {report.rankText && <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">{report.rankText}</p>}
      </div>

      {newReviewTerms.length > 0 && (
        <p className="mt-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground">
          <BookOpen className="mr-1 inline h-3 w-3 text-primary" />
          未满分任务关联的 {newReviewTerms.length} 个术语已加入复习队列：
          {newReviewTerms.map((t) => terms[t]?.term ?? t).join("、")}
        </p>
      )}

      {/* 逐任务明细 */}
      <ul className="mt-4 space-y-2">
        {report.results.map((r) => (
          <li key={r.taskId} className="rounded-xl border border-border bg-card">
            <details>
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-xs">
                {r.score >= 100 ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                )}
                <span className="font-semibold text-foreground">{r.title}</span>
                <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                  {r.score} 分 · 提交 {r.attempts} 次{r.hintUsed ? " · 用提示" : ""}{r.viewedAnswer ? " · 看答案" : ""}
                </span>
              </summary>
              <div className="border-t border-border px-4 py-3">
                <p className="text-[11px] font-semibold text-muted-foreground">参考答案</p>
                <pre className="mt-1 overflow-x-auto rounded-lg bg-muted/70 p-2.5 font-mono text-[11px] leading-relaxed text-foreground">{r.answerSql}</pre>
                <p className="mt-2 text-[11px] font-semibold text-muted-foreground">讲解</p>
                <p className="mt-1 text-xs leading-relaxed text-foreground">{r.explanation}</p>
              </div>
            </details>
          </li>
        ))}
      </ul>

      {/* 动作 */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:border-primary hover:text-primary focus-visible:shadow-[var(--focus-ring)]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          再练一遍本组
        </button>
        <button
          type="button"
          onClick={onBackHome}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground focus-visible:shadow-[var(--focus-ring)]"
        >
          返回练习总览
        </button>
        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground focus-visible:shadow-[var(--focus-ring)]"
        >
          <Home className="h-3.5 w-3.5" />
          回首页
        </button>
      </div>
    </section>
  )
}
