// 节拍时间轴：每 3 秒下线一瓶，理论与实际的差距就是改善空间
export function TaktLine() {
  return (
    <div className="py-2" role="img" aria-label="节拍时间轴：每 3 秒下线一件，一小时理论 1200 瓶，实际 1050 瓶，差的 150 瓶被停机卡瓶吃掉">
      <div className="mx-auto max-w-sm">
        <div className="flex items-end justify-between">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center">
              <span className="text-sm" aria-hidden>🍼</span>
              <div className="mt-0.5 h-4 w-px bg-border" aria-hidden />
            </div>
          ))}
        </div>
        <div className="relative h-px w-full bg-border">
          <div className="absolute -top-4 left-1/4 font-mono text-xs text-primary">3s</div>
          <div className="absolute -top-4 left-2/4 font-mono text-xs text-primary">3s</div>
          <div className="absolute -top-4 left-[74%] font-mono text-xs text-primary">3s</div>
        </div>
        <div className="mt-3 flex justify-between text-xs">
          <span className="rounded-lg bg-primary/15 px-2 py-1 text-foreground">
            理论：<span className="font-mono font-bold">1200 瓶/小时</span>
          </span>
          <span className="rounded-lg bg-destructive/10 px-2 py-1 text-foreground">
            实际：<span className="font-mono font-bold">1050 瓶</span>（差 150）
          </span>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        节拍 = 流水线的心跳；理论和实际差掉的那 150 瓶，就藏在停机、卡瓶、换型里
      </p>
    </div>
  )
}
