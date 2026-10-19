import { RotateCcw, Home, CheckCircle2, XCircle, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CATEGORY_LABELS, TYPE_LABELS } from "@/content/interview"
import type { TermDef } from "@/content/loader"
import type { useInterview } from "@/pages/Interview/useInterview"

type ResultView = NonNullable<ReturnType<typeof useInterview>["resultView"]>

const RANK_STYLE: Record<string, string> = {
  S: "bg-primary text-primary-foreground",
  A: "bg-primary/80 text-primary-foreground",
  B: "bg-secondary text-secondary-foreground",
  C: "bg-muted text-muted-foreground",
}

interface ResultPanelProps {
  view: ResultView
  terms: Record<string, TermDef>
  onRetry: () => void
  onHome: () => void
  onOpenTerm: (termId: string) => void
}

/** 面试结算：总分 + 档位锐评 + 逐题回顾 + 错题术语进复习队列 */
export function ResultPanel({ view, terms, onRetry, onHome, onOpenTerm }: ResultPanelProps) {
  return (
    <section className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      {/* 总评分卡 */}
      <div className="rounded-2xl bg-card p-6 text-center shadow-md">
        <h1 className="text-xl font-bold text-foreground">模拟面试结束 · {view.tierName}档</h1>
        <div className="mt-4 flex items-center justify-center gap-5">
          <span className={`flex h-20 w-20 items-center justify-center rounded-full text-3xl font-black ${RANK_STYLE[view.rank] ?? RANK_STYLE.C}`}>
            {view.rank}
          </span>
          <span className="text-left">
            <span className="block text-4xl font-black text-foreground">{view.score}</span>
            <span className="block text-xs text-muted-foreground">
              客观题 {view.objectiveCorrect}/{view.objectiveTotal} 对
              {view.shortTotal > 0 && ` · 简答 ${view.shortTotal} 题按自评折算`}
            </span>
          </span>
        </div>
        {view.rankText && (
          <p className="mx-auto mt-4 max-w-xl rounded-xl bg-secondary px-4 py-3 text-sm leading-6 text-secondary-foreground">
            {view.rankText}
          </p>
        )}
      </div>

      {/* 错题术语进复习队列 */}
      {view.newReviewTerms.length > 0 && (
        <div className="rounded-2xl border-2 border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <BookOpen className="h-4 w-4 text-primary" />
            这些概念进了你的复习队列
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {view.newReviewTerms.map((tid) =>
              terms[tid] ? (
                <button
                  key={tid}
                  type="button"
                  onClick={() => onOpenTerm(tid)}
                  className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary focus-visible:shadow-[var(--focus-ring)]"
                >
                  {terms[tid].term}
                </button>
              ) : null,
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">去首页的术语卡库按间隔复习，把它们焊进脑子。</p>
        </div>
      )}

      {/* 逐题回顾 */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">逐题回顾</h2>
        {view.perQuestion.map((r, i) => (
          <details key={r.question.id} className="rounded-2xl border-2 border-border bg-card">
            <summary className="flex cursor-pointer items-start gap-3 p-4 text-sm leading-6">
              {r.correct ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              )}
              <span className="flex-1 text-foreground">
                <span className="mr-2 text-xs text-muted-foreground">
                  {i + 1} · {TYPE_LABELS[r.question.type]} · {CATEGORY_LABELS[r.question.category]}
                </span>
                <span className="block">{r.question.prompt.slice(0, 48)}{r.question.prompt.length > 48 ? "…" : ""}</span>
              </span>
              {!r.correct && <Badge variant="outline" className="shrink-0 rounded-full text-destructive">得分 {Math.round(r.earned * 100)}%</Badge>}
            </summary>
            <div className="space-y-3 border-t border-border p-4">
              <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">{r.question.reference}</p>
              {r.question.bonus_points.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-foreground">加分点：</span>
                  <ul className="mt-1 space-y-1">
                    {r.question.bonus_points.map((bp, bi) => (
                      <li key={bi} className="text-xs leading-5 text-muted-foreground">· {bp}</li>
                    ))}
                  </ul>
                </div>
              )}
              {r.question.term_ids.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {r.question.term_ids.map((tid) =>
                    terms[tid] ? (
                      <button
                        key={tid}
                        type="button"
                        onClick={() => onOpenTerm(tid)}
                        className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs text-primary focus-visible:shadow-[var(--focus-ring)]"
                      >
                        {terms[tid].term}
                      </button>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          </details>
        ))}
      </div>

      {/* 动作 */}
      <div className="flex flex-col gap-3 pb-10 sm:flex-row sm:justify-center">
        <Button size="lg" onClick={onRetry} className="w-full bg-primary text-primary-foreground sm:w-auto sm:px-10">
          <RotateCcw className="mr-2 h-5 w-5" />
          再来一卷
        </Button>
        <Button size="lg" variant="outline" onClick={onHome} className="w-full sm:w-auto sm:px-10">
          <Home className="mr-2 h-5 w-5" />
          回首页
        </Button>
      </div>
    </section>
  )
}
