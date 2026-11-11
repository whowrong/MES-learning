import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/home/SiteHeader"
import { HeroIntro } from "@/components/home/HeroIntro"
import { GaugesPanel } from "@/components/home/GaugesPanel"
import { ChapterMap } from "@/components/home/ChapterMap"
import { ModuleEntries } from "@/components/home/ModuleEntries"
import { HomeDialogs } from "@/components/home/HomeDialogs"
import { ProjectLifecycle } from "@/components/illustrations"
import { SiteFeedback } from "@/components/home/SiteFeedback"
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
          opsCount={p.opsCount}
          dbCount={p.dbCount}
          careerCount={p.careerCount}
          deliveryCount={p.deliveryCount}
          sandboxUnlocked={p.sandboxUnlocked}
          onGlossary={p.openGlossary}
          onInterview={p.openInterview}
          onFactoryTypes={p.openFactoryTypes}
          onOpsTraining={p.openOpsTraining}
          onDbTraining={p.openDbTraining}
          onCareerPrep={p.openCareerPrep}
          onDelivery={p.openDelivery}
          onSandbox={p.openSandbox}
        />
      </main>
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground sm:px-6">
          剧情关卡、术语卡和讲解图持续更新，让车间问题更容易学会、记住。
          <SiteFeedback />
        </div>
      </footer>
      <HomeDialogs
        lockedChapter={p.lockedChapter}
        notice={p.notice}
        onClose={p.closeDialogs}
      />
    </div>
  )
}
