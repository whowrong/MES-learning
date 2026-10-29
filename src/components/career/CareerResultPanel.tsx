import { CheckCircle2, Home, RotateCcw, Target, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { careerAnswerText } from "@/game/careerPrep"
import type { CareerResultView } from "@/pages/CareerPrep/useCareerPrep"

interface CareerResultPanelProps {
  view: CareerResultView
  onRetry: () => void
  onBack: () => void
  onHome: () => void
  onOpenTerm: (termId: string) => void
}

/** 结果页：得分与评级、逐题解析、顺序题判定、错题术语去向 */
export function CareerResultPanel({ view, onRetry, onBack, onHome, onOpenTerm }: CareerResultPanelProps) {
  return (
    <section className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div className="rounded-2xl bg-card p-6 text-center shadow-md">
        <p className="text-sm text-muted-foreground">本场得分</p>
        <p className="mt-1 text-5xl font-black text-foreground">{view.score}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          共 {view.total} 项（客观题 {view.objectiveCorrect}/{view.objectiveTotal}
          {view.orderTitle ? ` · 顺序题 ${view.orderCorrect ? "对" : "错"}` : ""}）
        </p>
        <Badge className="mt-3 rounded-full bg-primary text-primary-foreground">评级 {view.rank}</Badge>
        {view.rankText && <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{view.rankText}</p>}
      </div>

      {view.orderVerdict && (
        <div className="rounded-2xl bg-card p-5 shadow-md">
          <p className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Target className="h-5 w-5 text-primary" />
            {view.orderTitle}
          </p>
          {view.orderVerdict.correct ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              顺序全对，这道题拿下。
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-destructive">顺序有误，正确顺序如下：</p>
              <ol className="space-y-1.5">
                {view.orderSteps.map((s, i) => (
                  <li key={s.id} className="text-sm leading-6 text-foreground">
                    <span className="font-bold text-primary">{i + 1}.</span> {s.text}
                    <span className="ml-2 text-xs text-muted-foreground">{s.note}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {view.perQuestion.map((r, i) => (
          <div key={r.question.id} className="rounded-2xl bg-card p-5 shadow-sm">
            <div className="flex items-start gap-2">
              {r.correct ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium leading-6 text-foreground">
                  {i + 1}. {r.question.prompt}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  正确答案：{careerAnswerText(r.question)}
                </p>
                {!r.correct && (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{r.question.reference}</p>
                )}
                {r.question.term_ids.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.question.term_ids.map((tid) => (
                      <button
                        key={tid}
                        type="button"
                        onClick={() => onOpenTerm(tid)}
                        className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:shadow-[var(--focus-ring)]"
                      >
                        {tid}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {view.newReviewTerms.length > 0 && (
        <div className="rounded-2xl bg-primary/5 p-4 text-sm text-muted-foreground">
          本场 {view.newReviewTerms.length} 个关联术语已进复习队列，术语卡库里会按间隔重复出现。
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={onRetry} className="bg-primary text-primary-foreground">
          <RotateCcw className="mr-2 h-5 w-5" />
          再练一场
        </Button>
        <Button variant="outline" onClick={onBack}>
          换个赛道
        </Button>
        <Button variant="outline" onClick={onHome}>
          <Home className="mr-2 h-4 w-4" />
          回首页
        </Button>
      </div>
    </section>
  )
}
