import { AlertCircle, ArrowRight, Minus, PartyPopper, TrendingDown, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GAUGE_DEFS } from "@/content/chapters"
import type { LevelDef, TermDef } from "@/content/loader"
import type { ChapterScoreResult, GaugeDelta } from "@/game/settlement"

interface StageResultProps {
  level: LevelDef
  deltas: GaugeDelta[]
  score: ChapterScoreResult | null
  breakdown: Array<{ label: string; correct: number; total: number }>
  newReviewTerms: string[]
  terms: Record<string, TermDef>
  saveError: string
  onGoHome: () => void
  onOpenTerm: (termId: string) => void
}

const RANK_STYLE: Record<string, string> = {
  S: "bg-primary text-primary-foreground",
  A: "bg-secondary text-secondary-foreground",
  B: "bg-muted text-foreground",
  C: "bg-muted text-muted-foreground",
}

/** 章节结算：总评分 + 通关剧情 + 六仪表变动分解（每项带原因）+ 进复习队列的错词 */
export function StageResult({ level, deltas, score, breakdown, newReviewTerms, terms, saveError, onGoHome, onOpenTerm }: StageResultProps) {
  const rankText = score ? level.result.rankTexts?.[score.rank] ?? "" : ""
  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      {score && (
        <div className="rounded-2xl bg-card p-6 shadow-md animate-in fade-in zoom-in-95 duration-500">
          <div className="flex items-center gap-5">
            <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary/10">
              <span className="font-mono text-3xl font-bold text-primary">{score.score}</span>
              <span className="text-xs text-muted-foreground">总评分</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge className={`rounded-full px-3 py-1 text-base font-bold ${RANK_STYLE[score.rank] ?? RANK_STYLE.C}`}>
                  {score.rank}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  答对 {score.correct} / {score.total} 个判定点
                </span>
              </div>
              {rankText && <p className="mt-2 text-sm leading-6 text-foreground">{rankText}</p>}
            </div>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-3">
            {breakdown.map((row) => (
              <li key={row.label} className="rounded-xl bg-muted px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-foreground">
                  {row.correct}
                  <span className="text-muted-foreground"> / {row.total}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={`rounded-2xl bg-card p-6 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500 ${score ? "mt-5" : ""}`}>
        <div className="flex items-center gap-2 text-primary">
          <PartyPopper className="h-5 w-5" />
          <span className="text-sm font-bold">第{level.chapter}章 · {level.title} 通关</span>
        </div>
        <p className="mt-3 text-base leading-7 text-foreground">{level.result.clearedText}</p>
        <p className="mt-3 rounded-xl bg-secondary px-4 py-3 text-sm leading-6 text-secondary-foreground">
          <span className="font-bold">下一章预告：</span>
          {level.result.nextChapterHint}
        </p>
      </div>

      <div className="mt-5 rounded-2xl bg-card p-6 shadow-md">
        <h3 className="text-lg font-bold text-foreground">项目仪表变动分解</h3>
        <p className="mt-1 text-xs text-muted-foreground">每个决策只动 2–3 项仪表，每一笔变动都写清原因。</p>
        <ul className="mt-4 space-y-3">
          {deltas.map((d) => {
            const def = GAUGE_DEFS.find((g) => g.key === d.key)
            if (!def) return null
            const good = d.delta === 0 ? null : d.delta > 0 === def.higherIsBetter
            const Icon = good === null ? Minus : good ? TrendingUp : TrendingDown
            const tone = good === null ? "text-muted-foreground" : good ? "text-primary" : "text-destructive"
            return (
              <li key={d.key} className="flex items-start gap-3 rounded-xl bg-muted px-4 py-3">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {def.label}
                    <span className={`ml-2 font-mono font-bold ${tone}`}>
                      {d.delta > 0 ? `+${d.delta}` : d.delta}
                      {def.unit}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{d.reason}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {newReviewTerms.length > 0 && (
        <div className="mt-5 rounded-2xl border-2 border-dashed border-border bg-card p-6">
          <h3 className="text-base font-bold text-foreground">这些概念进了你的复习队列</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            答错涉及的术语已标记「不熟」，会按遗忘曲线在术语卡库里等你回来复习。点开先巩固一遍：
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {newReviewTerms.map((tid) => (
              <button key={tid} type="button" onClick={() => onOpenTerm(tid)} className="focus-visible:shadow-[var(--focus-ring)]">
                <Badge className="cursor-pointer rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground">
                  {terms[tid]?.term ?? tid}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {saveError && (
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {saveError}
        </div>
      )}

      <div className="mt-6 flex justify-center">
        <Button
          onClick={onGoHome}
          className="rounded-full bg-primary px-8 text-primary-foreground hover:scale-105 focus-visible:shadow-[var(--focus-ring)]"
        >
          回章节地图
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </section>
  )
}
