// 一物两码图：两个编码指向同一根钢管，账各记各的，采购买双份
export function DuplicateCodes() {
  return (
    <div className="py-2" role="img" aria-label="一物两码示意：LSG-01 和 管-3 两个编码其实是同一根钢管，库存分散在两本账上">
      <div className="mx-auto flex max-w-sm items-center justify-center gap-3">
        <div className="flex flex-col gap-2">
          <div className="rounded-xl border-2 border-destructive/40 bg-destructive/10 px-3 py-1.5 text-center">
            <p className="font-mono text-xs font-bold text-foreground">LSG-01</p>
            <p className="text-xs text-muted-foreground">冷轧钢管 φ25 · 存 120</p>
          </div>
          <div className="rounded-xl border-2 border-destructive/40 bg-destructive/10 px-3 py-1.5 text-center">
            <p className="font-mono text-xs font-bold text-foreground">管-3</p>
            <p className="text-xs text-muted-foreground">φ25 冷拔管 · 存 80</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1" aria-hidden>
          <span className="text-xs text-muted-foreground">↘</span>
          <span className="text-xs text-muted-foreground">↗</span>
        </div>
        <div className="rounded-xl border-2 border-primary bg-primary/15 px-3 py-3 text-center shadow-sm">
          <p className="text-2xl" aria-hidden>🔩</p>
          <p className="mt-1 text-xs font-bold text-foreground">同一根钢管</p>
          <p className="font-mono text-xs text-primary">实际共存 200</p>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        系统以为是两种料：这边喊缺货那边在积压，采购买双份——清洗时合并成一码
      </p>
    </div>
  )
}
