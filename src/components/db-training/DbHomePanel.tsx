import { Database, Server, Trophy, ArrowRight, TerminalSquare } from "lucide-react"
import type { useDbTraining } from "@/pages/DbTraining/useDbTraining"

type P = ReturnType<typeof useDbTraining>

/** 总览：四个任务组卡 + SQL 工作台入口（含真实数据库连接） */
export function DbHomePanel({
  view,
  onChooseGroup,
  onOpenWorkbench,
}: {
  view: NonNullable<P["homeView"]>
  onChooseGroup: (g: string) => void
  onOpenWorkbench: () => void
}) {
  return (
    <section className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        所有任务都在<b className="text-foreground">真实 SQL 执行环境</b>里练：内置练习库预置了一套带典型脏数据的 MES 业务表，
        写的每条 SQL 都真执行、返回真结果，校验通过才算过。也可以在工作台里连接你自己的远程数据库练真实环境。
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {view.groupViews.map((g) => (
          <button
            key={g.group}
            type="button"
            onClick={() => onChooseGroup(g.group)}
            className="group rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50 focus-visible:shadow-[var(--focus-ring)]"
          >
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-bold text-foreground">{g.groupName}</span>
              {g.bestScore !== null && (
                <span className="ml-auto flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <Trophy className="h-3 w-3" />
                  最佳 {g.bestScore}
                </span>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{g.brief}</p>
            <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
              <TerminalSquare className="h-3 w-3" />
              {g.taskCount} 个实操任务
              {g.attempts > 0 && <span className="ml-1">· 练过 {g.attempts} 次</span>}
              <ArrowRight className="ml-auto h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </p>
          </button>
        ))}
      </div>

      {/* 工作台入口 */}
      <button
        type="button"
        onClick={onOpenWorkbench}
        className="group mt-3 flex w-full items-center gap-3 rounded-xl border border-border bg-muted/50 p-4 text-left shadow-sm transition-colors hover:border-primary/50 focus-visible:shadow-[var(--focus-ring)]"
      >
        <Server className="h-5 w-5 shrink-0 text-primary" />
        <span>
          <span className="block text-sm font-bold text-foreground">SQL 工作台（自由执行）</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            在内置练习库上自由查数，或登记连接你自己的 MySQL / SQL Server / PostgreSQL 远程库
            {view.connectionCount > 0 && <b className="text-primary"> · 已存 {view.connectionCount} 个连接</b>}
          </span>
        </span>
        <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </button>
    </section>
  )
}
