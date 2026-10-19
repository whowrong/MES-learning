import { AlertTriangle, Database, Factory, UserRound } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { MatchQuoteDef } from "@/content/loader"

interface FeedbackPanelProps {
  quote: MatchQuoteDef | null
  /** 判定后的对照：玩家选的概念名 / 正确概念名（有值才显示对照行） */
  givenTerm?: string
  expectedTerm?: string
  onClose: () => void
}

const ROWS = [
  { key: "factory", icon: Factory, label: "现实工厂会怎样", text: "" },
  { key: "data", icon: Database, label: "MES 数据会怎样", text: "" },
  { key: "consultant", icon: UserRound, label: "顾问该怎么做", text: "" },
] as const

/** 答错后的三句话讲解面板：你的选择 vs 正确答案 + 现实 / 数据 / 行动 */
export function FeedbackPanel({ quote, givenTerm, expectedTerm, onClose }: FeedbackPanelProps) {
  return (
    <Dialog open={quote !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto rounded-2xl shadow-lg">
        {quote && (
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2 text-base leading-6">
              <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-destructive" />
              <span className="text-foreground">{quote.text}</span>
            </DialogTitle>
            {(givenTerm || expectedTerm) && (
              <p className="pt-1 text-sm leading-6">
                <span className="text-muted-foreground">你的选择：</span>
                <span className="font-medium text-destructive line-through">{givenTerm || "—"}</span>
                <span className="mx-2 text-muted-foreground">→</span>
                <span className="text-muted-foreground">正确答案：</span>
                <span className="font-bold text-primary">{expectedTerm || "—"}</span>
              </p>
            )}
            <div className="space-y-3 pt-2">
              {ROWS.map((row) => {
                const Icon = row.icon
                const body = quote.feedback[row.key]
                return (
                  <div key={row.key} className="flex gap-3 rounded-xl bg-muted px-3 py-2.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card text-primary">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-sm leading-6 text-foreground">
                      <span className="font-bold text-primary">{row.label}：</span>
                      {body}
                    </p>
                  </div>
                )
              })}
            </div>
            <Button
              variant="outline"
              onClick={onClose}
              className="mt-2 self-end rounded-full focus-visible:shadow-[var(--focus-ring)]"
            >
              明白了
            </Button>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  )
}
