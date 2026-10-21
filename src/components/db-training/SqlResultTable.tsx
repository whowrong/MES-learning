import { Table2, TriangleAlert, Rows3 } from "lucide-react"
import type { SqlExecResult } from "@/lib/labApi"

/** SQL 执行结果表格：列头 + 行数据 + 影响行数/截断提示 + 错误详情（任务练习与工作台共用） */
export function SqlResultTable({
  result,
  error,
  busy,
  emptyHint = "执行结果会显示在这里",
}: {
  result: SqlExecResult | null
  error?: string
  busy?: boolean
  emptyHint?: string
}) {
  if (busy) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-6 text-xs text-muted-foreground">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        正在执行…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
        <p className="flex items-start gap-2 text-xs font-semibold text-destructive">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
        {result?.native && result.native !== error && (
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">数据库原始报错（学会读它是实施基本功）</summary>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted/60 p-2 font-mono text-[11px] text-muted-foreground">
              {result.native}
            </pre>
          </details>
        )}
      </div>
    )
  }

  if (!result) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
        <Rows3 className="mx-auto mb-1 h-4 w-4 opacity-50" />
        {emptyHint}
      </div>
    )
  }

  if (!result.ok) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-xs text-destructive">
        {result.error || "执行失败"}
        {result.native && result.native !== result.error && (
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">{result.native}</pre>
        )}
      </div>
    )
  }

  const hasRows = (result.columns?.length ?? 0) > 0 || (result.rows?.length ?? 0) > 0

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1 text-primary">
          <Table2 className="h-3.5 w-3.5" />
          {hasRows ? `${result.rows?.length ?? 0} 行${result.truncated ? `（截断显示，实际 ${result.total} 行）` : ""}` : "查询无结果"}
        </span>
        {result.affectedRows !== undefined && result.affectedRows !== null && !hasRows && (
          <span>影响 {result.affectedRows} 行</span>
        )}
        {result.message && <span>{result.message}</span>}
      </div>
      {hasRows && (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="sticky top-0 bg-muted/90">
              <tr>
                {(result.columns ?? []).map((c, i) => (
                  <th key={i} className="whitespace-nowrap border-b border-border px-2.5 py-1.5 font-semibold text-foreground">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(result.rows ?? []).map((row, ri) => (
                <tr key={ri} className={ri % 2 === 1 ? "bg-muted/30" : undefined}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="whitespace-nowrap border-b border-border/50 px-2.5 py-1 text-muted-foreground">
                      {cell === null ? <span className="italic opacity-60">NULL</span> : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
