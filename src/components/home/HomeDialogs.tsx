import { Lock, Construction } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { ChapterDef } from "@/content/chapters"

interface HomeDialogsProps {
  lockedChapter: ChapterDef | null
  constructionNote: { title: string; body: string } | null
  onClose: () => void
}

export function HomeDialogs({ lockedChapter, constructionNote, onClose }: HomeDialogsProps) {
  return (
    <>
      <Dialog open={lockedChapter !== null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="rounded-2xl shadow-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              第{lockedChapter?.id}章 · {lockedChapter?.title}
            </DialogTitle>
            <DialogDescription className="leading-6">
              {lockedChapter?.lockedTip}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onClose} className="focus-visible:shadow-[var(--focus-ring)]">
              先把前面的章节打通
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={constructionNote !== null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="rounded-2xl shadow-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Construction className="h-4 w-4 text-primary" />
              {constructionNote?.title}
            </DialogTitle>
            <DialogDescription className="leading-6">
              {constructionNote?.body}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onClose} className="focus-visible:shadow-[var(--focus-ring)]">
              知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
