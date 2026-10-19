import { Hammer, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BUILD_VERSION } from "@/version"
import type { LevelPhase } from "@/pages/Level/useLevel"

interface LevelHeaderProps {
  chapterTitle: string
  scene: string
  phase: LevelPhase
  /** 本关实际包含的玩法关（按内容文件动态生成进度点） */
  stages: Array<"match" | "judge" | "quiz" | "fill" | "sort">
  onGoHome: () => void
}

const STAGE_LABELS: Record<"match" | "judge" | "quiz" | "fill" | "sort", string> = {
  match: "黑话连连看",
  judge: "真假鉴定",
  quiz: "场景抉择",
  fill: "限时填空",
  sort: "流程排序",
}

/** 关卡页顶栏：回首页 + 章节名 + 阶段进度点 */
export function LevelHeader({ chapterTitle, scene, phase, stages, onGoHome }: LevelHeaderProps) {
  const phaseSteps: Array<{ key: LevelPhase; label: string }> = [
    { key: "story", label: "剧情" },
    ...stages.map((s) => ({ key: s as LevelPhase, label: STAGE_LABELS[s] })),
    { key: "result", label: "结算" },
  ]
  const activeIdx = phaseSteps.findIndex((s) => s.key === phase)
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onGoHome}
          className="shrink-0 rounded-full focus-visible:shadow-[var(--focus-ring)]"
        >
          <Home className="mr-1 h-4 w-4" />
          章节地图
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Hammer className="h-3.5 w-3.5" />
          </span>
          <span className="truncate text-sm font-bold text-foreground">{chapterTitle}</span>
          <span className="hidden shrink-0 font-mono text-xs text-primary sm:block">{scene}</span>
          <span className="hidden shrink-0 font-mono text-xs text-muted-foreground md:block">v{BUILD_VERSION}</span>
        </div>
        {/* 手机：紧凑进度指示；桌面：完整阶段 pills */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5" aria-hidden>
          <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary md:hidden">
            {activeIdx >= 0 ? activeIdx + 1 : phaseSteps.length}/{phaseSteps.length} · {phaseSteps[activeIdx]?.label ?? "结算"}
          </span>
          <span className="hidden items-center gap-1.5 md:flex">
            {phaseSteps.map((s, i) => (
              <span key={s.key} className="flex items-center gap-1.5">
                {i > 0 && <span className={`h-px w-3 ${i <= activeIdx ? "bg-primary" : "bg-border"}`} />}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    i === activeIdx
                      ? "bg-primary font-medium text-primary-foreground"
                      : i < activeIdx
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </span>
            ))}
          </span>
        </div>
      </div>
    </header>
  )
}
