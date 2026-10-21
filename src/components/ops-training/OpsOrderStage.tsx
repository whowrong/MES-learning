import { ArrowUp, ArrowDown, CheckCircle2, XCircle, FileCheck2 } from "lucide-react"

export interface OpsOrderView {
  title: string
  intro: string
  rows: Array<{
    id: string
    index: number
    text: string
    note: string
    inPlace: boolean
    canUp: boolean
    canDown: boolean
  }>
  attemptsUsed: number
  maxAttempts: number
  judged: boolean
  solved: boolean
  wrongFlash: boolean
  canSubmit: boolean
}

/** 处置流程排序：上下移调整顺序，提交判定，错位展示每步的定位理由 */
export function OpsOrderStage({
  view,
  onMove,
  onSubmit,
  onFinish,
  onDismissFlash,
}: {
  view: OpsOrderView
  onMove: (index: number, dir: -1 | 1) => void
  onSubmit: () => void
  onFinish: () => void
  onDismissFlash: () => void
}) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-3">
        <h2 className="text-base font-bold text-foreground">{view.title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{view.intro}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          提交机会 {view.maxAttempts} 次，已用 {view.attemptsUsed} 次
          {view.attemptsUsed >= view.maxAttempts && !view.judged && "（用完后自动展示正解）"}
        </p>
      </div>

      {view.wrongFlash && !view.judged && (
        <div
          className="mb-3 flex items-center gap-3 rounded-xl bg-destructive/10 px-4 py-2.5 text-xs text-destructive"
          role="alert"
        >
          <XCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            顺序不对。第 {view.attemptsUsed} 次机会已用
            {view.attemptsUsed < view.maxAttempts ? `，还剩 ${view.maxAttempts - view.attemptsUsed} 次，调整后再提交。` : "。"}
          </span>
          <button type="button" onClick={onDismissFlash} className="shrink-0 underline-offset-2 hover:underline">
            知道了
          </button>
        </div>
      )}

      <ol className="flex flex-col gap-2">
        {view.rows.map((row) => (
          <li
            key={row.id}
            className={
              "flex items-start gap-3 rounded-xl border bg-card px-3.5 py-2.5 shadow-sm " +
              (view.judged ? (row.inPlace ? "border-primary/60" : "border-destructive/60") : "border-border")
            }
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[10px] font-bold text-primary tabular-nums">
              {row.index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-relaxed text-foreground">{row.text}</p>
              {view.judged && !row.inPlace && (
                <p className="mt-1.5 rounded-lg bg-muted/70 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  {row.note}
                </p>
              )}
            </div>
            {view.judged ? (
              row.inPlace ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              )
            ) : (
              <span className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => onMove(row.index, -1)}
                  disabled={!row.canUp}
                  aria-label="上移"
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 focus-visible:shadow-[var(--focus-ring)]"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(row.index, 1)}
                  disabled={!row.canDown}
                  aria-label="下移"
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 focus-visible:shadow-[var(--focus-ring)]"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-4 flex justify-end gap-2">
        {!view.judged ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={!view.canSubmit}
            className="rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40 focus-visible:shadow-[var(--focus-ring)]"
          >
            提交顺序
          </button>
        ) : (
          <button
            type="button"
            onClick={onFinish}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground focus-visible:shadow-[var(--focus-ring)]"
          >
            <FileCheck2 className="h-4 w-4" />
            {view.solved ? "完成，出演练报告" : "查看正解与报告"}
          </button>
        )}
      </div>
    </section>
  )
}
