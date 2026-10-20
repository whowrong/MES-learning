import { BookOpen } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { TermDef } from "@/content/loader"
import { ILLUSTRATIONS } from "@/components/illustrations"

interface TermCardDialogProps {
  term: TermDef | null
  onClose: () => void
}

/** 术语卡弹窗：车间大白话 + 完整定义 + 例子 + 讲解图（首次标注点开就是它） */
export function TermCardDialog({ term, onClose }: TermCardDialogProps) {
  const Illustration = term?.illustration ? ILLUSTRATIONS[term.illustration] : undefined
  return (
    <Dialog open={term !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl shadow-lg">
        {term && (
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <BookOpen className="h-4 w-4" />
              </span>
              {term.term}
              <Badge variant="outline" className="ml-1 rounded-full font-mono text-xs font-normal">
                {term.knowledge_id}
              </Badge>
            </DialogTitle>
            <div className="space-y-3 pt-2 text-sm leading-6">
              <p className="rounded-xl bg-secondary px-3 py-2 text-secondary-foreground">
                <span className="font-bold">车间大白话：</span>
                {term.dialect}
              </p>
              {Illustration && (
                <div className="rounded-xl border border-border bg-background/60 px-3 py-2">
                  <Illustration />
                </div>
              )}
              <p className="text-foreground">{term.definition}</p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">举个例子：</span>
                {term.example}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={onClose}
              className="mt-3 self-end focus-visible:shadow-[var(--focus-ring)]"
            >
              记住了
            </Button>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  )
}
