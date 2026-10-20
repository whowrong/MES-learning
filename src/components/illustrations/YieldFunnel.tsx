// 产出漏斗：投入 200 件的去向分解——合格、返工、报废，三个数加起来必须等于投入
export function YieldFunnel() {
  return (
    <div className="py-2" role="img" aria-label="产出漏斗：投入 200 件，合格 190 件、返工 6 件、报废 4 件，合格率 95%">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-1.5">
        <div className="w-full rounded-xl border-2 border-border bg-card px-3 py-2 text-center shadow-sm">
          <p className="text-xs text-muted-foreground">投入毛坯</p>
          <p className="font-mono text-lg font-bold text-foreground">200 件</p>
        </div>
        <div className="h-3 w-2/3 rounded-b-xl border-x-2 border-b-2 border-border bg-secondary/60" aria-hidden />
        <div className="flex w-full items-stretch gap-1.5">
          <div className="flex-[6] rounded-xl border-2 border-primary bg-primary/15 px-2 py-2 text-center">
            <p className="text-xs text-muted-foreground">合格</p>
            <p className="font-mono text-base font-bold text-foreground">190</p>
          </div>
          <div className="flex-[2] rounded-xl border-2 border-border bg-card px-2 py-2 text-center">
            <p className="text-xs text-muted-foreground">返工可救</p>
            <p className="font-mono text-base font-bold text-foreground">6</p>
          </div>
          <div className="flex-[2] rounded-xl border-2 border-destructive/40 bg-destructive/10 px-2 py-2 text-center">
            <p className="text-xs text-muted-foreground">报废真损</p>
            <p className="font-mono text-base font-bold text-foreground">4</p>
          </div>
        </div>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          合格率 = 190 ÷ 200 = 95%；恒等式：投入 = 合格 + 返工 + 报废，对不上必有鬼
        </p>
      </div>
    </div>
  )
}
