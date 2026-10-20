// BOM 树形图：一把折叠椅的父子账，层级和用量一眼看懂
interface TreeNodeProps {
  name: string
  qty: string
  note?: string
  tone?: "top" | "semi" | "leaf"
  children?: React.ReactNode
}

function TreeNode({ name, qty, note, tone = "leaf", children }: TreeNodeProps) {
  const toneCls =
    tone === "top"
      ? "border-primary bg-primary/15 text-foreground"
      : tone === "semi"
        ? "border-border bg-secondary text-secondary-foreground"
        : "border-border bg-card text-foreground"
  return (
    <div className="flex flex-col items-center">
      <div className={`rounded-xl border-2 px-3 py-2 text-center shadow-sm ${toneCls}`}>
        <p className="text-sm font-bold leading-tight">{name}</p>
        <p className="mt-0.5 font-mono text-xs text-primary">{qty}</p>
        {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      </div>
      {children}
    </div>
  )
}

export function BomTree() {
  return (
    <div className="overflow-x-auto py-2" role="img" aria-label="折叠椅的多级 BOM 树：成品在上，半成品居中，原材料在底">
      <div className="mx-auto flex min-w-[420px] flex-col items-center gap-0">
        <TreeNode name="折叠椅" qty="成品 ×1" tone="top" />
        <div className="h-4 w-px bg-border" />
        {/* 横线连接三个子节点 */}
        <div className="relative flex w-full items-start justify-center gap-6">
          <div className="absolute left-[16%] right-[16%] top-0 h-px bg-border" />
          <div className="flex flex-col items-center">
            <div className="h-4 w-px bg-border" />
            <TreeNode name="座板" qty="×1 块" />
          </div>
          <div className="flex flex-col items-center">
            <div className="h-4 w-px bg-border" />
            <TreeNode name="椅腿" qty="×4 根" tone="semi" note="自制半成品">
              <div className="mt-0 flex flex-col items-center">
                <div className="h-3 w-px bg-border" />
                <div className="relative flex items-start justify-center gap-3">
                  <div className="absolute left-[22%] right-[22%] top-0 h-px bg-border" />
                  <div className="flex flex-col items-center">
                    <div className="h-3 w-px bg-border" />
                    <TreeNode name="钢管" qty="2.5 米" note="损耗 +3%" />
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="h-3 w-px bg-border" />
                    <TreeNode name="脚垫" qty="×1 个" />
                  </div>
                </div>
              </div>
            </TreeNode>
          </div>
          <div className="flex flex-col items-center">
            <div className="h-4 w-px bg-border" />
            <TreeNode name="螺丝" qty="×12 颗" />
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          树顶是成品、中间是自制半成品、叶子全是采购件——需求展开顺着树往下乘
        </p>
      </div>
    </div>
  )
}
