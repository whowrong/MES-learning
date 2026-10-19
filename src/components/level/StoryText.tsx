import type { ReactNode } from "react"
import type { TermDef } from "@/content/loader"

/**
 * 把内容文件里的 {{term_id}} 占位渲染成可点开的术语标注。
 * 未知 id 原样保留花括号文本，内容写错不会白屏。
 */
export function renderStoryText(
  text: string,
  terms: Record<string, TermDef>,
  onOpenTerm: (termId: string) => void,
): ReactNode[] {
  const parts = text.split(/\{\{(\w+)\}\}/g)
  const nodes: ReactNode[] = []
  parts.forEach((part, idx) => {
    if (idx % 2 === 1) {
      const t = terms[part]
      if (t) {
        nodes.push(
          <button
            key={`term-${idx}`}
            type="button"
            onClick={() => onOpenTerm(part)}
            className="mx-0.5 inline-flex items-baseline gap-1 rounded-md bg-secondary px-1.5 py-0.5 align-baseline text-sm font-medium text-secondary-foreground underline decoration-primary decoration-2 underline-offset-2 transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:shadow-[var(--focus-ring)]"
          >
            {t.term}
          </button>,
        )
        return
      }
      nodes.push(<span key={`raw-${idx}`}>{`{{${part}}}`}</span>)
      return
    }
    nodes.push(<span key={`txt-${idx}`}>{part}</span>)
  })
  return nodes
}
