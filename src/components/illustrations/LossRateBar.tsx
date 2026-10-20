// 损耗率条形图：100 米的活要按 103 米备料，多出的 3 米是锯口和磕碰
export function LossRateBar() {
  return (
    <div className="py-2" role="img" aria-label="损耗率示意：103 米备料中 100 米成为成品，3 米是锯口废料，损耗率约 3%">
      <div className="mx-auto max-w-sm">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>一根钢管的下料账</span>
          <span className="font-mono text-foreground">备料 103 米</span>
        </div>
        <div className="mt-1.5 flex h-8 w-full overflow-hidden rounded-lg border-2 border-border">
          <div className="flex h-full items-center justify-center bg-primary/25" style={{ width: "97%" }}>
            <span className="font-mono text-xs font-bold text-foreground">有效 100 米</span>
          </div>
          <div className="flex h-full flex-1 items-center justify-center bg-destructive/25">
            <span className="font-mono text-xs font-bold text-destructive">废 3</span>
          </div>
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>做进椅子里的部分</span>
          <span>锯口 + 磕碰（损耗率 ≈ 3%）</span>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        备料算式：需求 ×（1 + 损耗率）——损耗率来自实测，不是拍脑袋
      </p>
    </div>
  )
}
