import { CheckCircle2, XCircle, ArrowRight, Factory } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TermDef } from "@/content/loader"
import type { FactoryQuizQuestion } from "@/content/factoryTypes"

interface FactoryQuizCardProps {
  view: {
    question: FactoryQuizQuestion
    typeName: string
    index: number
    total: number
    selected: string | null
    judged: boolean
    judgedCorrect: boolean
    canSubmit: boolean
    isLast: boolean
  }
  terms: Record<string, TermDef>
  onPick: (optionId: string) => void
  onSubmit: () => void
  onNext: () => void
  onOpenTerm: (termId: string) => void
}

const FEEDBACK_ROWS: Array<{ key: "factory" | "data" | "consultant"; icon: string; label: string }> = [
  { key: "factory", icon: "🏭", label: "现实工厂" },
  { key: "data", icon: "🗄️", label: "系统数据" },
  { key: "consultant", icon: "🧭", label: "顾问动作" },
]

export function FactoryQuizCard({ view, terms, onPick, onSubmit, onNext, onOpenTerm }: FactoryQuizCardProps) {
  const q = view.question
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <header className="flex items-center gap-3 pt-6">
        <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
          <Factory className="h-3.5 w-3.5" />
          {view.typeName} · 实战测验
        </span>
        <span className="text-xs text-muted-foreground">
          第 {view.index + 1}/{view.total} 题
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {Array.from({ length: view.total }, (_, i) => (
            <span
              key={i}
              className={
                i === view.index
                  ? "h-2 w-5 rounded-full bg-primary"
                  : i < view.index
                    ? "h-2 w-2 rounded-full bg-primary/40"
                    : "h-2 w-2 rounded-full bg-border"
              }
            />
          ))}
        </span>
      </header>

      <section className="mt-4 rounded-2xl bg-card p-6 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <p className="text-base font-semibold leading-7 text-foreground">{q.prompt}</p>
        <div className="mt-5 space-y-3">
          {q.options.map((opt) => {
            const isSelected = view.selected === opt.id
            const isAnswer = opt.id === q.answer
            let cls = "border-border bg-background hover:border-primary/50"
            if (view.judged) {
              if (isAnswer) cls = "border-primary bg-primary/10"
              else if (isSelected) cls = "border-destructive bg-destructive/10 line-through opacity-80"
              else cls = "border-border bg-background opacity-60"
            } else if (isSelected) {
              cls = "border-primary bg-primary/5"
            }
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onPick(opt.id)}
                disabled={view.judged}
                className={`w-full rounded-xl border-2 p-4 text-left text-sm leading-6 text-foreground transition-all duration-200 focus-visible:shadow-[var(--focus-ring)] ${cls}`}
              >
                {opt.text}
              </button>
            )
          })}
        </div>
      </section>

      {view.judged && (
        <section className="mt-4 rounded-2xl bg-card p-6 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
              view.judgedCorrect ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
            }`}
          >
            {view.judgedCorrect ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            {view.judgedCorrect ? "答对了，这就是这种厂型的脾气" : "答错了——看看这种厂型真实的样子"}
          </div>
          <div className="mt-4 space-y-3">
            {FEEDBACK_ROWS.map((row) => (
              <p key={row.key} className="rounded-xl bg-secondary/60 p-3 text-sm leading-6 text-secondary-foreground">
                <span className="mr-1.5 font-semibold">{row.icon} {row.label}：</span>
                {q.feedback[row.key]}
              </p>
            ))}
          </div>
          {q.term_ids.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">关联术语：</span>
              {q.term_ids.map((tid) => {
                const t = terms[tid]
                if (!t) return null
                return (
                  <button
                    key={tid}
                    type="button"
                    onClick={() => onOpenTerm(tid)}
                    className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground underline decoration-primary decoration-2 underline-offset-2 transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:shadow-[var(--focus-ring)]"
                  >
                    {t.term}
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}

      <footer className="mt-6 flex justify-end">
        {!view.judged ? (
          <Button onClick={onSubmit} disabled={!view.canSubmit} className="w-full bg-primary sm:w-auto">
            提交答案
          </Button>
        ) : (
          <Button onClick={onNext} className="w-full bg-primary sm:w-auto">
            {view.isLast ? "看成绩" : "下一题"}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </footer>
    </main>
  )
}
