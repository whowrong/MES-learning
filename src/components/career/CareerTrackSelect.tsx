import { Briefcase, ClipboardCheck, Layers } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { CareerTrackView } from "@/pages/CareerPrep/useCareerPrep"

const ICONS: Record<string, typeof Briefcase> = {
  direction1: Briefcase,
  direction4: ClipboardCheck,
  base: Layers,
}

interface CareerTrackSelectProps {
  views: CareerTrackView[]
  onChoose: (id: string) => void
}

/** 赛道选择：三条线各一张卡，写清覆盖范围与题量 */
export function CareerTrackSelect({ views, onChoose }: CareerTrackSelectProps) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h2 className="text-lg font-bold text-foreground">选一条线开始</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        每条线都有知识点卡片和一套测验。先读卡片再组卷，答错的术语会自动进复习队列。
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {views.map((v) => {
          const Icon = ICONS[v.id] ?? Briefcase
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onChoose(v.id)}
              className="flex h-full flex-col rounded-2xl border-2 border-border bg-card p-5 text-left shadow-md transition-all hover:border-primary/50 hover:shadow-lg focus-visible:shadow-[var(--focus-ring)]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="mt-3 text-base font-bold text-foreground">{v.name}</span>
              <span className="mt-1 text-sm leading-6 text-muted-foreground">{v.hint}</span>
              <span className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full text-muted-foreground">
                  卡片 {v.cardCount}
                </Badge>
                <Badge variant="outline" className="rounded-full text-muted-foreground">
                  题目 {v.questionCount}
                </Badge>
                {v.orderCount > 0 && (
                  <Badge variant="outline" className="rounded-full text-muted-foreground">
                    顺序题 {v.orderCount}
                  </Badge>
                )}
              </span>
              <span className="mt-auto pt-3 text-xs text-muted-foreground">
                {v.attempts > 0 ? (
                  <>
                    已练 {v.attempts} 次，最好成绩 {v.best} 分
                  </>
                ) : (
                  "还没练过，先读卡片"
                )}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
