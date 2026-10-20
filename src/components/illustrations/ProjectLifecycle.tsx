import { ArrowRight } from "lucide-react"

// 实施项目生命周期全景：六个阶段就是一条真实的 MES 实施项目路线，与章节地图一一对应
const PHASES = [
  { ch: 1, name: "调研认知", icon: "🔍", note: "听懂车间的话" },
  { ch: 2, name: "数据清洗", icon: "🧹", note: "洗干净的账才敢导" },
  { ch: 3, name: "建模配置", icon: "🏗️", note: "把工厂装进系统" },
  { ch: 4, name: "执行报工", icon: "📋", note: "挤掉产量的水分" },
  { ch: 5, name: "质量库存", icon: "⚖️", note: "账实相符之战" },
  { ch: 6, name: "上线陪产", icon: "🚀", note: "风暴日站住阵脚" },
]

export function ProjectLifecycle() {
  return (
    <section className="py-6" aria-label="MES 实施项目生命周期全景">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl border-2 border-border bg-card p-5 shadow-md">
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            一个 MES 实施项目的完整生命周期
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            游戏里的六个章节，就是实施顾问在真实项目里走过的六个阶段——每一站都有对应的行业黑话、真实事故和标准动作。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {PHASES.map((p, i) => (
              <div key={p.ch} className="relative flex flex-col items-center">
                <div className="flex w-full flex-col items-center rounded-xl border-2 border-border bg-background px-2 py-3 text-center">
                  <span className="text-xl" aria-hidden>{p.icon}</span>
                  <p className="mt-1 text-xs font-bold text-foreground">{p.name}</p>
                  <p className="text-xs leading-4 text-muted-foreground">{p.note}</p>
                  <span className="mt-1.5 rounded-full bg-primary/15 px-2 py-0.5 font-mono text-xs text-primary">
                    第 {p.ch} 章
                  </span>
                </div>
                {i < PHASES.length - 1 && (
                  <ArrowRight
                    aria-hidden
                    className="absolute -right-2.5 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-primary lg:block"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
