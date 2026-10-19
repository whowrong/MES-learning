import { CheckCircle2, Database, Factory, HelpCircle, UserRound, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { TermDef } from "@/content/loader"

export interface QuizOptionView {
  id: string
  text: string
}

export interface QuizQuestionView {
  id: string
  prompt: string
  options: QuizOptionView[]
  feedback: { factory: string; data: string; consultant: string }
  termIds: string[]
  judged: boolean
  verdictCorrect: boolean | null
  pickedOption: string
  expectedOptionId: string
  expectedOptionText: string
}

interface QuizStageProps {
  title: string
  intro: string
  questionIdx: number
  questionTotal: number
  question: QuizQuestionView
  terms: Record<string, TermDef>
  onPick: (optionId: string) => void
  onSubmit: () => void
  onNext: () => void
  onOpenTerm: (termId: string) => void
}

const EXPLAIN_ROWS = [
  { key: "factory", icon: Factory, label: "现实工厂会怎样" },
  { key: "data", icon: Database, label: "MES 数据会怎样" },
  { key: "consultant", icon: UserRound, label: "顾问该怎么做" },
] as const

/** 场景抉择舞台：一次一题，选完提交立即判定 + 三句话讲解（Duolingo 节奏） */
export function QuizStage({
  title,
  intro,
  questionIdx,
  questionTotal,
  question,
  terms,
  onPick,
  onSubmit,
  onNext,
  onOpenTerm,
}: QuizStageProps) {
  const isLast = questionIdx + 1 >= questionTotal
  return (
    <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="rounded-2xl bg-card p-5 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <Badge className="rounded-full bg-primary/15 font-mono text-xs text-primary">
            第 {questionIdx + 1} / {questionTotal} 题
          </Badge>
        </div>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{intro}</p>
        {/* 题目进度点 */}
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {Array.from({ length: questionTotal }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < questionIdx ? "bg-primary" : i === questionIdx ? "bg-primary/60" : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      <div key={question.id} className="mt-5 rounded-2xl bg-card p-6 shadow-md animate-in fade-in duration-300">
        <div className="flex items-start gap-3">
          <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <p className="text-base font-medium leading-7 text-foreground">{question.prompt}</p>
        </div>

        <div className="mt-4 space-y-2.5">
          {question.options.map((opt) => {
            const picked = question.pickedOption === opt.id
            const isExpected = question.expectedOptionId === opt.id
            let style = "border-border bg-background hover:border-primary/50"
            if (!question.judged && picked) style = "border-primary bg-primary/5 shadow-md"
            if (question.judged) {
              if (isExpected) style = "border-primary bg-primary/5"
              else if (picked) style = "border-destructive bg-destructive/5"
              else style = "border-border bg-muted/40 opacity-60"
            }
            return (
              <button
                key={opt.id}
                type="button"
                disabled={question.judged}
                onClick={() => onPick(opt.id)}
                className={`flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all duration-200 focus-visible:shadow-[var(--focus-ring)] ${style}`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                    question.judged && isExpected
                      ? "border-primary bg-primary text-primary-foreground"
                      : question.judged && picked
                        ? "border-destructive bg-destructive text-destructive-foreground"
                        : picked
                          ? "border-primary text-primary"
                          : "border-border text-muted-foreground"
                  }`}
                  aria-hidden
                >
                  {question.judged && isExpected ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : question.judged && picked ? (
                    <XCircle className="h-3.5 w-3.5" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </span>
                <span className="min-w-0 flex-1 text-sm leading-6 text-foreground">{opt.text}</span>
              </button>
            )
          })}
        </div>

        {/* 判定后的讲解区 */}
        {question.judged && (
          <div className="mt-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div
              className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
                question.verdictCorrect
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {question.verdictCorrect ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span className="leading-6">
                {question.verdictCorrect
                  ? "答对了，这就是顾问的标准动作。"
                  : `正确答案是：${question.expectedOptionText}`}
              </span>
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
                  <button
                    key={tid}
                    type="button"
                    onClick={() => onOpenTerm(tid)}
                    className="focus-visible:shadow-[var(--focus-ring)]"
                  >
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

      {/* 底部操作条 */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-md">
        <p className="text-sm text-muted-foreground">
          {question.judged
            ? "看完讲解再走，这题就真正学会了。"
            : question.pickedOption
              ? "选定后提交，立即判定并给讲解。"
              : "先选一个你认为最接近顾问标准做法的选项。"}
        </p>
        {question.judged ? (
          <Button
            onClick={onNext}
            className="w-full rounded-full bg-primary text-primary-foreground hover:scale-105 focus-visible:shadow-[var(--focus-ring)] sm:w-auto"
          >
            {isLast ? "完成抉择 · 进入下一关" : "下一题"}
          </Button>
        ) : (
          <Button
            onClick={onSubmit}
            disabled={!question.pickedOption}
            className="w-full rounded-full bg-primary text-primary-foreground hover:scale-105 focus-visible:shadow-[var(--focus-ring)] sm:w-auto"
          >
            提交本题
          </Button>
        )}
      </div>
    </section>
  )
}
