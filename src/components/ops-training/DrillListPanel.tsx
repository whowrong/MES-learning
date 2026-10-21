import { SquareTerminal, ListChecks, ArrowDownUp, ChevronLeft, Clock, Trophy } from "lucide-react"
import type { ComponentType } from "react"

const KIND_META: Record<string, { icon: ComponentType<{ className?: string }>; label: string }> = {
  terminal: { icon: SquareTerminal, label: "终端演练" },
  choice: { icon: ListChecks, label: "场景决策" },
  order: { icon: ArrowDownUp, label: "流程排序" },
}

export interface DrillListView {
  domainName: string
  brief: string
  itemViews: Array<{
    id: string
    kind: string
    title: string
    difficulty: string
    minutes: number
    attempts: number
    bestScore: number | null
  }>
}

/** 训练域内的项目清单 */
export function DrillListPanel({
  view,
  onBack,
  onStart,
}: {
  view: DrillListView
  onBack: () => void
  onStart: (itemId: string) => void
}) {
  return (
    <section className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:shadow-[var(--focus-ring)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        返回训练域选择
      </button>
      <div className="mb-5">
        <h2 className="text-lg font-bold text-foreground">{view.domainName}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{view.brief}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {view.itemViews.map((item) => {
          const meta = KIND_META[item.kind] ?? KIND_META.choice
          const Icon = meta.icon
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onStart(item.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:shadow-[var(--focus-ring)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{item.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>{meta.label}</span>
                    <span>难度 {item.difficulty}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />约 {item.minutes} 分钟
                    </span>
                  </span>
                </span>
                {item.bestScore !== null && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    <Trophy className="h-3 w-3" />
                    最佳 {item.bestScore}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
