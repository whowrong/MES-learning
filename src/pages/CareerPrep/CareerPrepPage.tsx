import { AlertCircle, Home, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CareerTrackSelect } from "@/components/career/CareerTrackSelect"
import { CareerTrackPanel } from "@/components/career/CareerTrackPanel"
import { CareerQuizCard } from "@/components/career/CareerQuizCard"
import { CareerOrderPanel } from "@/components/career/CareerOrderPanel"
import { CareerResultPanel } from "@/components/career/CareerResultPanel"
import { TermCardDialog } from "@/components/level/TermCardDialog"
import type { useCareerPrep } from "./useCareerPrep"

export function CareerPrepPage(p: ReturnType<typeof useCareerPrep>) {
  if (p.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">实习准备营加载中……</p>
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
            <Target className="h-4 w-4" />
          </span>
          <span className="text-sm font-bold text-foreground">实习准备营</span>
          <button
            type="button"
            onClick={p.backToSelect}
            className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:shadow-[var(--focus-ring)]"
          >
            {p.phase === "select" ? "回首页" : "赛道列表"}
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

      {p.phase === "select" && <CareerTrackSelect views={p.trackViews} onChoose={p.chooseTrack} />}

      {p.phase === "track" && p.activeTrack && (
        <CareerTrackPanel
          track={p.activeTrack}
          sizes={p.paperSizes}
          activeSizeId={p.activeSize.id}
          onSizeChange={p.setSizeId}
          onStart={p.startPaper}
          onOpenTerm={p.openTermCard}
        />
      )}

      {p.phase === "quiz" && p.questionView && (
        <>
          <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
            <button
              type="button"
              onClick={p.backToTrack}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:shadow-[var(--focus-ring)]"
            >
              放弃本场测验，返回赛道
            </button>
          </div>
          <CareerQuizCard
            view={p.questionView}
            onPick={p.pickOption}
            onSubmit={p.submitAnswer}
            onNext={p.nextQuestion}
            onOpenTerm={p.openTermCard}
          />
        </>
      )}

      {p.phase === "order" && (
        <>
          <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
            <button
              type="button"
              onClick={p.backToTrack}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:shadow-[var(--focus-ring)]"
            >
              放弃本场测验，返回赛道
            </button>
          </div>
          <CareerOrderPanel
            title={p.orderTitle}
            intro={p.orderIntro}
            steps={p.orderSteps}
            picked={p.orderPick}
            onAdd={p.addOrderStep}
            onRemove={p.removeOrderStep}
            onSubmit={p.submitOrder}
          />
        </>
      )}

      {p.phase === "result" && p.result && (
        <CareerResultPanel
          view={p.result}
          onRetry={p.retrySameTrack}
          onBack={p.backToSelect}
          onHome={p.goHome}
          onOpenTerm={p.openTermCard}
        />
      )}

      <TermCardDialog term={p.termCard} onClose={p.closeTermCard} />
    </div>
  )
}
