import { ArrowRight } from "lucide-react"

// 工单状态机：创建 → 下达 → 执行 → 完工 → 关闭，每个状态一句话讲清
const STATES = [
  { name: "创建", note: "草稿，车间看不见" },
  { name: "下达", note: "发令枪，触发备料" },
  { name: "执行", note: "报工数据往里流" },
  { name: "完工", note: "活干完，账未平" },
  { name: "关闭", note: "核销完毕，单据锁定" },
]

export function WorkOrderStates() {
  return (
    <div className="py-2" role="img" aria-label="工单状态机：创建、下达、执行、完工、关闭五个状态依次流转，关闭后单据锁定">
      <div className="flex items-stretch justify-between gap-1">
        {STATES.map((s, i) => (
          <div key={s.name} className="flex flex-1 items-center gap-1">
            <div className="flex flex-1 flex-col items-center rounded-xl border-2 border-border bg-card px-1 py-2 text-center shadow-sm">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-bold ${
                  i === STATES.length - 1 ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
                }`}
                aria-hidden
              >
                {i + 1}
              </span>
              <p className="mt-1 text-xs font-bold text-foreground">{s.name}</p>
              <p className="text-xs leading-4 text-muted-foreground">{s.note}</p>
            </div>
            {i < STATES.length - 1 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        完工 ≠ 了结：料扣完没、数对平没、差异说明没，都清了才能关闭
      </p>
    </div>
  )
}
