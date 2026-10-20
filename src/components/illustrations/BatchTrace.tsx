import { ArrowLeftRight } from "lucide-react"

// 批次追溯链：原料批次 → 生产批次 → 发货去向，正向召回、反向查因
export function BatchTrace() {
  return (
    <div className="py-2" role="img" aria-label="批次追溯链：原料批次到生产批次再到三家发货去向，可正向召回也可反向查因">
      <div className="flex items-stretch justify-center gap-1.5">
        <div className="flex-1 rounded-xl border-2 border-border bg-card px-2 py-2 text-center shadow-sm">
          <span className="text-base" aria-hidden>🌾</span>
          <p className="mt-0.5 text-xs font-bold text-foreground">原料批次</p>
          <p className="font-mono text-xs text-primary">面粉 20261012-A</p>
        </div>
        <div className="flex flex-col items-center justify-center" aria-hidden>
          <ArrowLeftRight className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 rounded-xl border-2 border-primary bg-primary/15 px-2 py-2 text-center shadow-sm">
          <span className="text-base" aria-hidden>🍞</span>
          <p className="mt-0.5 text-xs font-bold text-foreground">生产批次</p>
          <p className="font-mono text-xs text-primary">20261019-A3 · 5000 瓶</p>
        </div>
        <div className="flex flex-col items-center justify-center" aria-hidden>
          <ArrowLeftRight className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 rounded-xl border-2 border-border bg-card px-2 py-2 text-center shadow-sm">
          <span className="text-base" aria-hidden>🚚</span>
          <p className="mt-0.5 text-xs font-bold text-foreground">发货去向</p>
          <p className="text-xs text-muted-foreground">3 家商超 · 21 家门店</p>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        原料出事 → 正向查「哪批成品受影响、发去了哪」；客诉爆发 → 反向查「用的哪批料、谁操作的」
      </p>
    </div>
  )
}
