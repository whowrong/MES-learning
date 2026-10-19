import { BookMarked, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export interface TermCardView {
  id: string
  term: string
  dialect: string
  knowledge_id: string
  /** -1 = 还没学过（从未评级） */
  level: number
  masteryLabel: string
  masteryTone: "bad" | "mid" | "good" | "none"
  dueLabel: string
  inQueue: boolean
}

interface TermCardGridProps {
  cards: TermCardView[]
  onOpen: (termId: string) => void
  onMarkUnknown: (termId: string) => void
}

const TONE_STYLE: Record<TermCardView["masteryTone"], string> = {
  bad: "bg-destructive/15 text-destructive",
  mid: "bg-secondary text-secondary-foreground",
  good: "bg-primary/15 text-primary",
  none: "bg-muted text-muted-foreground",
}

/** 术语卡网格：掌握度徽标 + 到期提示 + 标记不熟 */
export function TermCardGrid({ cards, onOpen, onMarkUnknown }: TermCardGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.id}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(c.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onOpen(c.id)
          }}
          className="flex h-full cursor-pointer flex-col rounded-2xl border-2 border-border bg-card p-5 text-left shadow-md transition-all duration-200 hover:border-primary/50 hover:shadow-lg focus-visible:shadow-[var(--focus-ring)] animate-in fade-in duration-300"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-foreground">{c.term}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">「{c.dialect}」</p>
            </div>
            <Badge className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${TONE_STYLE[c.masteryTone]}`}>
              {c.masteryLabel}
            </Badge>
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 pt-4">
            <span className="font-mono text-xs text-muted-foreground">
              {c.knowledge_id}
              {c.dueLabel ? ` · ${c.dueLabel}` : ""}
            </span>
            <Button
              size="sm"
              variant={c.inQueue ? "outline" : "secondary"}
              disabled={c.inQueue}
              onClick={(e) => {
                e.stopPropagation()
                onMarkUnknown(c.id)
              }}
              className="h-8 shrink-0 rounded-full text-xs focus-visible:shadow-[var(--focus-ring)]"
            >
              {c.inQueue ? (
                <>
                  <BookMarked className="mr-1 h-3.5 w-3.5" />
                  已在复习队列
                </>
              ) : (
                <>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  标记不熟
                </>
              )}
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
