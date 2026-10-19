import { useEffect, useState } from "react"
import { CheckCircle2, Database, Factory, Timer, UserRound, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { TermDef } from "@/content/loader"

export interface FillOptionView {
  id: string
  text: string
}

export interface FillQuestionView {
  id: string
  prompt: string
  options: FillOptionView[]
  feedback: { factory: string; data: string; consultant: string }
  termIds: string[]
  judged: boolean
  verdictCorrect: boolean | null
  pickedOption: string
  expectedOptionId: string
  expectedOptionText: string
  secondsPerQuestion: number
}

interface FillStageProps {
  title: string
  intro: string
  questionIdx: number
  questionTotal: number
  question: FillQuestionView
  terms: Record<string, TermDef>
  onPick: (optionId: string) => void
  onSubmit: () => void
  onTimeout: () => void
  onNext: () => void
  onOpenTerm: (termId: string) => void
}

const EXPLAIN_ROWS = [
  { key: "factory", icon: Factory, label: "现实工厂会怎样" },
  { key: "data", icon: Database, label: "MES 数据会怎样" },
  { key: "consultant", icon: UserRound, label: "顾问该怎么做" },
] as const

/** 限时填空速答：题干挖空选词填入，每题倒计时，超时按未作答判错 */
export function FillStage({ title, intro, questionIdx, questionTotal, question, terms, onPick, onSubmit, onTimeout, onNext, onOpenTerm }: FillStageProps) {
  const total = question.secondsPerQuestion
  const [secondsLeft, setSecondsLeft] = useState(total)

  // 换题重置倒计时
  useEffect(() => {
    setSecondsLeft(total)
  }, [question.id, total])

  // 每秒递减；归零且未判定时触发超时
  useEffect(() => {
    if (question.judged) return
    if (secondsLeft <= 0) {
      onTimeout()
      return
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft, question.judged, onTimeout])

  const isLast = questionIdx + 1 >= questionTotal
  const pct = Math.max(0, Math.min(100, (secondsLeft / total) * 100))
  const urgent = secondsLeft <= 5
  // 题干按 ____ 挖空拆段
  const segments = question.prompt.split("____")
  const pickedText = question.options.find((o) => o.id === question.pickedOption)?.text ?? ""

  return (
    <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="rounded-2xl bg-card p-5 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <div className="flex items-center gap-2">
            <Badge className={`rounded-full font-mono text-xs ${urgent && !question.judged ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
              <Timer className="mr-1 h-3 w-3" />
              {question.judged ? "本题结束" : `${secondsLeft}s`}
            </Badge>
            <Badge className="rounded-full bg-muted font-mono text-xs text-muted-foreground">
              第 {questionIdx + 1} / {questionTotal} 题
            </Badge>
          </div>
        </div>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{intro}</p>
        {/* 倒计时条 */}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${question.judged ? "bg-muted-foreground/40" : urgent ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${question.judged ? 100 : pct}%` }}
            aria-hidden
          />
        </div>
      </div>

      <div key={question.id} className="mt-5 rounded-2xl bg-card p-6 shadow-md animate-in fade-in duration-300">
        <p className="text-lg font-medium leading-9 text-foreground">
          {segments[0]}
          <span
            className={`mx-1 inline-block min-w-28 rounded-xl border-2 border-dashed px-3 py-0.5 text-center align-middle ${
              question.judged
                ? question.verdictCorrect
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-destructive bg-destructive/10 text-destructive"
                : pickedText
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground"
            }`}
          >
            {question.judged
              ? question.expectedOptionText
              : pickedText || "____"}
          </span>
          {segments[1]}
        </p>
        {!question.judged && question.verdictCorrect === null && pickedText === "" && segments.length > 1 && (
          <p className="mt-2 text-xs text-muted-foreground">从下面选一个词填进空里，倒计时归零算未作答。</p>
        )}
        {question.judged && !question.verdictCorrect && pickedText && pickedText !== question.expectedOptionText && (
          <p className="mt-2 text-xs text-destructive">
            你填的是「{pickedText}」
          </p>
        )}

        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
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
                className={`flex items-center justify-between gap-2 rounded-xl border-2 px-4 py-3 text-left transition-all duration-200 focus-visible:shadow-[var(--focus-ring)] ${style}`}
              >
                <span className="min-w-0 flex-1 text-sm font-medium leading-6 text-foreground">{opt.text}</span>
                {question.judged && isExpected && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                {question.judged && picked && !isExpected && <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
              </button>
            )
          })}
        </div>

        {question.judged && (
          <div className="mt-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div
              className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
                question.verdictCorrect ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
              }`}
            >
              {question.verdictCorrect ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span className="leading-6">
                {question.verdictCorrect ? "填对了！" : `正确答案是：${question.expectedOptionText}`}
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
          {question.judged ? "看完讲解再走，公式要能默写才算会。" : "手快有手慢无——但宁可慢，也要填对。"}
        </p>
        {question.judged ? (
          <Button onClick={onNext} className="w-full rounded-full bg-primary text-primary-foreground hover:scale-105 focus-visible:shadow-[var(--focus-ring)] sm:w-auto">
            {isLast ? "完成填空 · 进入下一关" : "下一题"}
          </Button>
        ) : (
          <Button onClick={onSubmit} disabled={!question.pickedOption} className="w-full rounded-full bg-primary text-primary-foreground hover:scale-105 focus-visible:shadow-[var(--focus-ring)] sm:w-auto">
            填入并提交
          </Button>
        )}
      </div>
    </section>
  )
}
