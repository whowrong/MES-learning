import { AlertCircle, ArrowLeft, BookOpen, Flame, Loader2, Map, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TermCardGrid } from "@/components/glossary/TermCardGrid"
import { ReviewSession } from "@/components/glossary/ReviewSession"
import { ReviewComplete } from "@/components/glossary/ReviewComplete"
import { TermCardDialog } from "@/components/level/TermCardDialog"
import type { useGlossary } from "./useGlossary"

export function GlossaryPage(p: ReturnType<typeof useGlossary>) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/40 to-card">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6">
          <Button variant="ghost" size="sm" onClick={p.goHome} className="shrink-0 rounded-full focus-visible:shadow-[var(--focus-ring)]">
            <ArrowLeft className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">章节地图</span>
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BookOpen className="h-3.5 w-3.5" />
            </span>
            <span className="truncate text-sm font-bold text-foreground">术语卡库</span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {p.mode === "browse" && (
              <Button
                onClick={p.startReview}
                disabled={p.dueList.length === 0}
                className="rounded-full bg-primary px-3 text-primary-foreground hover:scale-105 focus-visible:shadow-[var(--focus-ring)] sm:px-4"
              >
                <RotateCcw className="mr-1 sm:mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">
                  {p.dueList.length > 0 ? `开始复习 · ${p.dueList.length} 张到期` : "暂无到期的卡"}
                </span>
                <span className="sm:hidden">{p.dueList.length > 0 ? `复习 ${p.dueList.length} 张` : "无到期"}</span>
              </Button>
            )}
            {p.mode === "review" && (
              <Button variant="outline" onClick={p.backToBrowse} className="rounded-full focus-visible:shadow-[var(--focus-ring)]">
                退出复习
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="pb-16">
        {p.loading && (
          <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">正在翻卡库…</p>
          </div>
        )}

        {!p.loading && p.loadError && (
          <div className="mx-auto max-w-xl px-6 py-20">
            <div className="rounded-2xl bg-card p-6 text-center shadow-md">
              <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
              <p className="mt-3 text-sm leading-6 text-foreground">{p.loadError}</p>
              <Button onClick={p.goHome} className="mt-4 rounded-full bg-primary text-primary-foreground focus-visible:shadow-[var(--focus-ring)]">
                回章节地图
              </Button>
            </div>
          </div>
        )}

        {!p.loading && !p.loadError && p.mode === "browse" && (
          <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            <div className="rounded-2xl bg-card p-6 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-3xl font-bold text-foreground">车间概念，一张卡一个</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                答错和标记「不熟」的术语会进复习队列，按遗忘曲线安排复习——在你快要忘记的那天，它们会回来找你。
                复习时先看车间大白话、心里回忆术语，再翻卡对答案。
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {p.streak > 0 && (
                  <Badge className="rounded-full bg-destructive/15 px-3 py-1 text-destructive">
                    <Flame className="mr-1 h-3.5 w-3.5" />
                    连续学习 {p.streak} 天
                  </Badge>
                )}
                <Badge className="rounded-full bg-primary/15 px-3 py-1 text-primary">共 {p.stats.total} 张</Badge>
                <Badge className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">已掌握 {p.stats.mastered}</Badge>
                <Badge className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">学习中 {p.stats.learning}</Badge>
                <Badge className="rounded-full bg-muted px-3 py-1 text-muted-foreground">未学 {p.stats.fresh}</Badge>
                {p.stats.due > 0 && (
                  <Badge className="rounded-full bg-destructive/15 px-3 py-1 text-destructive">{p.stats.due} 张待复习</Badge>
                )}
              </div>
              {p.saveError && (
                <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {p.saveError}
                </p>
              )}
            </div>

            {/* 知识点地图：按实施阶段分域看掌握进度 */}
            <div className="mt-6 rounded-2xl bg-card p-5 shadow-md">
              <div className="flex items-center gap-2">
                <Map className="h-4 w-4 text-primary" />
                <h2 className="text-base font-bold text-foreground">知识点地图</h2>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                按 MES 实施阶段分域：每个域对应一段主线章节，卡片掌握到「熟悉」以上计入已掌握。
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {p.knowledgeGroups.map((g) => {
                  const masteredPct = g.total > 0 ? Math.round((g.mastered / g.total) * 100) : 0
                  const learningPct = g.total > 0 ? Math.round((g.learning / g.total) * 100) : 0
                  return (
                    <div key={g.code} className="rounded-xl bg-muted px-4 py-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-bold text-foreground">{g.domain}</p>
                        <span className="font-mono text-xs text-muted-foreground">{g.code}</span>
                      </div>
                      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-background">
                        <div className="h-full bg-primary" style={{ width: `${masteredPct}%` }} aria-hidden />
                        <div className="h-full bg-secondary" style={{ width: `${learningPct}%` }} aria-hidden />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        已掌握 <span className="font-mono font-bold text-foreground">{g.mastered}</span> / {g.total} 张
                        {g.learning > 0 && <span> · 学习中 {g.learning}</span>}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-6">
              <TermCardGrid cards={p.cardViews} onOpen={p.openTermCard} onMarkUnknown={p.markUnknown} />
            </div>
          </section>
        )}

        {!p.loading && !p.loadError && p.mode === "review" && p.currentTerm && (
          <ReviewSession
            term={p.currentTerm}
            flipped={p.flipped}
            sessionIdx={p.sessionIdx}
            sessionTotal={p.sessionTotal}
            ratingPreviews={p.ratingPreviews}
            onFlip={p.flipCard}
            onRate={p.rateCurrent}
          />
        )}

        {p.mode === "done" && (
          <ReviewComplete
            ratedCount={p.ratedCount}
            nextDueText={p.nextDueSummary}
            onBackToBrowse={p.backToBrowse}
            onGoHome={p.goHome}
          />
        )}
      </main>

      <TermCardDialog term={p.termCard} onClose={p.closeTermCard} />
    </div>
  )
}
