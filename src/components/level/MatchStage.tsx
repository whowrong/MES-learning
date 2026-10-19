import { useState } from "react"
import { CheckCircle2, GripVertical, Info, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/useIsMobile"
import type { MatchStageDef, TermDef } from "@/content/loader"
import type { MatchResult } from "@/game/judge"

interface MatchStageProps {
  stage: MatchStageDef
  terms: Record<string, TermDef>
  answers: Record<string, string>
  selectedQuote: string | null
  results: MatchResult[] | null
  matchCorrect: number
  allPlaced: boolean
  /** 下一关按钮文案（由页面按实际存在的下一关传入） */
  nextStageLabel: string
  onSelectQuote: (quoteId: string) => void
  onAssignConcept: (conceptId: string, quoteId?: string) => void
  onClearQuote: (quoteId: string) => void
  onSubmit: () => void
  onOpenFeedback: (quoteId: string) => void
  onOpenTerm: (termId: string) => void
  onNextStage: () => void
}

/** 连连看舞台：方言引语 → MES 概念（拖拽 + 点选双通道），判定后逐条亮对照 */
export function MatchStage({
  stage,
  terms,
  answers,
  selectedQuote,
  results,
  matchCorrect,
  allPlaced,
  nextStageLabel,
  onSelectQuote,
  onAssignConcept,
  onClearQuote,
  onSubmit,
  onOpenFeedback,
  onOpenTerm,
  onNextStage,
}: MatchStageProps) {
  const submitted = results !== null
  const isMobile = useIsMobile()
  // 拖拽兜底：个别浏览器 drop 时读不到自定义 MIME，用本地 state 记住拖的是哪条
  const [dragQuoteId, setDragQuoteId] = useState<string | null>(null)
  const verdictOf = (quoteId: string): MatchResult | null =>
    results?.find((r) => r.quoteId === quoteId) ?? null
  // 玩法提示只挂在第一条未配对的引语上，避免每张卡都重复一遍
  const firstUnassignedId = submitted ? "" : stage.quotes.find((q) => !answers[q.id])?.id ?? ""

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="rounded-2xl bg-card p-5 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-xl font-bold text-foreground">{stage.title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{stage.intro}</p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr,18rem]">
        {/* 引语卡列表 */}
        <div className="space-y-2.5">
          {stage.quotes.map((q, idx) => {
            const assigned = answers[q.id] ?? ""
            const verdict = verdictOf(q.id)
            const isSelected = selectedQuote === q.id
            const stateRing = verdict
              ? verdict.correct
                ? "border-primary bg-primary/5"
                : "border-destructive bg-destructive/5"
              : isSelected
                ? "border-primary shadow-md"
                : "border-border hover:border-primary/50"
            return (
              <div
                key={q.id}
                role="button"
                tabIndex={0}
                draggable={!submitted}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", q.id)
                  setDragQuoteId(q.id)
                  onSelectQuote(q.id)
                }}
                onDragEnd={() => setDragQuoteId(null)}
                onClick={() => !submitted && onSelectQuote(q.id)}
                onKeyDown={(e) => {
                  if (!submitted && (e.key === "Enter" || e.key === " ")) onSelectQuote(q.id)
                }}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 bg-card p-4 transition-all duration-200 focus-visible:shadow-[var(--focus-ring)] animate-in fade-in duration-300 ${stateRing}`}
              >
                <GripVertical className="mt-1 hidden h-4 w-4 shrink-0 text-muted-foreground lg:block" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-6 text-foreground">
                    <span className="mr-1 font-mono text-xs text-muted-foreground">{idx + 1}.</span>
                    {q.text}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {assigned ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!submitted) onClearQuote(q.id)
                        }}
                        className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:shadow-[var(--focus-ring)] ${
                          verdict && !verdict.correct
                            ? "bg-destructive/15 text-destructive line-through"
                            : "bg-secondary text-secondary-foreground hover:bg-destructive hover:text-destructive-foreground"
                        }`}
                        title={submitted ? "已判定" : "这是你的选择，点击移除"}
                      >
                        {verdict ? "你的选择 → " : "→ "}
                        {terms[assigned]?.term ?? assigned}
                        {!submitted && <span aria-hidden>×</span>}
                      </button>
                    ) : (
                      (isSelected || q.id === firstUnassignedId) && (
                        <Badge variant="outline" className="rounded-full text-xs font-normal text-muted-foreground">
                          {isSelected
                            ? isMobile
                              ? "在弹出的面板里点概念"
                              : "现在点右侧概念完成配对"
                            : isMobile
                              ? "这句话在说哪个概念？点一下选概念"
                              : "这句话在说哪个概念？点选或拖到右侧"}
                        </Badge>
                      )
                    )}
                    {verdict && verdict.correct && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        配对正确
                      </span>
                    )}
                    {verdict && !verdict.correct && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenTerm(verdict.expected)
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground focus-visible:shadow-[var(--focus-ring)]"
                          title="点开看术语卡"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          正确答案：{terms[verdict.expected]?.term ?? verdict.expected}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenFeedback(q.id)
                          }}
                          className="inline-flex items-center gap-1 rounded-full border-2 border-destructive px-3 py-1 text-xs font-medium text-destructive focus-visible:shadow-[var(--focus-ring)]"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          看三句话讲解
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 概念槽（桌面侧栏；手机上改用底部抽屉） */}
        <div className="hidden lg:sticky lg:top-20 lg:self-start lg:block">
          <div className="rounded-2xl bg-card p-4 shadow-md">
            <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Info className="h-4 w-4 text-primary" />
              MES 概念（{stage.concepts.length}）
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              判断每句话在说哪个概念：先点一条原话，再点右侧概念（点整个格子就行）；也可以直接把原话拖过去。格子右侧的小图标可以看术语卡。
            </p>
            <div className="mt-3 space-y-2">
              {stage.concepts.map((cid) => {
                const t = terms[cid]
                // 直接从作答表聚合计数（不依赖引语列表遍历，防御两者不同步）
                const placed = Object.values(answers).filter((c) => c === cid).length
                return (
                  <div
                    key={cid}
                    role="button"
                    tabIndex={0}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const qid = e.dataTransfer.getData("text/plain") || dragQuoteId || ""
                      setDragQuoteId(null)
                      if (qid) onAssignConcept(cid, qid)
                    }}
                    onClick={() => onAssignConcept(cid)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onAssignConcept(cid)
                    }}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border-2 px-3 py-2 transition-all duration-200 focus-visible:shadow-[var(--focus-ring)] ${
                      selectedQuote ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/50"
                    }`}
                  >
                    {/* 整槽点击 = 配对（含术名文字）；看术语卡收纳到右侧小图标，避免误触弹卡 */}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {t?.term ?? cid}
                    </span>
                    {placed > 0 && (
                      <Badge className={`shrink-0 rounded-full font-mono text-xs ${placed > 1 ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"}`}>
                        ×{placed}
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenTerm(cid)
                      }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary focus-visible:shadow-[var(--focus-ring)]"
                      title="看术语卡"
                      aria-label={`查看术语卡：${t?.term ?? cid}`}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 手机端：选中引语后从底部滑出概念面板，点一下完成配对，不用来回滚动 */}
      {isMobile && selectedQuote && !submitted && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="选择概念">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => onSelectQuote(selectedQuote)}
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[70vh] rounded-t-3xl bg-card p-4 pb-6 shadow-lg animate-in slide-in-from-bottom duration-300">
            <p className="text-center text-xs leading-5 text-muted-foreground">
              这句话在说哪个概念？点一下直接配对
            </p>
            <div className="mt-3 grid max-h-[45vh] grid-cols-2 gap-2 overflow-y-auto">
              {stage.concepts.map((cid) => {
                const t = terms[cid]
                const placed = Object.values(answers).filter((c) => c === cid).length
                return (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => onAssignConcept(cid)}
                    className="flex min-h-12 items-center justify-between gap-1.5 rounded-xl border-2 border-border bg-background px-3 py-3 text-left text-sm font-medium text-foreground transition-colors active:border-primary active:bg-primary/5 focus-visible:shadow-[var(--focus-ring)]"
                  >
                    <span className="min-w-0 flex-1 truncate">{t?.term ?? cid}</span>
                    {placed > 0 && (
                      <Badge className={`shrink-0 rounded-full font-mono text-xs ${placed > 1 ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"}`}>
                        ×{placed}
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>
            <Button
              variant="outline"
              onClick={() => onSelectQuote(selectedQuote)}
              className="mt-3 w-full rounded-full focus-visible:shadow-[var(--focus-ring)]"
            >
              取消选择
            </Button>
          </div>
        </div>
      )}

      {/* 底部操作条 */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-md">
        {submitted ? (
          <>
            <p className="text-sm font-medium text-foreground">
              判定完成：{matchCorrect} / {stage.quotes.length} 条配对正确
              {matchCorrect < stage.quotes.length && (
                <span className="text-muted-foreground">，红色条目记得点开三句话讲解</span>
              )}
            </p>
            <Button
              onClick={onNextStage}
              className="w-full rounded-full bg-primary text-primary-foreground hover:scale-105 focus-visible:shadow-[var(--focus-ring)] sm:w-auto"
            >
              {nextStageLabel}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              已配对 {Object.keys(answers).filter((k) => !!answers[k]).length} / {stage.quotes.length} 条
              {!allPlaced && "，全部放完才能提交"}
            </p>
            <Button
              onClick={onSubmit}
              disabled={!allPlaced}
              className="w-full rounded-full bg-primary text-primary-foreground hover:scale-105 focus-visible:shadow-[var(--focus-ring)] sm:w-auto"
            >
              提交判定
            </Button>
          </>
        )}
      </div>
    </section>
  )
}
