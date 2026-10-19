import { ArrowRight, PartyPopper } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ReviewCompleteProps {
  ratedCount: number
  nextDueText: string
  onBackToBrowse: () => void
  onGoHome: () => void
}

/** 复习完成庆祝页：本次战果 + 下次复习预告 */
export function ReviewComplete({ ratedCount, nextDueText, onBackToBrowse, onGoHome }: ReviewCompleteProps) {
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <div className="rounded-3xl bg-card p-8 text-center shadow-lg animate-in fade-in zoom-in-95 duration-500">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
          <PartyPopper className="h-8 w-8 text-primary" />
        </span>
        <h2 className="mt-4 text-2xl font-bold text-foreground">今日复习完成</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          本次复习 <span className="font-mono text-lg font-bold text-primary">{ratedCount}</span> 张卡。
          <br />
          按遗忘曲线，它们会在你快要忘记的那天回来找你。
        </p>
        <p className="mt-4 rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          <span className="font-bold">下一张到期的卡：</span>
          {nextDueText}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            variant="outline"
            onClick={onBackToBrowse}
            className="rounded-full focus-visible:shadow-[var(--focus-ring)]"
          >
            回卡库浏览
          </Button>
          <Button
            onClick={onGoHome}
            className="rounded-full bg-primary text-primary-foreground hover:scale-105 focus-visible:shadow-[var(--focus-ring)]"
          >
            回章节地图
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
