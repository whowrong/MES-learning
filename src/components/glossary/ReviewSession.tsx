import { Eye, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { TermDef } from "@/content/loader"
import type { Rating } from "@/game/srs"

interface ReviewSessionProps {
  term: TermDef
  flipped: boolean
  sessionIdx: number
  sessionTotal: number
  ratingPreviews: Record<Rating, string>
  onFlip: () => void
  onRate: (rating: Rating) => void
}

const RATE_BUTTONS: Array<{ rating: Rating; label: string; className: string }> = [
  { rating: "again", label: "忘了", className: "border-2 border-destructive text-destructive hover:bg-destructive/10" },
  { rating: "hard", label: "有点印象", className: "border-2 border-border text-foreground hover:border-primary/50" },
  { rating: "good", label: "记住了", className: "bg-primary text-primary-foreground hover:scale-105" },
  { rating: "easy", label: "秒答", className: "bg-secondary text-secondary-foreground hover:scale-105" },
]

/** Anki 式主动回忆：先看大白话心里作答，翻开对答案，四档自评决定下次复习时间 */
export function ReviewSession({ term, flipped, sessionIdx, sessionTotal, ratingPreviews, onFlip, onRate }: ReviewSessionProps) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <RotateCcw className="h-4 w-4 text-primary" />
          复习模式 · 先回忆再翻卡
        </span>
        <Badge className="rounded-full bg-primary/15 font-mono text-xs text-primary">
          第 {sessionIdx + 1} / {sessionTotal} 张
        </Badge>
      </div>
      {/* 进度点 */}
      <div className="mt-3 flex gap-1" aria-hidden>
        {Array.from({ length: sessionTotal }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < sessionIdx ? "bg-primary" : i === sessionIdx ? "bg-primary/60" : "bg-border"}`} />
        ))}
      </div>

      <div className="mt-6 rounded-3xl bg-card p-8 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
        {!flipped ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-6 text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">车间大白话</p>
            <p className="text-2xl font-bold leading-10 text-foreground">「{term.dialect}」</p>
            <p className="text-sm text-muted-foreground">心里说出它对应的术语，再翻开对答案</p>
            <Button
              onClick={onFlip}
              className="rounded-full bg-primary px-8 text-primary-foreground hover:scale-105 focus-visible:shadow-[var(--focus-ring)]"
            >
              <Eye className="mr-1.5 h-4 w-4" />
              翻开看答案
            </Button>
          </div>
        ) : (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">{term.term}</p>
              <p className="mt-2 text-sm text-muted-foreground">「{term.dialect}」</p>
            </div>
            <div className="mt-5 space-y-3">
              <p className="rounded-xl bg-muted px-4 py-3 text-sm leading-6 text-foreground">{term.definition}</p>
              <p className="rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm leading-6 text-muted-foreground">
                <span className="font-bold text-foreground">例子：</span>
                {term.example}
              </p>
            </div>
            <p className="mt-5 text-center text-xs text-muted-foreground">你刚才回忆对了吗？按真实感受选，间隔才会算得准：</p>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {RATE_BUTTONS.map((b) => (
                <Button
                  key={b.rating}
                  variant="outline"
                  onClick={() => onRate(b.rating)}
                  className={`h-auto flex-col gap-0.5 rounded-2xl px-3 py-3 focus-visible:shadow-[var(--focus-ring)] ${b.className}`}
                >
                  <span className="text-sm font-bold">{b.label}</span>
                  <span className="text-xs opacity-70">{ratingPreviews[b.rating]}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
