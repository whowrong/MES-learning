import { useState } from "react"
import { ChevronDown, ChevronUp, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { DeliveryCard } from "@/content/delivery"

interface DeliveryCardsPanelProps {
  cards: DeliveryCard[]
  moduleName: string
  subtitle: string
  intro: string
  knowledgeIds: string[]
  onOpenTerm: (termId: string) => void
  onNext: () => void
}

/** 讲解卡：读完就能讲给面试官听的一段 */
export function DeliveryCardsPanel({
  cards,
  moduleName,
  subtitle,
  intro,
  knowledgeIds,
  onOpenTerm,
  onNext,
}: DeliveryCardsPanelProps) {
  const [openId, setOpenId] = useState<string>(cards[0]?.id ?? "")

  return (
    <section className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <div className="rounded-2xl bg-card p-5 shadow-md">
        <h2 className="text-lg font-bold text-foreground">{moduleName}</h2>
        <p className="mt-1 text-sm text-primary">{subtitle}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{intro}</p>
        {knowledgeIds.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {knowledgeIds.map((k) => (
              <Badge key={k} variant="secondary" className="rounded-full font-mono font-normal">
                {k}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {cards.map((card) => {
          const open = openId === card.id
          return (
            <div key={card.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <button
                type="button"
                onClick={() => setOpenId(open ? "" : card.id)}
                className="flex w-full items-start gap-3 p-4 text-left focus-visible:shadow-[var(--focus-ring)]"
              >
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="flex-1">
                  <span className="block text-sm font-bold text-foreground">{card.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{card.summary}</span>
                </span>
                {open ? (
                  <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
              {open && (
                <div className="space-y-3 border-t border-border/60 px-4 py-4">
                  <ul className="space-y-2">
                    {card.points.map((p, i) => (
                      <li key={i} className="flex gap-2 text-sm leading-6 text-foreground">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                  {card.pitfalls.length > 0 && (
                    <div className="rounded-xl bg-destructive/5 p-3">
                      <p className="text-xs font-bold text-destructive">常见坑</p>
                      <ul className="mt-1.5 space-y-1.5">
                        {card.pitfalls.map((p, i) => (
                          <li key={i} className="text-xs leading-5 text-muted-foreground">
                            · {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {card.knowledge_ids.map((k) => (
                      <Badge key={k} variant="outline" className="rounded-full font-mono font-normal text-muted-foreground">
                        {k}
                      </Badge>
                    ))}
                    {card.term_ids.map((tid) => (
                      <button
                        key={tid}
                        type="button"
                        onClick={() => onOpenTerm(tid)}
                        className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:shadow-[var(--focus-ring)]"
                      >
                        {tid}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} className="bg-primary text-primary-foreground">
          去写四件交付物
        </Button>
      </div>
    </section>
  )
}
