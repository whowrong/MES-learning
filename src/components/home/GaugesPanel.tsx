import { ArrowDown, ArrowUp, Minus } from "lucide-react"
import type { GaugeDef } from "@/content/chapters"

export interface GaugeView {
  def: GaugeDef
  value: number
  delta: number
}

interface GaugesPanelProps {
  gaugeViews: GaugeView[]
}

function deltaTone(def: GaugeDef, delta: number): "good" | "bad" | "flat" {
  if (delta === 0) return "flat"
  const rising = delta > 0
  return (rising && def.higherIsBetter) || (!rising && !def.higherIsBetter) ? "good" : "bad"
}

export function GaugesPanel({ gaugeViews }: GaugesPanelProps) {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-bold text-foreground">项目仪表盘</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          你的每个决策只会动其中两三项——变动多少、为什么变，都会当场拆给你看。
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {gaugeViews.map(({ def, value, delta }) => {
            const tone = deltaTone(def, delta)
            const fillRatio = def.higherIsBetter
              ? Math.min(Math.max(value / def.max, 0), 1)
              : Math.min(Math.max(value / def.max, 0), 1)
            const barTone = def.higherIsBetter
              ? value >= def.max * 0.6
                ? "bg-primary"
                : "bg-destructive"
              : value > 0
                ? "bg-destructive"
                : "bg-primary"
            return (
              <div
                key={def.key}
                className="flex h-full flex-col rounded-2xl bg-card p-4 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                <p className="text-xs font-medium text-muted-foreground">{def.label}</p>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="font-mono text-2xl font-bold text-foreground">{value}</span>
                  <span className="text-xs text-muted-foreground">{def.unit}</span>
                  {tone === "good" && (
                    <ArrowUp className="ml-auto h-4 w-4 text-primary" aria-label="好转" />
                  )}
                  {tone === "bad" && (
                    <ArrowDown className="ml-auto h-4 w-4 text-destructive" aria-label="恶化" />
                  )}
                  {tone === "flat" && (
                    <Minus className="ml-auto h-4 w-4 text-muted-foreground" aria-label="无变化" />
                  )}
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${barTone} transition-all duration-500`}
                    style={{ width: `${fillRatio * 100}%` }}
                  />
                </div>
                <p className="mt-auto pt-2 text-xs leading-5 text-muted-foreground">{def.hint}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
