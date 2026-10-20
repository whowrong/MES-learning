import { ArrowRight } from "lucide-react"

// 工艺路线流程图：四道工序顺序不可跳，工件沿路线流动，工序间是在制品堆积点
const STAGES = [
  { name: "切割", icon: "✂️", desc: "钢管下料" },
  { name: "焊接", icon: "🔥", desc: "拼成椅架" },
  { name: "喷涂", icon: "🎨", desc: "喷塑上色" },
  { name: "组装", icon: "🪑", desc: "装成整椅" },
]

export function RouteFlow() {
  return (
    <div className="py-2" role="img" aria-label="工艺路线：切割、焊接、喷涂、组装四道工序按顺序流转，上道不完工下道开不了工">
      <div className="flex items-stretch justify-between gap-1">
        {STAGES.map((s, i) => (
          <div key={s.name} className="flex flex-1 items-center gap-1">
            <div className="flex flex-1 flex-col items-center rounded-xl border-2 border-border bg-card px-1 py-2 text-center shadow-sm">
              <span className="text-lg" aria-hidden>{s.icon}</span>
              <p className="mt-1 text-xs font-bold text-foreground">{i + 1}. {s.name}</p>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </div>
            {i < STAGES.length - 1 && (
              <div className="flex shrink-0 flex-col items-center gap-0.5">
                <ArrowRight className="h-4 w-4 text-primary" aria-hidden />
                <span className="hidden text-xs text-muted-foreground sm:block" title="工序间堆积的就是在制品">▮▮</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {/* 流动的工件：沿路线跑一遍 */}
      <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="illustration-workpiece h-full w-8 rounded-full bg-primary" />
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        顺序就是质量：上道不完工，下道扫码开不了工；箭头旁的堆积就是在制品
      </p>
    </div>
  )
}
