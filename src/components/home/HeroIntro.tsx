import { Flame, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BUILD_VERSION } from "@/version"

interface HeroIntroProps {
  loading: boolean
  streak: number
  onContinue: () => void
  onDebug: () => void
}

export function HeroIntro({ loading, streak, onContinue, onDebug }: HeroIntroProps) {
  return (
    <section className="relative overflow-hidden py-10 sm:py-16">
      {/* 装饰光斑：明快彩色基调 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-24 h-56 w-56 rounded-full bg-secondary blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-5 animate-in fade-in slide-in-from-bottom-4 duration-500 sm:px-6">
        <p className="font-mono text-xs tracking-widest text-primary sm:text-sm">
          严肃学习游戏 · 单机可玩 · 中文车间语境 ·{" "}
          <button
            type="button"
            onClick={onDebug}
            title="打开诊断面板"
            className="rounded px-1 text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-primary focus-visible:shadow-[var(--focus-ring)]"
          >
            v{BUILD_VERSION}
          </button>
        </p>
        <h1 className="mt-4 text-3xl font-bold leading-tight text-foreground sm:text-4xl lg:text-5xl">
          把一家 20 人小五金厂的
          <span className="text-primary"> MES 上线</span>，
          <br />
          从进厂第一天开始操盘。
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground">
          你是刚入职的实施顾问。不懂工厂没关系——每一次决策都会看到真实车间后果，
          每一道错题都配「现实工厂会怎样 / 系统数据会怎样 / 顾问该怎么做」三句话解释。
          六章闯关走完，你能用人话向面试官讲清工单从下达到入库的完整链路。
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Button
            size="lg"
            disabled={loading}
            onClick={onContinue}
            className="rounded-lg bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 hover:shadow-lg focus-visible:shadow-[var(--focus-ring)]"
          >
            <Play className="mr-2 h-4 w-4" />
            {loading ? "读取存档中…" : "继续上次进度"}
          </Button>
          {streak > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-4 py-1.5 text-sm font-bold text-destructive">
              <Flame className="h-4 w-4" />
              连续学习 {streak} 天
            </span>
          )}
          <p className="text-sm text-muted-foreground">三章可玩：调研认知 · 脏数据清洗 · 建模配置</p>
        </div>
      </div>
    </section>
  )
}
