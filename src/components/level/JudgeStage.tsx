import { Check, CheckCircle2, Database, Factory, Quote, UserRound, X, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { TermDef } from "@/content/loader"

export interface JudgeQuestionView {
  id: string
  quoteText: string
  conceptId: string
  conceptTerm: string
  actualConceptId: string
  actualConceptTerm: string
  isMatch: boolean
  judged: boolean
  picked: "yes" | "no" | ""
  verdictCorrect: boolean | null
  feedback: { factory: string; data: string; consultant: string }
  termIds: string[]
}

interface JudgeStageProps {
  title: string
  intro: string
  problemIdx: number
  problemTotal: number
  question: JudgeQuestionView
  terms: Record<string, TermDef>
  onPick: (a: "yes" | "no") => void
  onSubmit: () => void
  onNext: () => void
  onOpenTerm: (termId: string) => void
}

const EXPLAIN_ROWS = [
  { key: "factory", icon: Factory, label: "现实工厂会怎样" },
  { key: "data", icon: Database, label: "MES 数据会怎样" },
  { key: "consultant", icon: UserRound, label: "顾问该怎么做" },
] as const

/** 真假鉴定：给一句车间原话 + 一个概念，判断「这句话是在说它吗」——题从连连看题库自动衍生 */
export function JudgeStage({ title, intro, problemIdx, problemTotal, question, terms, onPick, onSubmit, onNext, onOpenTerm }: JudgeStageProps) {
  const isLast = problemIdx + 1 >= problemTotal
  const trueAnswer: "yes" | "no" = question.isMatch ? "yes" : "no"
  return (
    <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="rounded-2xl bg-card p-5 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <Badge className="rounded-full bg-primary/15 font-mono text-xs text-primary">
            第 {problemIdx + 1} / {problemTotal} 题
          </Badge>
        </div>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{intro}</p>
        <div className="mt-3 flex gap-1" aria-hidden>
          {Array.from({ length: problemTotal }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < problemIdx ? "bg-primary" : i === problemIdx ? "bg-primary/60" : "bg-border"}`}
            />
          ))}
        </div>
      </div>

      <div key={question.id} className="mt-5 rounded-2xl bg-card p-6 shadow-md animate-in fade-in duration-300">
        <div className="flex items-start gap-3 rounded-xl bg-muted px-4 py-3">
          <Quote className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p className="text-base font-medium leading-7 text-foreground">{question.quoteText}</p>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          这句话是在说——
          <button
            type="button"
            onClick={() => onOpenTerm(question.conceptId)}
            className="mx-1.5 rounded-full bg-secondary px-3 py-1 text-base font-bold text-secondary-foreground underline decoration-dotted underline-offset-4 transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:shadow-[var(--focus-ring)]"
          >
            {question.conceptTerm}
          </button>
          吗？
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {(["yes", "no"] as const).map((a) => {
            const picked = question.picked === a
            const isTrue = trueAnswer === a
            let style = "border-border bg-background hover:border-primary/50"
            if (!question.judged && picked) style = "border-primary bg-primary/5 shadow-md"
            if (question.judged) {
              if (isTrue) style = "border-primary bg-primary/5"
              else if (picked) style = "border-destructive bg-destructive/5"
              else style = "border-border bg-muted/40 opacity-60"
            }
            return (
              <button
                key={a}
                type="button"
                disabled={question.judged}
                onClick={() => onPick(a)}
                className={`flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 px-4 py-4 text-base font-bold transition-all duration-200 focus-visible:shadow-[var(--focus-ring)] ${style}`}
              >
                {a === "yes" ? (
                  <CheckCircle2 className={`h-5 w-5 ${question.judged && isTrue ? "text-primary" : "text-muted-foreground"}`} />
                ) : (
                  <XCircle className={`h-5 w-5 ${question.judged && isTrue ? "text-primary" : "text-muted-foreground"}`} />
                )}
                <span className="text-foreground">{a === "yes" ? "对，就是它" : "错，不是它"}</span>
              </button>
            )
          })}
        </div>

        {question.judged && (
          <div className="mt-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div
              className={`rounded-xl px-4 py-3 text-sm font-medium leading-6 ${
                question.verdictCorrect ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
              }`}
            >
              {question.verdictCorrect ? (
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 shrink-0" /> 判断正确！
                </span>
              ) : question.isMatch ? (
                <span className="inline-flex items-start gap-1.5">
                  <X className="mt-0.5 h-4 w-4 shrink-0" />
                  判错了——这句话说的确实就是「{question.conceptTerm}」。
                </span>
              ) : (
                <span className="inline-flex items-start gap-1.5">
                  <X className="mt-0.5 h-4 w-4 shrink-0" />
                  判错了——它说的不是「{question.conceptTerm}」，其实是
                  <button
                    type="button"
                    onClick={() => onOpenTerm(question.actualConceptId)}
                    className="mx-0.5 font-bold underline underline-offset-4"
                  >
                    「{question.actualConceptTerm}」
                  </button>
                </span>
              )}
            </div>
            <div className="mt-3 space-y-2.5">
              {EXPLAIN_ROWS.map((row) => {
                const Icon = row.icon
                return (
                  <div key={row.key} className="flex gap-3 rounded-xl bg-muted px-4 py-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card text-primary">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-sm leading-6 text-foreground">
                      <span className="font-bold text-primary">{row.label}：</span>
                      {question.feedback[row.key]}
                    </p>
                  </div>
                )
              })}
            </div>
            {question.termIds.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">涉及术语：</span>
                {question.termIds.map((tid) => (
                  <button key={tid} type="button" onClick={() => onOpenTerm(tid)} className="focus-visible:shadow-[var(--focus-ring)]">
                    <Badge className="cursor-pointer rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground">
                      {terms[tid]?.term ?? tid}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-md">
        <p className="text-sm text-muted-foreground">
          {question.judged ? "同样的话换个问法，看你还认不认得。" : "认出这句话真正在说的概念，再下判断。"}
        </p>
        {question.judged ? (
          <Button onClick={onNext} className="w-full rounded-full bg-primary text-primary-foreground hover:scale-105 focus-visible:shadow-[var(--focus-ring)] sm:w-auto">
            {isLast ? "完成鉴定 · 进入下一关" : "下一题"}
          </Button>
        ) : (
          <Button onClick={onSubmit} disabled={!question.picked} className="w-full rounded-full bg-primary text-primary-foreground hover:scale-105 focus-visible:shadow-[var(--focus-ring)] sm:w-auto">
            提交判断
          </Button>
        )}
      </div>
    </section>
  )
}
