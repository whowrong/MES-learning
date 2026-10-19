import { BookOpen, FlaskConical, Hammer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface SiteHeaderProps {
  reviewCount: number
  onGlossary: () => void
  onSandbox: () => void
}

export function SiteHeader({ reviewCount, onGlossary, onSandbox }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
            <Hammer className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="hidden font-mono text-xs tracking-widest text-muted-foreground sm:block">MES 实施模拟器</p>
            <p className="text-base font-bold text-foreground">车间操盘手</p>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          <Button
            variant="outline"
            className="focus-visible:shadow-[var(--focus-ring)]"
            onClick={onGlossary}
            aria-label="术语卡库"
          >
            <BookOpen className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">术语卡库</span>
            {reviewCount > 0 && (
              <Badge className="ml-1 rounded-full bg-primary text-primary-foreground sm:ml-2">
                {reviewCount}
              </Badge>
            )}
          </Button>
          <Button
            variant="outline"
            className="focus-visible:shadow-[var(--focus-ring)]"
            onClick={onSandbox}
            aria-label="自由沙盘"
          >
            <FlaskConical className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">自由沙盘</span>
          </Button>
        </nav>
      </div>
    </header>
  )
}
