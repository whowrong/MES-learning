import { AlertCircle, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ComposePanel } from "@/components/interview/ComposePanel"
import { QuestionCard } from "@/components/interview/QuestionCard"
import { ResultPanel } from "@/components/interview/ResultPanel"
import { TermCardDialog } from "@/components/level/TermCardDialog"
import type { useInterview } from "./useInterview"

export function InterviewPage(p: ReturnType<typeof useInterview>) {
  if (p.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">面试题库加载中……</p>
      </div>
    )
  }

  if (p.loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
        <div className="flex items-center gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{p.loadError}</span>
        </div>
        <Button variant="outline" onClick={p.goHome}>
          <Home className="mr-2 h-4 w-4" />
          回首页
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/40 to-card">
      {p.saveError && (
        <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-xl bg-destructive/10 px-4 py-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{p.saveError}</span>
        </div>
      )}

      {p.phase === "compose" && (
        <ComposePanel
          composeView={p.composeView}
          tier={p.tier}
          onTier={p.setTier}
          categories={p.categories}
          onToggleCategory={p.toggleCategory}
          paperSize={p.paperSize}
          onPaperSize={p.setPaperSize}
          onStart={p.startPaper}
        />
      )}

      {p.phase === "paper" && p.questionView && (
        <>
          <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
            <button
              type="button"
              onClick={p.backToCompose}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:shadow-[var(--focus-ring)]"
            >
              放弃本卷，返回组卷
            </button>
          </div>
          <QuestionCard
            view={p.questionView}
            terms={p.terms}
            shortRatings={p.shortRatings}
            onPick={p.pickOption}
            onSubmit={p.submitObjective}
            onReveal={p.revealReference}
            onRate={(rid) => p.rateShort(rid as Parameters<typeof p.rateShort>[0])}
            onNext={p.nextQuestion}
            onOpenTerm={p.openTermCard}
          />
        </>
      )}

      {p.phase === "result" && p.resultView && (
        <ResultPanel
          view={p.resultView}
          terms={p.terms}
          onRetry={p.backToCompose}
          onHome={p.goHome}
          onOpenTerm={p.openTermCard}
        />
      )}

      <TermCardDialog term={p.termCard} onClose={p.closeTermCard} />
    </div>
  )
}
