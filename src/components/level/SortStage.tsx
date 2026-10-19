import { ArrowDown, ArrowUp, CheckCircle2, Lightbulb, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { SortStageDef } from "@/content/loader"

export interface SortStepView {
  stepId: string
  text: string
  note: string
  position: number
  /** null=未判定 true=位置正确 false=错位 */
  verdictCorrect: boolean | null
  expectedStepId: string
}

interface SortStageProps {
  stage: SortStageDef
  stepViews: SortStepView[]
  attempts: number
  maxAttempts: number
  revealed: boolean
  wrongCount: number
  submitted: boolean
  saving: boolean
  onMove: (index: number, dir: -1 | 1) => void
  onSubmit: () => void
  onFinish: () => void
}

/** 流程排序舞台：接单到入库 7 步，上下移 + 拖拽排序，最多两次判定机会 */
export function SortStage({
  stage,
  stepViews,
  attempts,
  maxAttempts,
  revealed,
  wrongCount,
  submitted,
  saving,
  onMove,
  onSubmit,
  onFinish,
}: SortStageProps) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="rounded-2xl bg-card p-5 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-xl font-bold text-foreground">{stage.title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{stage.intro}</p>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="rounded-full font-normal">
            已用 {attempts} / {maxAttempts} 次判定机会
          </Badge>
          {revealed && <Badge className="rounded-full bg-primary text-primary-foreground">已揭晓正解</Badge>}
        </div>
      </div>

      <ol className="mt-5 space-y-2.5">
        {stepViews.map((sv) => {
          const ring =
            sv.verdictCorrect === null
              ? "border-border"
              : sv.verdictCorrect
                ? "border-primary bg-primary/5"
                : "border-destructive bg-destructive/5"
          return (
            <li
              key={sv.stepId}
              draggable={!revealed}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const from = Number(e.dataTransfer.getData("text/step-index"))
                if (!Number.isNaN(from) && from !== sv.position) {
                  // 拖拽落位 = 逐格移动到位（保持纯函数移动语义，不引入新状态）
                  const dir = from < sv.position ? 1 : -1
                  for (let i = from; i !== sv.position; i += dir) onMove(i, dir as -1 | 1)
                }
              }}
              onDragStart={(e) => e.dataTransfer.setData("text/step-index", String(sv.position))}
              className={`rounded-2xl border-2 bg-card p-4 transition-colors duration-200 animate-in fade-in duration-300 ${ring}`}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs font-bold text-secondary-foreground">
                  {sv.position + 1}
                </span>
                <p className="flex-1 text-sm leading-6 text-foreground">{sv.text}</p>
                {!revealed && (
                  <span className="flex shrink-0 flex-col gap-1.5">
                    <button
                      type="button"
                      aria-label="上移"
                      onClick={() => onMove(sv.position, -1)}
                      disabled={sv.position === 0}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground disabled:opacity-30 focus-visible:shadow-[var(--focus-ring)]"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="下移"
                      onClick={() => onMove(sv.position, 1)}
                      disabled={sv.position === stepViews.length - 1}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground disabled:opacity-30 focus-visible:shadow-[var(--focus-ring)]"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </span>
                )}
                {sv.verdictCorrect !== null && (
                  <span className="mt-0.5 shrink-0">
                    {sv.verdictCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" aria-label="位置正确" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" aria-label="错位" />
                    )}
                  </span>
                )}
              </div>
              {sv.verdictCorrect === false && (
                <p className="mt-2 flex gap-2 rounded-xl bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>
                    <span className="font-medium text-foreground">这一步为什么在这里：</span>
                    {stepViews.find((x) => x.stepId === sv.expectedStepId)?.note || sv.note}
                  </span>
                </p>
              )}
              {revealed && sv.verdictCorrect && (
                <p className="mt-2 pl-10 text-xs leading-5 text-muted-foreground">{sv.note}</p>
              )}
            </li>
          )
        })}
      </ol>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-md">
        {revealed ? (
          <>
            <p className="text-sm font-medium text-foreground">
              {wrongCount === 0 ? "全对，流程已经刻进脑子了。" : `本次 ${wrongCount} 步错位，正解与讲解已展示。`}
            </p>
            <Button
              onClick={onFinish}
              disabled={saving}
              className="w-full rounded-full bg-primary text-primary-foreground hover:scale-105 focus-visible:shadow-[var(--focus-ring)] sm:w-auto"
            >
              {saving ? "结算中…" : "完成本章 · 查看结算"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {submitted && wrongCount > 0
                ? "还有错位：看看红色步骤的讲解，调整后再提交"
                : "按「接单 → 入库」的真实顺序排好 7 步"}
            </p>
            <Button
              onClick={onSubmit}
              disabled={attempts >= maxAttempts}
              className="w-full rounded-full bg-primary text-primary-foreground hover:scale-105 focus-visible:shadow-[var(--focus-ring)] sm:w-auto"
            >
              提交判定（还剩 {maxAttempts - attempts} 次）
            </Button>
          </>
        )}
      </div>
    </section>
  )
}
