import { CheckCircle2, XCircle, ArrowRight, Factory, Database, Wrench } from "lucide-react"
import type { OpsChoiceQuestion } from "@/content/opsTraining"

export interface OpsChoiceView {
  groupTitle: string
  question: OpsChoiceQuestion
  index: number
  total: number
  selected: string | null
  judged: boolean
  judgedCorrect: boolean
  canSubmit: boolean
  isLast: boolean
}

/** 场景决策卡：一次一题，提交即判定，三句话讲解（现场/系统数据/运维规范） */
export function OpsChoiceStage({
  view,
  onPick,
  onSubmit,
  onNext,
}: {
  view: OpsChoiceView
  onPick: (optionId: string) => void
  onSubmit: () => void
  onNext: () => void
}) {
  const q = view.question
  return (
    <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{view.groupTitle}</span>
        <span className="tabular-nums">
          第 {view.index + 1}/{view.total} 题
        </span>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm font-semibold leading-relaxed text-foreground">{q.prompt}</p>

        <ul className="mt-4 flex flex-col gap-2">
          {q.options.map((opt) => {
            const isPicked = view.selected === opt.id
            const isAnswer = q.answer === opt.id
            let style = "border-border bg-background hover:border-primary/40"
            if (view.judged) {
              if (isAnswer) style = "border-primary bg-primary/10"
              else if (isPicked) style = "border-destructive bg-destructive/10"
              else style = "border-border bg-background opacity-60"
            } else if (isPicked) {
              style = "border-primary bg-primary/5"
            }
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => onPick(opt.id)}
                  disabled={view.judged}
                  className={"flex w-full items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-xs leading-relaxed text-foreground transition-colors focus-visible:shadow-[var(--focus-ring)] " + style}
                >
                  <span className="mt-px font-mono text-[10px] text-muted-foreground">{opt.id.toUpperCase()}</span>
                  <span className="flex-1">{opt.text}</span>
                  {view.judged && isAnswer && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                  {view.judged && isPicked && !isAnswer && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                </button>
              </li>
            )
          })}
        </ul>

        {view.judged && (
          <div className="mt-4 rounded-xl border border-border bg-muted/50 p-4">
            <p className={"text-xs font-bold " + (view.judgedCorrect ? "text-primary" : "text-destructive")}>
              {view.judgedCorrect ? "✔ 判断正确" : "✘ 判断有误，看讲解"}
            </p>
            <dl className="mt-2.5 grid gap-2 text-xs leading-relaxed">
              <div className="flex gap-2">
                <Factory className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <dd className="text-foreground">{q.feedback.factory}</dd>
              </div>
              <div className="flex gap-2">
                <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <dd className="text-foreground">{q.feedback.data}</dd>
              </div>
              <div className="flex gap-2">
                <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <dd className="text-foreground">{q.feedback.consultant}</dd>
              </div>
            </dl>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          {!view.judged ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!view.canSubmit}
              className="rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40 focus-visible:shadow-[var(--focus-ring)]"
            >
              提交答案
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground focus-visible:shadow-[var(--focus-ring)]"
            >
              {view.isLast ? "完成本组，出分" : "下一题"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
