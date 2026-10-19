import { CheckCircle2, XCircle, Eye, ArrowRight, Flag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CATEGORY_LABELS, TYPE_LABELS } from "@/content/interview"
import type { TermDef } from "@/content/loader"
import type { useInterview } from "@/pages/Interview/useInterview"

type QuestionView = NonNullable<ReturnType<typeof useInterview>["questionView"]>

interface QuestionCardProps {
  view: QuestionView
  terms: Record<string, TermDef>
  shortRatings: ReturnType<typeof useInterview>["shortRatings"]
  onPick: (optionId: string) => void
  onSubmit: () => void
  onReveal: () => void
  onRate: (ratingId: string) => void
  onNext: () => void
  onOpenTerm: (termId: string) => void
}

/** 答题卡：一次一题，客观题提交即判定，简答题看参考答案后四档自评 */
export function QuestionCard({
  view,
  terms,
  shortRatings,
  onPick,
  onSubmit,
  onReveal,
  onRate,
  onNext,
  onOpenTerm,
}: QuestionCardProps) {
  const q = view.question
  return (
    <section className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      {/* 进度与标签 */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="rounded-full bg-primary text-primary-foreground">
          第 {view.index + 1}/{view.total} 题
        </Badge>
        <Badge variant="outline" className="rounded-full text-muted-foreground">
          {view.tierName}
        </Badge>
        <Badge variant="outline" className="rounded-full text-muted-foreground">
          {TYPE_LABELS[q.type]}
        </Badge>
        <Badge variant="outline" className="rounded-full text-muted-foreground">
          {CATEGORY_LABELS[q.category]}
        </Badge>
        {q.type === "multiple" && (
          <span className="text-xs text-muted-foreground">多选：多选少选都算错</span>
        )}
      </div>

      {/* 题干 */}
      <div className="rounded-2xl bg-card p-5 shadow-md sm:p-6">
        <p className="text-base font-medium leading-7 text-foreground sm:text-lg">{q.prompt}</p>
      </div>

      {/* 客观题选项 */}
      {!view.isShort && (
        <div className="space-y-3">
          {view.options.map((o) => {
            const picked = view.selected.includes(o.id)
            const showState = view.judged
            const isRight = showState && q.answer && (Array.isArray(q.answer) ? q.answer.includes(o.id) : q.answer === o.id)
            const isWrongPick = showState && picked && !isRight
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onPick(o.id)}
                disabled={view.judged}
                className={`w-full rounded-2xl border-2 p-4 text-left text-sm leading-6 transition-all focus-visible:shadow-[var(--focus-ring)] disabled:cursor-default ${
                  isRight
                    ? "border-primary bg-primary/10 text-foreground"
                    : isWrongPick
                      ? "border-destructive bg-destructive/10 text-foreground line-through decoration-destructive"
                      : picked
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-card text-foreground hover:border-primary/40"
                }`}
              >
                <span className="flex items-start gap-3">
                  {isRight && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
                  {isWrongPick && <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />}
                  <span>{o.text}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* 判定横幅 */}
      {view.judged && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${
            view.judgedCorrect ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
          }`}
        >
          {view.judgedCorrect ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          {view.judgedCorrect ? "回答正确，面试官点了点头" : "这题没答对，看看参考答案"}
        </div>
      )}

      {/* 简答题：看参考答案 + 四档自评 */}
      {view.isShort && !view.revealed && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">先自己在心里（或出声）把答案讲一遍，再对照参考答案自评。</p>
          <Button size="lg" onClick={onReveal} className="mt-4 w-full bg-primary text-primary-foreground sm:w-auto sm:px-10">
            <Eye className="mr-2 h-5 w-5" />
            看参考答案
          </Button>
        </div>
      )}

      {/* 参考答案 + 加分点（判定后 / 简答揭晓后展示） */}
      {(view.judged || (view.isShort && view.revealed)) && (
        <div className="space-y-4 rounded-2xl border-2 border-border bg-secondary/40 p-5">
          <div>
            <h3 className="text-sm font-bold text-foreground">参考答案</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">{q.reference}</p>
          </div>
          {q.bonus_points.length > 0 && (
            <div>
              <h3 className="flex items-center gap-1 text-sm font-bold text-foreground">
                <Flag className="h-4 w-4 text-primary" />
                加分点
              </h3>
              <ul className="mt-2 space-y-1.5">
                {q.bonus_points.map((bp, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {bp}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {q.source_hint && <p className="text-xs text-muted-foreground/70">出题背景：{q.source_hint}</p>}
          {q.term_ids.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">关联术语卡：</span>
              {q.term_ids.map((tid) =>
                terms[tid] ? (
                  <button
                    key={tid}
                    type="button"
                    onClick={() => onOpenTerm(tid)}
                    className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary focus-visible:shadow-[var(--focus-ring)]"
                  >
                    {terms[tid].term}
                  </button>
                ) : null,
              )}
            </div>
          )}
        </div>
      )}

      {/* 简答自评四档 */}
      {view.isShort && view.revealed && (
        <div>
          <h3 className="text-sm font-bold text-foreground">对照参考答案，你刚才答得怎么样？</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {shortRatings.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onRate(r.id)}
                className="rounded-2xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary focus-visible:shadow-[var(--focus-ring)]"
              >
                <span className="block text-sm font-bold text-foreground">{r.label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{r.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 底部动作 */}
      <div className="pb-10 text-center">
        {!view.isShort && !view.judged && (
          <Button size="lg" onClick={onSubmit} disabled={!view.canSubmit} className="w-full bg-primary text-primary-foreground sm:w-auto sm:px-12">
            提交答案
          </Button>
        )}
        {!view.isShort && view.judged && (
          <Button size="lg" onClick={onNext} className="w-full bg-primary text-primary-foreground sm:w-auto sm:px-12">
            {view.isLast ? "查看面试成绩" : "下一题"}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        )}
      </div>
    </section>
  )
}
