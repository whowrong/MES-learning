import { Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CATEGORY_LABELS, type InterviewCategory, type PaperSizeId, type TierId } from "@/content/interview"
import type { useInterview } from "@/pages/Interview/useInterview"

type ComposeView = NonNullable<ReturnType<typeof useInterview>["composeView"]>

interface ComposePanelProps {
  composeView: ComposeView
  tier: TierId
  onTier: (t: TierId) => void
  categories: Record<InterviewCategory, boolean>
  onToggleCategory: (c: InterviewCategory) => void
  paperSize: PaperSizeId
  onPaperSize: (s: PaperSizeId) => void
  onStart: () => void
}

/** 组卷面板：难度档 × 分类 × 题量，三步定一张模拟面试卷 */
export function ComposePanel({
  composeView,
  tier,
  onTier,
  categories,
  onToggleCategory,
  paperSize,
  onPaperSize,
  onStart,
}: ComposePanelProps) {
  return (
    <section className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <header className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Video className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">面试训练营</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          按「难度档 × 分类」组一张模拟面试卷：面试官口吻的真实场景题，
          每题附参考答案和加分点，答完出得分和锐评。
        </p>
        {composeView.practiced > 0 && (
          <Badge variant="outline" className="mt-3 rounded-full text-muted-foreground">
            已完成 {composeView.practiced} 次模拟面试
          </Badge>
        )}
      </header>

      {/* 难度档 */}
      <div>
        <h2 className="text-lg font-bold text-foreground">选择难度档</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {composeView.tierViews.map((t) => {
            const active = t.tier === tier
            return (
              <button
                key={t.tier}
                type="button"
                onClick={() => onTier(t.tier)}
                className={`rounded-2xl border-2 p-4 text-left transition-all focus-visible:shadow-[var(--focus-ring)] ${
                  active
                    ? "border-primary bg-primary/10 shadow-md"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className="text-base font-bold text-foreground">{t.tierName}</span>
                  <Badge variant="outline" className="rounded-full text-xs font-normal text-muted-foreground">
                    {t.total} 题
                  </Badge>
                </span>
                <span className="mt-2 block text-xs leading-5 text-muted-foreground">{t.tierHint}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 分类 */}
      <div>
        <h2 className="text-lg font-bold text-foreground">题目分类</h2>
        <p className="mt-1 text-xs text-muted-foreground">至少保留一个分类；当前档位共 {composeView.candidateCount} 道候选题</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {composeView.categoryViews.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onToggleCategory(c.id)}
              disabled={c.count === 0}
              className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-40 ${
                categories[c.id] && c.count > 0
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {CATEGORY_LABELS[c.id]}（{c.count}）
            </button>
          ))}
        </div>
      </div>

      {/* 题量 */}
      <div>
        <h2 className="text-lg font-bold text-foreground">每卷题量</h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {composeView.sizeViews.map((s) => {
            const active = s.id === paperSize
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onPaperSize(s.id)}
                className={`rounded-2xl border-2 px-3 py-3 text-center transition-all focus-visible:shadow-[var(--focus-ring)] ${
                  active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <span className="block text-sm font-bold text-foreground">{s.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {s.count > 0 ? `${s.count} 题` : "不限"}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="pb-8 text-center">
        <Button
          size="lg"
          onClick={onStart}
          disabled={composeView.candidateCount === 0}
          className="w-full bg-primary text-primary-foreground sm:w-auto sm:px-12"
        >
          开始模拟面试（{composeView.willTake} 题）
        </Button>
      </div>
    </section>
  )
}
