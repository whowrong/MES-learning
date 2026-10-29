import { ArrowRight, CheckCircle2, Lightbulb, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CAREER_TYPE_LABELS } from "@/content/careerPrep"
import { careerAnswerText } from "@/game/careerPrep"
import type { CareerQuestionView } from "@/pages/CareerPrep/useCareerPrep"

interface CareerQuizCardProps {
  view: CareerQuestionView
  onPick: (optionId: string) => void
  onSubmit: () => void
  onNext: () => void
  onOpenTerm: (termId: string) => void
}

/** 答题卡：一次一题，提交即判定，随即给出参考答案与加分点 */
export function CareerQuizCard({ view, onPick, onSubmit, onNext, onOpenTerm }: CareerQuizCardProps) {
  const q = view.question
  const answerIds = Array.isArray(q.answer) ? q.answer : [q.answer]
  const isLast = view.index + 1 >= view.total

  return (
    <section className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="rounded-full bg-primary text-primary-foreground">
          第 {view.index + 1}/{view.total} 题
        </Badge>
        <Badge variant="outline" className="rounded-full text-muted-foreground">
          {CAREER_TYPE_LABELS[q.type]}
        </Badge>
        <Badge variant="outline" className="rounded-full text-muted-foreground">
          {q.source_hint}
        </Badge>
        {q.type === "multiple" && <span className="text-xs text-muted-foreground">多选：多选少选都算错</span>}
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-md sm:p-6">
        <p className="text-base font-medium leading-7 text-foreground sm:text-lg">{q.prompt}</p>
      </div>

      <div className="space-y-3">
        {view.options.map((o) => {
          const picked = view.selected.includes(o.id)
          const isRight = view.judged && answerIds.includes(o.id)
          const isWrongPick = view.judged && picked && !isRight
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onPick(o.id)}
              disabled={view.judged}
              className={`w-full rounded-2xl border-2 p-4 text-left text-sm leading-6 transition-all focus-visible:shadow-[var(--focus-ring)] disabled:cursor-default ${
                isRight
                  ? "border-primary bg-primary/10 text-foreground"
                  : isWrongPick
                    ? "border-destructive bg-destructive/10 text-foreground line-through decoration-destructive"
                    : picked
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/40"
              }`}
            >
              <span className="flex items-start gap-3">
                {isRight && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
                {isWrongPick && <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />}
                <span>{o.text}</span>
              </span>
            </button>
          )
        })}
      </div>

      {view.judged && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${
            view.judgedCorrect ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
          }`}
        >
          {view.judgedCorrect ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          {view.judgedCorrect ? "答对了，这个说法在面试里站得住" : "这题没答对，看清楚参考答案"}
        </div>
      )}

      {view.judged && (
        <div className="space-y-3 rounded-2xl bg-card p-5 shadow-md">
          <p className="text-sm font-bold text-foreground">正确答案：{careerAnswerText(q)}</p>
          <p className="text-sm leading-6 text-muted-foreground">{q.reference}</p>
          {q.bonus_points.length > 0 && (
            <div className="rounded-xl bg-primary/5 p-3">
              <p className="flex items-center gap-2 text-xs font-bold text-primary">
                <Lightbulb className="h-4 w-4" />
                面试加分点
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {q.bonus_points.map((b, i) => (
                  <li key={i} className="text-xs leading-5 text-muted-foreground">
                    · {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {q.term_ids.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {q.term_ids.map((tid) => (
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
      )}

      <div className="flex justify-end">
        {!view.judged ? (
          <Button
            onClick={onSubmit}
            disabled={view.selected.length === 0}
            className="bg-primary text-primary-foreground"
          >
            提交答案
          </Button>
        ) : (
          <Button onClick={onNext} className="bg-primary text-primary-foreground">
            {isLast ? "交卷看结果" : "下一题"}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        )}
      </div>
    </section>
  )
}
