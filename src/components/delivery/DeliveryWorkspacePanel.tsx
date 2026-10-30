import { AlertCircle, CheckCircle2, ClipboardCheck, Save, Sparkles, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { DeliveryDeliverableDef } from "@/content/delivery"
import type { DeliveryCheck } from "@/game/delivery"
import type { AiState } from "@/pages/Delivery/useDelivery"

interface DeliveryWorkspacePanelProps {
  intro: string
  notice: string
  deliverables: DeliveryDeliverableDef[]
  drafts: Record<string, string>
  checks: DeliveryCheck[]
  activeId: string
  ratio: number
  aiState: AiState
  aiModel: string
  aiReview: string
  aiReviewing: boolean
  aiError: string
  saved: boolean
  onSelect: (id: string) => void
  onChange: (id: string, text: string) => void
  onSave: () => void
  onAiReview: () => void
  onStartQuiz: () => void
}

/** 交付物工作区：写稿 + 结构校验 + AI 评审 */
export function DeliveryWorkspacePanel(props: DeliveryWorkspacePanelProps) {
  const {
    intro,
    notice,
    deliverables,
    drafts,
    checks,
    activeId,
    ratio,
    aiState,
    aiModel,
    aiReview,
    aiReviewing,
    aiError,
    saved,
    onSelect,
    onChange,
    onSave,
    onAiReview,
    onStartQuiz,
  } = props

  const active = deliverables.find((d) => d.id === activeId) ?? deliverables[0]
  const check = checks.find((c) => c.id === active?.id) ?? null
  const draft = active ? drafts[active.id] ?? "" : ""
  const doneCount = checks.filter((c) => c.complete).length

  return (
    <section className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <div className="rounded-2xl bg-card p-5 shadow-md">
        <p className="text-sm leading-6 text-muted-foreground">{intro}</p>
        <p className="mt-2 text-xs text-muted-foreground/80">{notice}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {deliverables.map((d) => {
          const c = checks.find((x) => x.id === d.id)
          const on = d.id === active?.id
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelect(d.id)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:shadow-[var(--focus-ring)] ${
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {d.title}
              {c ? (
                <span className="ml-1.5 font-mono">
                  {c.passed}/{c.total}
                </span>
              ) : null}
            </button>
          )
        })}
        <Badge variant="outline" className="rounded-full text-muted-foreground">
          写完 {doneCount}/{deliverables.length}
        </Badge>
        <Badge variant="outline" className="rounded-full text-muted-foreground">
          整体齐全度 {Math.round(ratio * 100)}%
        </Badge>
      </div>

      {active && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-card p-5 shadow-md">
            <p className="text-base font-bold text-foreground">{active.title}</p>
            <dl className="mt-3 space-y-2 text-sm leading-6">
              <div className="flex gap-2">
                <dt className="shrink-0 font-medium text-foreground">读者</dt>
                <dd className="text-muted-foreground">{active.audience}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 font-medium text-foreground">要回答</dt>
                <dd className="text-muted-foreground">{active.purpose}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 font-medium text-foreground">建议结构</dt>
                <dd className="text-muted-foreground">{active.template}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl bg-card p-5 shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">初稿</p>
              <span className="font-mono text-xs text-muted-foreground">
                {check ? `${check.chars} 字 / 门槛 ${check.minChars} 字` : ""}
              </span>
            </div>
            <textarea
              value={draft}
              onChange={(e) => onChange(active.id, e.target.value)}
              placeholder="按上面的建议结构写。这只是练习稿，不涉及任何真实客户数据。"
              className="mt-3 min-h-[240px] w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-6 text-foreground outline-none focus-visible:shadow-[var(--focus-ring)]"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={onSave}>
                <Save className="mr-2 h-4 w-4" />
                保存草稿
              </Button>
              {saved && <span className="text-xs text-primary">草稿已存进你的存档</span>}
            </div>
          </div>

          {check && (
            <div className="rounded-2xl bg-card p-5 shadow-md">
              <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                结构校验（{check.passed}/{check.total} 项要素齐全）
              </p>
              {!check.enough && (
                <p className="mt-2 flex items-center gap-2 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  字数不足 {check.minChars} 字，还差 {check.minChars - check.chars} 字。
                </p>
              )}
              <ul className="mt-3 space-y-2">
                {check.elements.map((el) => (
                  <li key={el.id} className="flex items-start gap-2 text-sm leading-6">
                    {el.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    )}
                    <span>
                      <span className={el.ok ? "text-foreground" : "text-foreground"}>{el.label}</span>
                      {!el.ok && <span className="ml-2 text-xs text-muted-foreground">{el.hint}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl bg-card p-5 shadow-md">
            <p className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Sparkles className="h-5 w-5 text-primary" />
              AI 交付物评审
            </p>
            {aiState === "ready" && (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                服务端模型：<span className="font-mono">{aiModel}</span>
                。评审结果由模型生成，只作练习参考，不写进存档。
              </p>
            )}
            {aiState === "loading" && <p className="mt-2 text-xs text-muted-foreground">正在确认服务端可用模型……</p>}
            {aiState === "empty" && (
              <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                服务端还没有启用任何模型，AI 评审不可用。需要在目标机上配置 MES_LLM_MODELS 与密钥后重启 PocketBase。
              </p>
            )}
            {aiState === "error" && (
              <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                连不上服务端模型接口，AI 评审暂不可用。
              </p>
            )}
            <div className="mt-3">
              <Button onClick={onAiReview} disabled={aiReviewing || aiState !== "ready"} className="bg-primary text-primary-foreground">
                {aiReviewing ? "AI 评审中……" : "让 AI 评这一稿"}
              </Button>
            </div>
            {aiError && <p className="mt-2 text-xs text-destructive">{aiError}</p>}
            {aiReview && (
              <div className="mt-3 whitespace-pre-wrap rounded-xl bg-secondary/40 p-4 text-sm leading-7 text-foreground">
                {aiReview}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <Button onClick={onStartQuiz} className="bg-primary text-primary-foreground">
          开始实战测验
        </Button>
      </div>
    </section>
  )
}
