import { Database, Plus, Play, RotateCcw, ShieldCheck, History, TriangleAlert, Server, Trash2, Pencil } from "lucide-react"
import type { DbConnectionView } from "@/content/dbTraining"
import type { useDbTraining } from "@/pages/DbTraining/useDbTraining"
import { SqlResultTable } from "./SqlResultTable"

type P = ReturnType<typeof useDbTraining>

/** 自由 SQL 工作台：内置练习库 / 已保存的真实远程连接，危险语句确认 + 真连只读保护 */
export function WorkbenchPanel({
  view,
  chooseWbConn,
  setWbSql,
  runWbSql,
  confirmDangerExec,
  cancelDangerExec,
  resetBuiltinDb,
  setReadOnlyGuard,
  openConnDialog,
  deleteConn,
}: {
  view: NonNullable<P["workbenchView"]>
  chooseWbConn: (id: string) => void
  setWbSql: (v: string) => void
  runWbSql: () => void
  confirmDangerExec: () => void
  cancelDangerExec: () => void
  resetBuiltinDb: () => void
  setReadOnlyGuard: (v: boolean) => void
  openConnDialog: (conn?: DbConnectionView) => void
  deleteConn: (id: string) => void
}) {
  const dangers = view.dangerConfirm ?? []
  const hasBlock = dangers.some((d) => d.level === "block")

  return (
    <section className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
      {/* 连接选择 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => chooseWbConn("builtin")}
          className={
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors focus-visible:shadow-[var(--focus-ring)] " +
            (view.isBuiltin ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground")
          }
        >
          <Database className="h-3.5 w-3.5" />
          内置练习库
        </button>
        {view.connections.map((c) => (
          <span key={c.id} className="flex items-center">
            <button
              type="button"
              onClick={() => chooseWbConn(c.id)}
              className={
                "flex items-center gap-1.5 rounded-l-lg border px-3 py-1.5 text-xs transition-colors focus-visible:shadow-[var(--focus-ring)] " +
                (view.wbConnId === c.id ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground")
              }
            >
              <Server className="h-3.5 w-3.5" />
              {c.label}
            </button>
            <span className={"flex items-center rounded-r-lg border border-l-0 px-1 py-1.5 " + (view.wbConnId === c.id ? "border-primary bg-primary/10" : "border-border bg-card")}>
              <button type="button" onClick={() => openConnDialog(c)} aria-label={`编辑连接 ${c.label}`} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                <Pencil className="h-3 w-3" />
              </button>
              <button type="button" onClick={() => deleteConn(c.id)} aria-label={`删除连接 ${c.label}`} className="rounded p-0.5 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          </span>
        ))}
        <button
          type="button"
          onClick={() => openConnDialog()}
          className="flex items-center gap-1 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:shadow-[var(--focus-ring)]"
        >
          <Plus className="h-3.5 w-3.5" />
          连接我的数据库
        </button>
      </div>

      {/* 当前连接信息条 */}
      <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
        {view.isBuiltin ? (
          <>
            <span>
              内置练习库：MES 业务表（items / bom / work_orders / work_reports / inventory / sales_orders / employees / equipment），预置典型脏数据
            </span>
            <button
              type="button"
              onClick={resetBuiltinDb}
              disabled={view.wbBusy}
              className="ml-auto flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40 focus-visible:shadow-[var(--focus-ring)]"
            >
              <RotateCcw className="h-3 w-3" />
              重置练习库
            </button>
          </>
        ) : view.activeConn ? (
          <>
            <span>
              {view.typeMeta[view.activeConn.type]?.name} · {view.activeConn.host}
              {view.activeConn.port ? `:${view.activeConn.port}` : ""} / {view.activeConn.database || "(默认库)"} · 用户 {view.activeConn.username} · 密码 {view.activeConn.hasSecret ? "••••••" : "未设置"}
            </span>
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-0.5">
              <ShieldCheck className={"h-3 w-3 " + (view.readOnlyGuard ? "text-primary" : "text-muted-foreground")} />
              只读保护
              <input
                type="checkbox"
                checked={view.readOnlyGuard}
                onChange={(e) => setReadOnlyGuard(e.target.checked)}
                className="h-3 w-3 accent-[hsl(var(--primary))]"
                aria-label="只读保护开关"
              />
            </label>
          </>
        ) : null}
      </div>

      {view.wbNotice && (
        <p className="mb-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-[11px] text-primary">{view.wbNotice}</p>
      )}

      {/* SQL 编辑器 */}
      <div className="overflow-hidden rounded-xl border border-border bg-muted/60 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border bg-muted/80 px-3 py-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground">
            SQL 工作台{view.isBuiltin ? "" : " · 语句将发送到你的真实数据库执行"}
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground">Ctrl+Enter 执行</span>
        </div>
        <textarea
          value={view.wbSql}
          onChange={(e) => setWbSql(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) runWbSql()
          }}
          rows={7}
          spellCheck={false}
          aria-label="工作台 SQL 编辑区"
          className="w-full resize-y bg-transparent px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          placeholder={view.isBuiltin ? "-- 随便查：SELECT * FROM work_orders LIMIT 10" : "-- 对你自己的库执行 SQL；只读保护开启时仅放行查询"}
        />
        <div className="flex items-center gap-2 border-t border-border bg-muted/80 px-3 py-2">
          <button
            type="button"
            onClick={runWbSql}
            disabled={view.wbBusy || !view.wbSql.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40 focus-visible:shadow-[var(--focus-ring)]"
          >
            <Play className="h-3.5 w-3.5" />
            执行
          </button>
          {!view.isBuiltin && view.readOnlyGuard && (
            <span className="text-[10px] text-muted-foreground">只读保护中：仅放行 SELECT / SHOW / EXPLAIN 类语句</span>
          )}
        </div>
      </div>

      {/* 结果 */}
      <div className="mt-3">
        <SqlResultTable result={view.wbResult} error={view.wbError || undefined} busy={view.wbBusy} emptyHint="执行结果会显示在这里；出错时数据库原生报错也会原样展示" />
      </div>

      {/* 执行历史 */}
      {view.wbHistory.length > 0 && (
        <details className="mt-3 rounded-lg border border-border bg-card">
          <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
            <History className="h-3.5 w-3.5" />
            本次会话执行历史（{view.wbHistory.length} 条）
          </summary>
          <ul className="border-t border-border px-3 py-2">
            {[...view.wbHistory].reverse().map((h, i) => (
              <li key={i} className="mb-1.5 last:mb-0">
                <button
                  type="button"
                  onClick={() => setWbSql(h.sql)}
                  className="w-full rounded px-1 py-0.5 text-left focus-visible:shadow-[var(--focus-ring)]"
                  title="点击回填到编辑器"
                >
                  <span className={"text-[10px] " + (h.ok ? "text-primary" : "text-destructive")}>{h.at} · {h.ok ? "成功" : "失败"} · {h.summary}</span>
                  <code className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">{h.sql}</code>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* 危险语句确认弹窗 */}
      {view.dangerConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="危险操作确认">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl">
            <p className="flex items-center gap-2 text-sm font-bold text-destructive">
              <TriangleAlert className="h-4 w-4" />
              {hasBlock ? "只读保护拦截" : "确认执行危险语句？"}
            </p>
            <ul className="mt-3 space-y-2">
              {dangers.map((d, i) => (
                <li key={i} className="rounded-lg border border-border bg-muted/50 px-3 py-2">
                  <p className="text-xs font-semibold text-foreground">{d.label}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{d.detail}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelDangerExec}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:shadow-[var(--focus-ring)]"
              >
                取消
              </button>
              {!hasBlock && (
                <button
                  type="button"
                  onClick={confirmDangerExec}
                  className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground focus-visible:shadow-[var(--focus-ring)]"
                >
                  我知道后果，执行
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
