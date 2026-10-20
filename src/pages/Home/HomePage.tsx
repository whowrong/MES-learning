import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/home/SiteHeader"
import { HeroIntro } from "@/components/home/HeroIntro"
import { GaugesPanel } from "@/components/home/GaugesPanel"
import { ChapterMap } from "@/components/home/ChapterMap"
import { ModuleEntries } from "@/components/home/ModuleEntries"
import { HomeDialogs } from "@/components/home/HomeDialogs"
import { ProjectLifecycle } from "@/components/illustrations"
import type { useHome } from "./useHome"

export function HomePage(p: ReturnType<typeof useHome>) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/40 to-card">
      <SiteHeader
        reviewCount={p.reviewCount}
        onGlossary={p.openGlossary}
        onSandbox={p.openSandbox}
      />
      <main>
        <HeroIntro loading={p.loading} streak={p.streak} onContinue={p.continueProgress} onDebug={p.openDebug} />

        {p.loadError && (
          <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{p.loadError}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void p.retryLoad()}
              className="focus-visible:shadow-[var(--focus-ring)]"
            >
              重试
            </Button>
          </div>
        )}

        <GaugesPanel gaugeViews={p.gaugeViews} />
        <ProjectLifecycle />
        <ChapterMap
          chapters={p.chapters}
          chapterState={p.chapterState}
          onOpen={p.openChapter}
        />
        <ModuleEntries
          reviewCount={p.reviewCount}
          interviewCount={p.interviewCount}
          factoryCount={p.factoryCount}
          onGlossary={p.openGlossary}
          onInterview={p.openInterview}
          onFactoryTypes={p.openFactoryTypes}
          onSandbox={p.openSandbox}
        />
      </main>
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
          四章剧情关卡可玩 · 关卡、术语、讲解图与决策后果均由内容文件驱动，照着示例就能加新关卡
        </div>
      </footer>
      <HomeDialogs
        lockedChapter={p.lockedChapter}
        constructionNote={p.constructionNote}
        onClose={p.closeDialogs}
      />
    </div>
  )
}
