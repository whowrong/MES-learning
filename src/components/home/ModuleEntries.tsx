import { BookOpen, Factory, FlaskConical, Video, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SpotlightCard } from "@/components/bits/SpotlightCard"

interface ModuleEntriesProps {
  reviewCount: number
  interviewCount: number
  factoryCount: number
  onGlossary: () => void
  onInterview: () => void
  onFactoryTypes: () => void
  onSandbox: () => void
}

const CARD_ENTER =
  "animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"

export function ModuleEntries({ reviewCount, interviewCount, factoryCount, onGlossary, onInterview, onFactoryTypes, onSandbox }: ModuleEntriesProps) {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">常驻模块</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <SpotlightCard
            className={`group h-full rounded-2xl bg-card shadow-md ${CARD_ENTER}`}
          >
            <button
              type="button"
              onClick={onGlossary}
              style={{ animationDelay: "0ms" }}
              className="relative flex h-full w-full items-start gap-4 p-6 text-left focus-visible:shadow-[var(--focus-ring)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground transition-transform duration-300 group-hover:scale-110">
                <BookOpen className="h-6 w-6" />
              </span>
              <span className="flex h-full flex-col">
                <span className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">术语卡库</span>
                  {reviewCount > 0 && (
                    <Badge className="rounded-full bg-destructive text-destructive-foreground">
                      {reviewCount} 张待复习
                    </Badge>
                  )}
                </span>
                <span className="mt-1 text-sm leading-6 text-muted-foreground">
                  工单、BOM、倒冲扣料……每个概念一张卡，配车间大白话解释。
                  标记「不熟」的卡会按间隔重复回到复习队列，像背单词一样把它们焊进脑子。
                </span>
                <span className="mt-auto inline-flex items-center pt-3 text-sm font-medium text-primary">
                  进入卡库
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </span>
            </button>
          </SpotlightCard>
          <SpotlightCard
            className={`group h-full rounded-2xl bg-card shadow-md [animation-delay:80ms] ${CARD_ENTER}`}
          >
            <button
              type="button"
              onClick={onInterview}
              className="relative flex h-full w-full items-start gap-4 p-6 text-left focus-visible:shadow-[var(--focus-ring)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform duration-300 group-hover:scale-110">
                <Video className="h-6 w-6" />
              </span>
              <span className="flex h-full flex-col">
                <span className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">面试训练营</span>
                  {interviewCount > 0 && (
                    <Badge variant="outline" className="rounded-full text-muted-foreground">
                      已练 {interviewCount} 场
                    </Badge>
                  )}
                </span>
                <span className="mt-1 text-sm leading-6 text-muted-foreground">
                  实习到校招再到社招六档难度，面试官口吻的真实场景题：单选、多选、判断、简答自评。
                  每题附参考答案和加分点，答完出得分和面试官锐评，错题自动进复习队列。
                </span>
                <span className="mt-auto inline-flex items-center pt-3 text-sm font-medium text-primary">
                  进入训练营
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </span>
            </button>
          </SpotlightCard>
          <SpotlightCard
            className={`group h-full rounded-2xl bg-card shadow-md [animation-delay:160ms] ${CARD_ENTER}`}
          >
            <button
              type="button"
              onClick={onFactoryTypes}
              className="relative flex h-full w-full items-start gap-4 p-6 text-left focus-visible:shadow-[var(--focus-ring)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform duration-300 group-hover:scale-110">
                <Factory className="h-6 w-6" />
              </span>
              <span className="flex h-full flex-col">
                <span className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">厂型特训营</span>
                  {factoryCount > 0 && (
                    <Badge variant="outline" className="rounded-full text-muted-foreground">
                      已训 {factoryCount} 场
                    </Badge>
                  )}
                </span>
                <span className="mt-1 text-sm leading-6 text-muted-foreground">
                  离散、流水线、混合三种厂型，调研重点和建模方式完全不同。
                  先翻厂型档案学脾气，再打一场该厂型专属的场景实战测验。
                </span>
                <span className="mt-auto inline-flex items-center pt-3 text-sm font-medium text-primary">
                  进厂调研
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </span>
            </button>
          </SpotlightCard>
          <button
            type="button"
            onClick={onSandbox}
            style={{ animationDelay: "240ms" }}
            className="flex h-full items-start gap-4 rounded-2xl border-2 border-dashed border-border bg-card p-6 text-left opacity-80 shadow-md transition-all duration-300 hover:opacity-100 focus-visible:shadow-[var(--focus-ring)] animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <FlaskConical className="h-6 w-6" />
            </span>
            <span className="flex h-full flex-col">
              <span className="flex items-center gap-2">
                <span className="text-lg font-bold text-foreground">自由沙盘</span>
                <Badge variant="outline" className="rounded-full text-muted-foreground">
                  第三章通关后开放
                </Badge>
              </span>
              <span className="mt-1 text-sm leading-6 text-muted-foreground">
                不限流程的实验场：随便建工单、改库存、看物料方块在工序之间流动，
                亲手验证「BOM 错了整条线会怎样」。
              </span>
              <span className="mt-auto inline-flex items-center pt-3 text-sm font-medium text-muted-foreground">
                先用剧情关卡练基本功
              </span>
            </span>
          </button>
        </div>
      </div>
    </section>
  )
}
