// 厂型形态小图：三种生产组织方式一眼分辨（用在厂型特训营选卡页）
interface FactoryShapeProps {
  variant: "discrete" | "flow" | "hybrid"
}

function Cell({ tone = "muted" }: { tone?: "muted" | "primary" | "secondary" }) {
  const cls =
    tone === "primary"
      ? "border-primary bg-primary/25"
      : tone === "secondary"
        ? "border-border bg-secondary"
        : "border-border bg-card"
  return <span className={`inline-block h-4 w-4 rounded border-2 ${cls}`} aria-hidden />
}

export function FactoryShape({ variant }: FactoryShapeProps) {
  if (variant === "flow") {
    return (
      <div className="flex items-center justify-center gap-0.5 py-2" role="img" aria-label="流水线形态：五个工位串成一条直线，产品不停流">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="flex items-center gap-0.5">
            <Cell tone="primary" />
            {i < 4 && <span className="text-xs text-primary">→</span>}
          </span>
        ))}
      </div>
    )
  }
  if (variant === "hybrid") {
    return (
      <div className="flex flex-col items-center gap-1 py-1.5" role="img" aria-label="混合型形态：上半段是流水线，下半段是离散工位，两段在衔接点汇流">
        <div className="flex items-center gap-0.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex items-center gap-0.5">
              <Cell tone="primary" />
              {i < 2 && <span className="text-xs text-primary">→</span>}
            </span>
          ))}
        </div>
        <span className="text-xs text-muted-foreground" aria-hidden>⇅ 衔接点：缓冲库</span>
        <div className="flex items-center gap-2">
          <Cell tone="secondary" />
          <Cell tone="secondary" />
          <Cell tone="secondary" />
        </div>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 justify-items-center gap-x-3 gap-y-1 py-1.5" role="img" aria-label="离散制造形态：各工位独立作业，工件按工单断续流转">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="flex flex-col items-center">
          <Cell tone="secondary" />
          {i < 4 && <span className="text-xs text-muted-foreground">┆</span>}
        </span>
      ))}
    </div>
  )
}
