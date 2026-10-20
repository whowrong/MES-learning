import { ArrowRight } from "lucide-react"

// 倒冲扣料数据流：没人开领料单，系统按产出自动倒算扣料
const STEPS = [
  { label: "报工产出", value: "150 把", note: "合格数触发", tone: "input" as const },
  { label: "× BOM 单耗", value: "4 根/把", note: "椅腿用量", tone: "op" as const },
  { label: "× (1+损耗率)", value: "5%", note: "锯口废料", tone: "op" as const },
  { label: "库存自动扣", value: "630 根", note: "无人开单", tone: "output" as const },
]

export function BackflushFlow() {
  return (
    <div className="py-2" role="img" aria-label="倒冲扣料算式：报工 150 把乘以单耗 4 根再乘 1 加损耗率 5%，库存自动扣 630 根">
      <div className="flex flex-wrap items-stretch justify-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1">
            <div
              className={`rounded-xl border-2 px-3 py-2 text-center shadow-sm ${
                s.tone === "input"
                  ? "border-primary bg-primary/15"
                  : s.tone === "output"
                    ? "border-destructive/40 bg-destructive/10"
                    : "border-border bg-card"
              }`}
            >
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="font-mono text-sm font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.note}</p>
            </div>
            {i < STEPS.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        报工数假一分，扣料账就歪一截——倒冲的准确性全押在产出数字上
      </p>
    </div>
  )
}
