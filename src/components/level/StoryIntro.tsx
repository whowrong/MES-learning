import { ArrowRight, Clapperboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { LevelDef, TermDef } from "@/content/loader"
import { renderStoryText } from "./StoryText"

interface StoryIntroProps {
  level: LevelDef
  terms: Record<string, TermDef>
  storyIdx: number
  storyTotal: number
  onNext: () => void
  onOpenTerm: (termId: string) => void
}

/** 开场剧情：逐段展示，{{term}} 渲染成术语标注，末段按钮进入第一关 */
export function StoryIntro({ level, terms, storyIdx, storyTotal, onNext, onOpenTerm }: StoryIntroProps) {
  const isLast = storyIdx + 1 >= storyTotal
  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="rounded-2xl bg-card p-5 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500 sm:p-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clapperboard className="h-4 w-4 text-primary" />
          开场剧情 · {storyIdx + 1} / {storyTotal}
        </div>
        <p
          key={storyIdx}
          className="mt-4 text-lg leading-8 text-foreground animate-in fade-in duration-300"
        >
          {renderStoryText(level.story[storyIdx] ?? "", terms, onOpenTerm)}
        </p>
        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden>
            {level.story.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${i <= storyIdx ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
          <Button
            onClick={onNext}
            className="rounded-full bg-primary text-primary-foreground hover:scale-105 focus-visible:shadow-[var(--focus-ring)]"
          >
            {isLast ? "开始闯关" : "继续"}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        带底色的词是术语标注，点开能看到车间大白话解释
      </p>
    </section>
  )
}
