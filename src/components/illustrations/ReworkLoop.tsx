// 返工回环图：检验不合格的件绕回修复，吃工时吃料却不产生新产出
export function ReworkLoop() {
  return (
    <div className="py-2" role="img" aria-label="返工回环：组装到检验，合格的入库，不合格的回炉修复再检，返工吃工时不产生新产出">
      <div className="mx-auto flex max-w-sm items-center justify-center gap-2">
        <div className="rounded-xl border-2 border-border bg-card px-3 py-2 text-center shadow-sm">
          <p className="text-xs font-bold text-foreground">组装</p>
        </div>
        <span className="text-primary" aria-hidden>→</span>
        <div className="rounded-xl border-2 border-border bg-card px-3 py-2 text-center shadow-sm">
          <p className="text-xs font-bold text-foreground">检验</p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="text-primary" aria-hidden>→</span>
            <div className="rounded-xl border-2 border-primary bg-primary/15 px-3 py-1.5 text-center">
              <p className="text-xs font-bold text-foreground">合格入库</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-destructive" aria-hidden>↺</span>
            <div className="rounded-xl border-2 border-dashed border-destructive/50 bg-destructive/10 px-3 py-1.5 text-center">
              <p className="text-xs font-bold text-foreground">回炉修复</p>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        返工这件椅子：工时翻倍、漆料翻倍，产量报表上却还是那 1 把——返工工时不单独统计，产能永远算不准
      </p>
    </div>
  )
}
