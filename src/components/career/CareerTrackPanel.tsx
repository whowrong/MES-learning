import { useState } from "react"
import { ChevronDown, ChevronUp, FileText, PlayCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { CareerTrack } from "@/content/careerPrep"
import type { CareerPaperSize } from "@/content/careerPrep"

interface CareerTrackPanelProps {
  track: CareerTrack
  sizes: CareerPaperSize[]
  activeSizeId: string
  onSizeChange: (id: string) => void
  onStart: () => void
  onOpenTerm: (termId: string) => void
}

/** 赛道页：知识点卡片（可展开）+ 组卷入口 */
export function CareerTrackPanel({
  track,
  sizes,
  activeSizeId,
  onSizeChange,
  onStart,
  onOpenTerm,
}: CareerTrackPanelProps) {
  const [openId, setOpenId] = useState<string>(track.cards[0]?.id ?? "")

  return (
    <section className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <div className="rounded-2xl bg-card p-5 shadow-md">
        <h2 className="text-lg font-bold text-foreground">{track.trackName}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{track.intro}</p>
      </div>

      <div className="space-y-3">
        {track.cards.map((card) => {
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
                  {card.term_ids.length > 0 && (
                    <div className="flex flex-wrap gap-2">
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
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-md">
        <p className="text-sm font-bold text-foreground">组卷测验</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          每道题提交后立即判定并给出参考答案；顺序题考的是流程先后，必须完全正确才得分。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {sizes.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSizeChange(s.id)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:shadow-[var(--focus-ring)] ${
                s.id === activeSizeId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {s.label}
              {s.questionCount > 0 ? `（${s.questionCount} 题）` : "（全部）"}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={onStart} className="bg-primary text-primary-foreground">
            <PlayCircle className="mr-2 h-5 w-5" />
            开始测验
          </Button>
          <Badge variant="outline" className="rounded-full text-muted-foreground">
            题目 {track.questions.length} 道
          </Badge>
        </div>
      </div>
    </section>
  )
}
