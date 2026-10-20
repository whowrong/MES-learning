import { Scale } from "lucide-react"

// 账实对照图：账面数 vs 实物数，差异就是库存准确率要管的事
export function InventoryCount() {
  return (
    <div className="py-2" role="img" aria-label="库存账实对照：账面 300 根，实物 290 根，差异 10 根需要追查原因">
      <div className="flex items-stretch justify-center gap-2">
        <div className="flex-1 rounded-xl border-2 border-border bg-card px-3 py-2 text-center shadow-sm">
          <p className="text-xs text-muted-foreground">📒 账面数</p>
          <p className="font-mono text-xl font-bold text-foreground">300</p>
          <p className="text-xs text-muted-foreground">系统里记的</p>
        </div>
        <div className="flex flex-col items-center justify-center px-1">
          <Scale className="h-5 w-5 text-primary" aria-hidden />
          <p className="mt-1 font-mono text-xs font-bold text-destructive">差 10</p>
        </div>
        <div className="flex-1 rounded-xl border-2 border-border bg-card px-3 py-2 text-center shadow-sm">
          <p className="text-xs text-muted-foreground">📦 实物数</p>
          <p className="font-mono text-xl font-bold text-foreground">290</p>
          <p className="text-xs text-muted-foreground">货架上数出来的</p>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        账实差异超 5%，缺料分析、倒冲扣料、交期承诺就全不能信——先对账，再谈别的
      </p>
    </div>
  )
}
