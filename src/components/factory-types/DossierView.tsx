import { ChevronLeft, ChevronRight, ClipboardList, Swords } from "lucide-react"
import { Button } from "@/components/ui/button"
import { renderStoryText } from "@/components/level/StoryText"
import type { TermDef } from "@/content/loader"
import type { FactoryBriefPage } from "@/content/factoryTypes"

interface DossierViewProps {
  view: {
    typeName: string
    tagline: string
    page: FactoryBriefPage | null
    pageIdx: number
    totalPages: number
    isFirst: boolean
    isLast: boolean
  }
  terms: Record<string, TermDef>
  onPrev: () => void
  onNext: () => void
  onStartQuiz: () => void
  onBack: () => void
  onOpenTerm: (termId: string) => void
}

export function DossierView({ view, terms, onPrev, onNext, onStartQuiz, onBack, onOpenTerm }: DossierViewProps) {
  const page = view.page
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <header className="pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:shadow-[var(--focus-ring)]"
        >
          ← 换一种厂型
        </button>
        <h1 className="mt-3 text-3xl font-bold text-foreground">
          {view.typeName}
          <span className="ml-2 align-middle text-sm font-normal text-muted-foreground">厂型档案</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{view.tagline}</p>
        <div className="mt-4 flex items-center gap-1.5">
          {Array.from({ length: view.totalPages }, (_, i) => (
            <span
              key={i}
              className={
                i === view.pageIdx
                  ? "h-2 w-6 rounded-full bg-primary"
                  : "h-2 w-2 rounded-full bg-border"
              }
            />
          ))}
          <span className="ml-2 text-xs text-muted-foreground">
            第 {view.pageIdx + 1}/{view.totalPages} 屏
          </span>
        </div>
      </header>

      <section className="mt-6 rounded-2xl bg-card p-6 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
          {page?.id === "survey" ? <ClipboardList className="h-5 w-5 text-primary" /> : null}
          {page?.title ?? ""}
        </h2>
        {page?.body && (
          <p className="mt-4 text-sm leading-7 text-muted-foreground">{renderStoryText(page.body, terms, onOpenTerm)}</p>
        )}
        {page?.items && (
          <ul className="mt-4 space-y-3">
            {page.items.map((item, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl bg-secondary/60 p-3 text-sm leading-6 text-secondary-foreground">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
        )}
        {page?.cases && (
          <div className="mt-4 space-y-4">
            {page.cases.map((c) => (
              <article key={c.id} className="rounded-xl border-2 border-dashed border-border p-4">
                <p className="text-sm font-semibold leading-6 text-foreground">🕳️ {c.scene}</p>
                <p className="mt-2 text-sm leading-6 text-destructive">💥 {c.consequence}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">✅ {c.lesson}</p>
                {c.term_ids.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.term_ids.map((tid) => {
                      const t = terms[tid]
                      if (!t) return null
                      return (
                        <button
                          key={tid}
                          type="button"
                          onClick={() => onOpenTerm(tid)}
                          className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground underline decoration-primary decoration-2 underline-offset-2 transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:shadow-[var(--focus-ring)]"
                        >
                          {t.term}
                        </button>
                      )
                    })}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={onPrev} disabled={view.isFirst} className="w-full sm:w-auto">
          <ChevronLeft className="mr-1 h-4 w-4" />
          上一屏
        </Button>
        {view.isLast ? (
          <Button onClick={onStartQuiz} className="w-full bg-primary sm:w-auto">
            <Swords className="mr-2 h-4 w-4" />
            档案看完，开始实战测验
          </Button>
        ) : (
          <Button onClick={onNext} className="w-full bg-primary sm:w-auto">
            下一屏
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </footer>
    </main>
  )
}
