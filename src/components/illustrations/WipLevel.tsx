// 在制品水位图：两道工序之间的堆积量与红线，超线就该上游降速或下游加人
export function WipLevel() {
  return (
    <div className="py-2" role="img" aria-label="在制品水位图：焊接与喷涂之间堆积 150 个椅架，红线是 200，超线要降速或加人">
      <div className="flex items-stretch justify-center gap-3">
        <div className="flex w-20 flex-col items-center justify-center rounded-xl border-2 border-border bg-card px-2 py-3 text-center shadow-sm">
          <span className="text-lg" aria-hidden>🔥</span>
          <p className="mt-1 text-xs font-bold text-foreground">焊接</p>
          <p className="text-xs text-muted-foreground">上道</p>
        </div>
        {/* 中间水位池 */}
        <div className="relative flex w-28 flex-col justify-end overflow-hidden rounded-xl border-2 border-dashed border-border bg-background">
          {/* 红线 200 */}
          <div className="absolute left-0 right-0 top-[22%] border-t-2 border-dashed border-destructive" aria-hidden>
            <span className="absolute -top-4 right-0 font-mono text-xs text-destructive">红线 200</span>
          </div>
          {/* 当前水位 150/250 */}
          <div className="illustration-water h-[52%] w-full rounded-b-lg bg-primary/30" aria-hidden />
          <div className="absolute inset-x-0 bottom-1 text-center">
            <p className="font-mono text-sm font-bold text-foreground">150 个</p>
            <p className="text-xs text-muted-foreground">在制品</p>
          </div>
        </div>
        <div className="flex w-20 flex-col items-center justify-center rounded-xl border-2 border-border bg-card px-2 py-3 text-center shadow-sm">
          <span className="text-lg" aria-hidden>🎨</span>
          <p className="mt-1 text-xs font-bold text-foreground">喷涂</p>
          <p className="text-xs text-muted-foreground">下道</p>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        水位 = 上道完工累计 − 下道开工累计；超红线：上游降速，或给下游加人
      </p>
    </div>
  )
}
