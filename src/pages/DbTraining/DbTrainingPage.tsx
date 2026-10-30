import { Database, Home, TriangleAlert } from "lucide-react"
import type { useDbTraining } from "./useDbTraining"
import { DbHomePanel } from "@/components/db-training/DbHomePanel"
import { TaskStage } from "@/components/db-training/TaskStage"
import { WorkbenchPanel } from "@/components/db-training/WorkbenchPanel"
import { ConnDialog } from "@/components/db-training/ConnDialog"
import { DbReportPanel } from "@/components/db-training/DbReportPanel"
import type { DbGroupId } from "@/content/dbTraining"

export function DbTrainingPage(p: ReturnType<typeof useDbTraining>) {
  return (
    <div className="min-h-screen bg-background">
      {/* 顶栏 */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-2.5 sm:px-6">
          <Database className="h-4 w-4 shrink-0 text-primary" />
          <h1 className="text-sm font-bold text-foreground">数据库实操营</h1>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">MES 业务库 · 真实 SQL 执行环境</span>
          <button
            type="button"
            onClick={p.goHome}
            className="ml-auto flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground focus-visible:shadow-[var(--focus-ring)]"
          >
            <Home className="h-3.5 w-3.5" />
            首页
          </button>
        </div>
      </header>

      {p.saveError && (
        <p className="mx-auto mt-2 flex max-w-4xl items-center gap-1.5 px-4 text-[11px] text-destructive sm:px-6">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          {p.saveError}
        </p>
      )}

      {p.loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          正在准备练习环境…
        </div>
      ) : p.loadError ? (
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <TriangleAlert className="mx-auto h-6 w-6 text-destructive" />
          <p className="mt-2 text-sm font-semibold text-foreground">练习内容加载失败</p>
          <p className="mt-1 text-xs text-muted-foreground">{p.loadError}</p>
        </div>
      ) : (
        <>
          {p.phase === "home" && p.homeView && (
            <DbHomePanel
              view={p.homeView}
              onChooseGroup={(g) => p.chooseGroup(g as DbGroupId)}
              onOpenWorkbench={p.openWorkbench}
            />
          )}

          {p.phase === "task" && p.taskView && (
            <TaskStage
              view={p.taskView}
              setSqlText={p.setSqlText}
              runSql={p.runSql}
              submitCheck={p.submitCheck}
              showHint={p.showHint}
              viewAnswerNow={p.viewAnswerNow}
              nextTask={p.nextTask}
              onExit={p.backToHome}
              labConnectionId={p.workbenchView.wbConnId}
              labConnection={{
                kind: "db",
                type: p.workbenchView.activeConn?.type,
                host: p.workbenchView.activeConn?.host,
                port: p.workbenchView.activeConn?.port,
                database: p.workbenchView.activeConn?.database,
                username: p.workbenchView.activeConn?.username,
              }}
              labReadOnly={p.workbenchView.readOnlyGuard}
            />
          )}

          {p.phase === "workbench" && p.workbenchView && (
            <WorkbenchPanel
              view={p.workbenchView}
              chooseWbConn={p.chooseWbConn}
              setWbSql={p.setWbSql}
              runWbSql={p.runWbSql}
              confirmDangerExec={p.confirmDangerExec}
              cancelDangerExec={p.cancelDangerExec}
              resetBuiltinDb={p.resetBuiltinDb}
              setReadOnlyGuard={p.setReadOnlyGuard}
              openConnDialog={p.openConnDialog}
              deleteConn={p.deleteConn}
            />
          )}

          {p.phase === "report" && p.report && (
            <DbReportPanel
              report={p.report}
              newReviewTerms={p.newReviewTerms}
              terms={p.terms}
              onRetry={p.retryGroup}
              onBackHome={p.backToHome}
              onGoHome={p.goHome}
            />
          )}

          {p.connDialogOpen && (
            <ConnDialog
              form={p.connForm}
              testResult={p.connTestResult}
              busy={p.connBusy}
              onUpdate={p.updateConnForm}
              onTest={p.testConnForm}
              onSave={p.saveConnForm}
              onClose={p.closeConnDialog}
            />
          )}
        </>
      )}
    </div>
  )
}
