import { BookOpen, FlaskConical, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface ModuleEntriesProps {
  reviewCount: number
  onGlossary: () => void
  onSandbox: () => void
}

export function ModuleEntries({ reviewCount, onGlossary, onSandbox }: ModuleEntriesProps) {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-2xl font-bold text-foreground">常驻模块</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <button
            type="button"
            onClick={onGlossary}
            className="flex items-start gap-4 rounded-2xl bg-card p-6 text-left shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:shadow-[var(--focus-ring)] animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
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
                <ArrowRight className="ml-1 h-4 w-4" />
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={onSandbox}
            className="flex items-start gap-4 rounded-2xl border-2 border-dashed border-border bg-card p-6 text-left opacity-80 shadow-md transition-all duration-300 hover:opacity-100 focus-visible:shadow-[var(--focus-ring)] animate-in fade-in slide-in-from-bottom-4 duration-500"
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
