// 单位断链图：结存按米、领用按根，中间缺换算率，两本账永远对不上
export function UnitMismatch() {
  return (
    <div className="py-2" role="img" aria-label="单位断链示意：结存 300 米和领用 50 根之间缺少 1 根等于 6 米的换算率，账目无法核对">
      <div className="flex items-stretch justify-center gap-2">
        <div className="flex-1 rounded-xl border-2 border-border bg-card px-3 py-2 text-center shadow-sm">
          <p className="text-xs text-muted-foreground">结存账</p>
          <p className="font-mono text-lg font-bold text-foreground">300 米</p>
        </div>
        <div className="flex flex-col items-center justify-center px-1">
          <span className="text-base text-destructive" aria-hidden>⚡</span>
          <p className="mt-0.5 max-w-[7rem] text-center text-xs leading-4 text-destructive">
            1 根 = 6 米<br />没配进系统
          </p>
        </div>
        <div className="flex-1 rounded-xl border-2 border-border bg-card px-3 py-2 text-center shadow-sm">
          <p className="text-xs text-muted-foreground">领用账</p>
          <p className="font-mono text-lg font-bold text-foreground">50 根</p>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        300 米 − 50 根 = ？没有换算率，这道减法根本没法做——盘点差异一半是它造成的
      </p>
    </div>
  )
}
