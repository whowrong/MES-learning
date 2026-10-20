import { Cog, GitMerge, Workflow, ArrowRight, Layers } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { FactoryShape } from "@/components/illustrations"
import type { FactoryTypeId } from "@/content/factoryTypes"

export interface TypeCardView {
  type: FactoryTypeId
  typeName: string
  tagline: string
  industries: string[]
  questionCount: number
  trained: number
}

interface TypeSelectPanelProps {
  view: { typeViews: TypeCardView[]; practiced: number }
  onChoose: (type: FactoryTypeId) => void
}

const TYPE_ICONS: Record<FactoryTypeId, typeof Cog> = {
  discrete: Cog,
  flow: Workflow,
  hybrid: GitMerge,
}

export function TypeSelectPanel({ view, onChoose }: TypeSelectPanelProps) {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <header className="pt-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">厂型分类训练</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">先认清厂型，再谈实施</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          离散厂、流水线厂、混合厂的调研重点和建模方式完全不同——用错一套方案，上线第一天就会翻车。
          选一种厂型：先翻档案学脾气，再打一场该厂型专属的场景实战测验。
        </p>
      </header>

      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        {view.typeViews.map((t) => {
          const Icon = TYPE_ICONS[t.type] ?? Layers
          return (
            <button
              key={t.type}
              type="button"
              onClick={() => onChoose(t.type)}
              className="flex h-full flex-col rounded-2xl bg-card p-6 text-left shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:shadow-[var(--focus-ring)] animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="text-lg font-bold text-foreground">{t.typeName}</span>
                {t.trained > 0 && (
                  <Badge variant="outline" className="ml-auto rounded-full text-muted-foreground">
                    已训 {t.trained} 场
                  </Badge>
                )}
              </span>
              <span className="mt-3 text-sm leading-6 text-muted-foreground">{t.tagline}</span>
              <span className="mt-3 rounded-xl border border-border bg-background/60 px-3 py-1">
                <FactoryShape variant={t.type} />
              </span>
              <span className="mt-4 flex flex-wrap gap-2">
                {t.industries.map((ind) => (
                  <span key={ind} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                    {ind}
                  </span>
                ))}
              </span>
              <span className="mt-auto inline-flex items-center pt-4 text-sm font-medium text-primary">
                进厂调研（题库 {t.questionCount} 题）
                <ArrowRight className="ml-1 h-4 w-4" />
              </span>
            </button>
          )
        })}
      </section>

      <footer className="mt-10 rounded-2xl border-2 border-dashed border-border bg-card/60 p-5 text-center text-sm leading-6 text-muted-foreground shadow-md">
        {view.practiced > 0 ? (
          <span>
            你已完成 <span className="font-semibold text-primary">{view.practiced}</span> 场厂型特训。三种厂型都练一遍，
            面试被问「离散和流水线实施有什么区别」时你就有案例可讲了。
          </span>
        ) : (
          <span>
            建议顺序：先练<span className="font-semibold text-foreground">离散制造</span>（和你家五金厂剧情同源），
            再练<span className="font-semibold text-foreground">流水线</span>，最后挑战<span className="font-semibold text-foreground">混合型</span>。
          </span>
        )}
      </footer>
    </main>
  )
}
