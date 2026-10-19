import { AlertCircle, Home, Factory } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TypeSelectPanel } from "@/components/factory-types/TypeSelectPanel"
import { DossierView } from "@/components/factory-types/DossierView"
import { FactoryQuizCard } from "@/components/factory-types/FactoryQuizCard"
import { FactoryResultPanel } from "@/components/factory-types/FactoryResultPanel"
import { TermCardDialog } from "@/components/level/TermCardDialog"
import type { useFactoryTypes } from "./useFactoryTypes"

export function FactoryTypesPage(p: ReturnType<typeof useFactoryTypes>) {
  if (p.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">厂型档案加载中……</p>
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
      <div className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:px-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Factory className="h-4 w-4" />
          </span>
          <span className="text-sm font-bold text-foreground">厂型特训营</span>
          <button
            type="button"
            onClick={p.goHome}
            className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:shadow-[var(--focus-ring)]"
          >
            回首页
          </button>
        </div>
      </div>

      {p.saveError && (
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-3">
          <div className="flex w-full items-center gap-3 rounded-xl bg-destructive/10 px-4 py-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{p.saveError}</span>
          </div>
        </div>
      )}

      {p.phase === "select" && p.selectView && <TypeSelectPanel view={p.selectView} onChoose={p.chooseType} />}

      {p.phase === "dossier" && p.dossierView && (
        <DossierView
          view={p.dossierView}
          terms={p.terms}
          onPrev={p.dossierPrev}
          onNext={p.dossierNext}
          onStartQuiz={p.startQuiz}
          onBack={p.backToSelect}
          onOpenTerm={p.openTermCard}
        />
      )}

      {p.phase === "quiz" && p.quizView && (
        <>
          <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
            <button
              type="button"
              onClick={p.backToSelect}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:shadow-[var(--focus-ring)]"
            >
              放弃本场测验，返回厂型选择
            </button>
          </div>
          <FactoryQuizCard
            view={p.quizView}
            terms={p.terms}
            onPick={p.pickOption}
            onSubmit={p.submitAnswer}
            onNext={p.nextQuestion}
            onOpenTerm={p.openTermCard}
          />
        </>
      )}

      {p.phase === "result" && p.resultView && (
        <FactoryResultPanel
          view={p.resultView}
          terms={p.terms}
          onRetry={p.retrySameType}
          onChangeType={p.backToSelect}
          onHome={p.goHome}
          onOpenTerm={p.openTermCard}
        />
      )}

      <TermCardDialog term={p.termCard} onClose={p.closeTermCard} />
    </div>
  )
}
