import { AlertCircle, Home, Server, Cable } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DomainSelectPanel } from "@/components/ops-training/DomainSelectPanel"
import { DrillListPanel } from "@/components/ops-training/DrillListPanel"
import { TerminalDrill } from "@/components/ops-training/TerminalDrill"
import { OpsChoiceStage } from "@/components/ops-training/OpsChoiceStage"
import { OpsOrderStage } from "@/components/ops-training/OpsOrderStage"
import { OpsReportPanel } from "@/components/ops-training/OpsReportPanel"
import { ServerModePanel } from "./ServerModePanel"
import type { OpsDomainId } from "@/content/opsTraining"
import type { useOpsTraining } from "./useOpsTraining"

export function OpsTrainingPage(p: ReturnType<typeof useOpsTraining>) {
  if (p.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">运维训练内容加载中……</p>
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
            <Server className="h-4 w-4" />
          </span>
          <span className="text-sm font-bold text-foreground">运维训练营</span>
          <span className="hidden text-[11px] text-muted-foreground sm:block">MES 为中心 · ERP / WMS 集成运维</span>
          {p.phase !== "server" && (
            <button
              type="button"
              onClick={p.openServerMode}
              className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:shadow-[var(--focus-ring)]"
            >
              <Cable className="h-3.5 w-3.5" />
              真实服务器
            </button>
          )}
          <button
            type="button"
            onClick={p.goHome}
            className={p.phase === "server" ? "ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:shadow-[var(--focus-ring)]" : "text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:shadow-[var(--focus-ring)]"}
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

      {p.phase === "server" && <ServerModePanel p={p} onExit={p.backFromServer} />}

      {p.phase === "domains" && p.domainsView && (
        <DomainSelectPanel view={p.domainsView} onChoose={(d) => p.chooseDomain(d as OpsDomainId)} />
      )}

      {p.phase === "list" && p.listView && (
        <DrillListPanel view={p.listView} onBack={p.backToDomains} onStart={p.startItem} />
      )}

      {p.phase === "terminal" && p.terminalView && (
        <TerminalDrill
          view={p.terminalView}
          onCommand={p.runCommand}
          onHint={p.askHint}
          onFinish={p.finishDrill}
          onRetry={p.retryCurrent}
          onExit={p.backToList}
          labConnectionId={p.realServerView.activeConnId}
          labConnection={{
            kind: "server",
            host: p.realServerView.activeConn?.host,
            port: p.realServerView.activeConn?.port,
            username: p.realServerView.activeConn?.username,
          }}
        />
      )}

      {p.phase === "choice" && p.choiceView && (
        <>
          <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
            <button
              type="button"
              onClick={p.backToList}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:shadow-[var(--focus-ring)]"
            >
              放弃本组决策题，返回训练清单
            </button>
          </div>
          <OpsChoiceStage view={p.choiceView} onPick={p.pickChoice} onSubmit={p.submitChoice} onNext={p.nextChoice} />
        </>
      )}

      {p.phase === "order" && p.orderView && (
        <>
          <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
            <button
              type="button"
              onClick={p.backToList}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:shadow-[var(--focus-ring)]"
            >
              放弃本次排序，返回训练清单
            </button>
          </div>
          <OpsOrderStage
            view={p.orderView}
            onMove={p.moveOrderStep}
            onSubmit={p.submitOrder}
            onFinish={p.finishOrder}
            onDismissFlash={p.dismissOrderFlash}
          />
        </>
      )}

      {p.phase === "report" && p.report && (
        <OpsReportPanel
          report={p.report}
          newReviewTerms={p.newReviewTerms}
          onRetry={p.retryCurrent}
          onBackToList={p.backToList}
          onBackToDomains={p.backToDomains}
          onHome={p.goHome}
        />
      )}
    </div>
  )
}
