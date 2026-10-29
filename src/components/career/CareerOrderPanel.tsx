import { ArrowLeft, CheckCircle2, ListOrdered, Undo2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface CareerOrderStepView {
  id: string
  text: string
  note: string
}

interface CareerOrderPanelProps {
  title: string
  intro: string
  steps: CareerOrderStepView[]
  picked: string[]
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  onSubmit: () => void
}

/** 顺序题：点击步骤按顺序排列，顺序全对才得分 */
export function CareerOrderPanel({ title, intro, steps, picked, onAdd, onRemove, onSubmit }: CareerOrderPanelProps) {
  const pickedSteps = picked.map((id) => steps.find((s) => s.id === id)).filter((s): s is CareerOrderStepView => !!s)
  const remaining = steps.filter((s) => !picked.includes(s.id))

  return (
    <section className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="rounded-full bg-primary text-primary-foreground">
          <ListOrdered className="mr-1 h-3.5 w-3.5" />
          顺序题
        </Badge>
        <Badge variant="outline" className="rounded-full text-muted-foreground">
          {picked.length}/{steps.length}
        </Badge>
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-md sm:p-6">
        <p className="text-base font-bold text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{intro}</p>
      </div>

      <div className="space-y-2">
        {pickedSteps.map((s, i) => (
          <div
            key={s.id}
            className="flex items-center gap-3 rounded-2xl border-2 border-primary bg-primary/5 p-4 text-sm"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {i + 1}
            </span>
            <span className="flex-1">
              <span className="block font-medium text-foreground">{s.text}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{s.note}</span>
            </span>
            <button
              type="button"
              onClick={() => onRemove(s.id)}
              className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:text-destructive focus-visible:shadow-[var(--focus-ring)]"
            >
              <Undo2 className="mr-1 inline h-3.5 w-3.5" />
              撤回
            </button>
          </div>
        ))}
      </div>

      {remaining.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">待排步骤（点击加入上面的顺序）</p>
          {remaining.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onAdd(s.id)}
              className="w-full rounded-2xl border-2 border-border bg-card p-4 text-left text-sm transition-all hover:border-primary/40 focus-visible:shadow-[var(--focus-ring)]"
            >
              <span className="block font-medium text-foreground">{s.text}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{s.note}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => {
            const last = picked[picked.length - 1]
            if (last) onRemove(last)
          }}
          disabled={picked.length === 0}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          撤回一步
        </Button>
        <Button
          onClick={onSubmit}
          disabled={picked.length !== steps.length}
          className="bg-primary text-primary-foreground"
        >
          <CheckCircle2 className="mr-2 h-5 w-5" />
          提交顺序
        </Button>
      </div>
    </section>
  )
}
