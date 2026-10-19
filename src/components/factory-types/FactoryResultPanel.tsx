import { Home, RotateCcw, ArrowRight, BookMarked } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { TermDef } from "@/content/loader"
import type { FactoryQuestionResult } from "@/game/factory"

interface FactoryResultPanelProps {
  view: {
    score: number
    rank: "S" | "A" | "B" | "C"
    rankText: string
    typeName: string
    correctCount: number
    total: number
    perQuestion: FactoryQuestionResult[]
    newReviewTerms: string[]
    practiced: number
  }
  terms: Record<string, TermDef>
  onRetry: () => void
  onChangeType: () => void
  onHome: () => void
  onOpenTerm: (termId: string) => void
}

const RANK_STYLE: Record<string, string> = {
  S: "bg-primary text-primary-foreground",
  A: "bg-primary/70 text-primary-foreground",
  B: "bg-secondary text-secondary-foreground",
  C: "bg-muted text-muted-foreground",
}

export function FactoryResultPanel({ view, terms, onRetry, onChangeType, onHome, onOpenTerm }: FactoryResultPanelProps) {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <header className="pt-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{view.typeName} · 实战测验成绩</p>
        <div className="mt-4 flex items-center justify-center gap-5">
          <span className={`flex h-20 w-20 items-center justify-center rounded-full text-4xl font-bold shadow-md ${RANK_STYLE[view.rank]}`}>
            {view.rank}
          </span>
          <div className="text-left">
            <p className="text-5xl font-bold text-foreground">{view.score}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              答对 {view.correctCount}/{view.total} 题 · 第 {view.practiced} 场特训
            </p>
          </div>
        </div>
        <p className="mx-auto mt-5 max-w-xl rounded-2xl bg-card p-4 text-sm leading-6 text-muted-foreground shadow-md">
          {view.rankText}
        </p>
      </header>

      {view.newReviewTerms.length > 0 && (
        <section className="mt-6 rounded-2xl bg-card p-5 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <BookMarked className="h-4 w-4 text-primary" />
            错题关联术语已进复习队列
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {view.newReviewTerms.map((tid) => {
              const t = terms[tid]
              if (!t) return null
              return (
                <button
                  key={tid}
                  type="button"
                  onClick={() => onOpenTerm(tid)}
                  className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground underline decoration-primary decoration-2 underline-offset-2 transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:shadow-[var(--focus-ring)]"
                >
                  {t.term}
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            去术语卡库的复习会话里过一遍，它们会按间隔重复回来找你，直到你真的记住。
          </p>
        </section>
      )}

      <section className="mt-6 rounded-2xl bg-card p-5 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-sm font-bold text-foreground">逐题回顾</h2>
        <div className="mt-3 space-y-2">
          {view.perQuestion.map((r, i) => (
            <details key={r.question.id} className="rounded-xl border border-border bg-background p-3">
              <summary className="flex cursor-pointer items-center gap-2 text-sm leading-6 text-foreground">
                <Badge variant="outline" className={r.correct ? "rounded-full text-primary" : "rounded-full text-destructive"}>
                  {i + 1} · {r.correct ? "对" : "错"}
                </Badge>
                <span className="line-clamp-1 flex-1 text-muted-foreground">{r.question.prompt}</span>
              </summary>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                <span className="font-semibold text-foreground">顾问动作：</span>
                {r.question.feedback.consultant}
              </p>
            </details>
          ))}
        </div>
      </section>

      <footer className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button onClick={onRetry} className="w-full bg-primary sm:w-auto">
          <RotateCcw className="mr-2 h-4 w-4" />
          再练这个厂型（重新抽题）
        </Button>
        <Button variant="outline" onClick={onChangeType} className="w-full sm:w-auto">
          换一种厂型
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
        <Button variant="ghost" onClick={onHome} className="w-full sm:w-auto">
          <Home className="mr-2 h-4 w-4" />
          回首页
        </Button>
      </footer>
    </main>
  )
}
