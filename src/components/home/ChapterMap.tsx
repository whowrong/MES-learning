import { ArrowRight, Lock, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ChapterDef, ChapterState } from "@/content/chapters"

interface ChapterMapProps {
  chapters: ChapterDef[]
  chapterState: Record<string, ChapterState>
  onOpen: (ch: ChapterDef) => void
}

function stateOf(ch: ChapterDef, chapterState: Record<string, ChapterState>): ChapterState {
  return chapterState[String(ch.id)] ?? (ch.playable ? "open" : "locked")
}

export function ChapterMap({ chapters, chapterState, onOpen }: ChapterMapProps) {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-bold text-foreground">实施路线图</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          六个章节就是一条真实的 MES 实施项目生命周期——从进厂调研到上线陪产。
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {chapters.map((ch, idx) => {
            const st = stateOf(ch, chapterState)
            const isOpen = st !== "locked"
            return (
              <div key={ch.id} className="relative flex items-stretch gap-2">
                {idx > 0 && idx % 3 !== 0 && (
                  <ArrowRight
                    aria-hidden
                    className="absolute -left-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground lg:block"
                  />
                )}
                <button
                  type="button"
                  onClick={() => onOpen(ch)}
                  className={`flex h-full w-full flex-col rounded-2xl bg-card p-5 text-left shadow-md transition-all duration-300 focus-visible:shadow-[var(--focus-ring)] ${
                    isOpen
                      ? "border-2 border-primary hover:-translate-y-1 hover:shadow-lg"
                      : "border-2 border-dashed border-border opacity-70 hover:opacity-90"
                  } animate-in fade-in slide-in-from-bottom-4 duration-500`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full font-mono text-sm font-bold ${
                        st === "cleared"
                          ? "bg-primary text-primary-foreground"
                          : isOpen
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {st === "cleared" ? <Star className="h-4 w-4" /> : ch.id}
                    </span>
                    {st === "cleared" && (
                      <Badge className="rounded-full bg-primary/15 text-primary">已通关</Badge>
                    )}
                    {st === "open" && (
                      <Badge className="rounded-full bg-primary text-primary-foreground">可进入</Badge>
                    )}
                    {st === "locked" && (
                      <Badge variant="outline" className="rounded-full text-muted-foreground">
                        <Lock className="mr-1 h-3 w-3" />
                        施工中
                      </Badge>
                    )}
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-foreground">{ch.title}</h3>
                  <p className="font-mono text-xs tracking-wide text-primary">{ch.scene}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{ch.story}</p>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                    {ch.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="rounded-full font-normal">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
