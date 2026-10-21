import { Terminal, Monitor, Cloud, Network, ChevronRight, BadgeCheck } from "lucide-react"
import type { ComponentType } from "react"

const DOMAIN_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  linux: Terminal,
  windows: Monitor,
  cloud: Cloud,
  integration: Network,
}

export interface DomainsView {
  domainViews: Array<{
    domain: string
    domainName: string
    brief: string
    itemCount: number
    terminalCount: number
    trained: number
  }>
  practiced: number
}

/** 训练域选择面板：四域卡片，严肃风格，无游戏化文案 */
export function DomainSelectPanel({
  view,
  onChoose,
}: {
  view: DomainsView
  onChoose: (domain: string) => void
}) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-foreground">选择训练域</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          以 MES 为中心、ERP / WMS 为辅的运维实操训练：模拟终端真敲命令、场景决策、处置流程排序。
          {view.practiced > 0 && ` 已完成 ${view.practiced} 次训练。`}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {view.domainViews.map((d) => {
          const Icon = DOMAIN_ICONS[d.domain] ?? Terminal
          return (
            <button
              key={d.domain}
              type="button"
              onClick={() => onChoose(d.domain)}
              className="group flex h-full flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:shadow-[var(--focus-ring)]"
            >
              <div className="flex w-full items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{d.domainName}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.itemCount} 项训练 · 含 {d.terminalCount} 个终端演练
                  </p>
                </div>
                {d.trained > 0 && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    <BadgeCheck className="h-3 w-3" />
                    已训 {d.trained}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{d.brief}</p>
            </button>
          )
        })}
      </div>
    </section>
  )
}
