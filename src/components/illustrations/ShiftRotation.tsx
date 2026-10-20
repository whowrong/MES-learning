// 班次轮转图：24 小时条上白班夜班各占 8 小时，交接点是数据对账的最小单位
export function ShiftRotation() {
  return (
    <div className="py-2" role="img" aria-label="班次轮转示意：8 点到 16 点白班，16 点到 24 点夜班，交接会有数量、异常、待办三样交接">
      <div className="mx-auto max-w-sm">
        <div className="flex h-9 w-full overflow-hidden rounded-lg border-2 border-border text-center">
          <div className="flex flex-1 items-center justify-center bg-primary/25">
            <span className="text-xs font-bold text-foreground">白班 8:00–16:00 · 180 件</span>
          </div>
          <div className="flex flex-1 items-center justify-center bg-secondary">
            <span className="text-xs font-bold text-secondary-foreground">夜班 16:00–24:00 · 150 件</span>
          </div>
          <div className="flex flex-1 items-center justify-center bg-muted">
            <span className="text-xs text-muted-foreground">0:00–8:00 停机</span>
          </div>
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>产量、报废按班次分开记</span>
          <span className="font-medium text-primary">← 15:50 交接会：数量 + 异常 + 待办</span>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        出了差异先锁到班、再锁到工序和人——班次是执行数据对账的最小单位
      </p>
    </div>
  )
}
