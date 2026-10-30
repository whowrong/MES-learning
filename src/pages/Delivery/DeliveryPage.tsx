import { AlertCircle, ClipboardCheck, Home, Layers, ListChecks, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CareerQuizCard } from "@/components/career/CareerQuizCard"
import { CareerOrderPanel } from "@/components/career/CareerOrderPanel"
import { DeliveryCardsPanel } from "@/components/delivery/DeliveryCardsPanel"
import { DeliveryWorkspacePanel } from "@/components/delivery/DeliveryWorkspacePanel"
import { DeliveryResultPanel } from "@/components/delivery/DeliveryResultPanel"
import { TermCardDialog } from "@/components/level/TermCardDialog"
import type { useDelivery } from "./useDelivery"

export function DeliveryPage(p: ReturnType<typeof useDelivery>) {
  if (p.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">交付闭环模块加载中……</p>
      </div>
    )
  }

  if (p.loadError || !p.mod) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
        <div className="flex items-center gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{p.loadError || "模块内容不可用"}</span>
        </div>
        <Button variant="outline" onClick={p.goHome}>
          <Home className="mr-2 h-4 w-4" />
          回首页
        </Button>
      </div>
    )
  }

  const steps = [
    { id: "cards", label: "讲解卡", icon: Layers, show: true },
    { id: "workspace", label: "交付物工作区", icon: ClipboardCheck, show: true },
    { id: "quiz", label: "实战测验", icon: ListChecks, show: true },
  ] as const

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/40 to-card">
      <div className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Target className="h-4 w-4" />
          </span>
          <span className="text-sm font-bold text-foreground">{p.mod.moduleName}</span>
          <nav className="ml-4 hidden items-center gap-1 sm:flex">
            {steps.map((s) => {
              const Icon = s.icon
              const on = p.phase === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={s.id === "quiz" ? p.startQuiz : s.id === "workspace" ? p.goWorkspace : p.goCards}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors focus-visible:shadow-[var(--focus-ring)] ${
                    on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.label}
                </button>
              )
            })}
          </nav>
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

      {p.phase === "cards" && (
        <DeliveryCardsPanel
          cards={p.mod.cards}
          moduleName={p.mod.moduleName}
          subtitle={p.mod.subtitle}
          intro={p.mod.intro}
          knowledgeIds={p.mod.knowledge_ids}
          onOpenTerm={p.openTermCard}
          onNext={p.goWorkspace}
        />
      )}

      {p.phase === "workspace" && (
        <DeliveryWorkspacePanel
          intro={p.mod.workspace.intro}
          notice={p.mod.workspace.notice}
          deliverables={p.mod.workspace.deliverables}
          drafts={p.drafts}
          checks={p.checks}
          activeId={p.activeDeliverableId}
          ratio={p.workspaceRatio}
          aiState={p.aiState}
          aiModel={p.aiModels[0]?.model ?? ""}
          aiReview={p.aiReview}
          aiReviewing={p.aiReviewing}
          aiError={p.aiError}
          saved={false}
          onSelect={p.setActiveDeliverableId}
          onChange={p.setDraft}
          onSave={p.saveDrafts}
          onAiReview={p.runAiReview}
          onStartQuiz={p.startQuiz}
        />
      )}

      {p.phase === "quiz" && p.questionView && (
        <CareerQuizCard
          view={p.questionView}
          onPick={p.pickOption}
          onSubmit={p.submitAnswer}
          onNext={p.nextQuestion}
          onOpenTerm={p.openTermCard}
        />
      )}

      {p.phase === "order" && (
        <CareerOrderPanel
          title={p.orderTitle}
          intro={p.orderIntro}
          steps={p.orderSteps}
          picked={p.orderPick}
          onAdd={p.addOrderStep}
          onRemove={p.removeOrderStep}
          onSubmit={p.submitOrder}
        />
      )}

      {p.phase === "result" && p.result && (
        <DeliveryResultPanel
          view={p.result}
          onRetry={p.retryQuiz}
          onBack={p.goWorkspace}
          onHome={p.goHome}
          onOpenTerm={p.openTermCard}
        />
      )}

      <TermCardDialog term={p.termCard} onClose={p.closeTermCard} />
    </div>
  )
}
