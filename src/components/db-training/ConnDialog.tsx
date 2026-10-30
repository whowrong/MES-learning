import { useEffect, useState } from "react"
import { Database, PlugZap, Save, X, Loader2, ShieldCheck } from "lucide-react"
import { DrillEnvironmentNotice } from "@/components/lab/DrillEnvironmentNotice"
import { looksLikeProduction as looksLikeProductionHost } from "@/game/labScripts"
import { DB_TYPE_META, type DbConnectionView } from "@/content/dbTraining"
import type { ConnForm } from "@/pages/DbTraining/useDbTraining"

/** 数据库连接登记弹窗：明文密码只在这里出现一次，保存后只存服务端、界面永久脱敏 */
export function ConnDialog({
  form,
  testResult,
  busy,
  onUpdate,
  onTest,
  onSave,
  onClose,
}: {
  form: ConnForm
  testResult: { ok: boolean; message: string } | null
  busy: boolean
  onUpdate: (patch: Partial<ConnForm>) => void
  onTest: () => void
  onSave: () => void
  onClose: () => void
}) {
  const isEdit = Boolean(form.id)
  const typeKeys = ["mysql", "sqlserver", "postgres"] as const
  // 疑似生产主机名时要用户二次确认；换了主机就重新确认
  const [prodAck, setProdAck] = useState(false)
  useEffect(() => {
    setProdAck(false)
  }, [form.host])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="数据库连接登记">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">{isEdit ? "编辑连接" : "连接我的真实数据库"}</h2>
          <button type="button" onClick={onClose} aria-label="关闭" className="ml-auto rounded p-1 text-muted-foreground hover:text-foreground focus-visible:shadow-[var(--focus-ring)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mr-1 inline h-3 w-3 text-primary" />
          凭据只保存在本站服务端（不出现在页面代码与公开仓库），列表与回显一律脱敏。建议填<b className="text-foreground">演练专用账号</b>并只给必要权限，别把重要的生产库挂上来。数据库需要允许从外网访问（内网库连不上）。
        </p>
        <DrillEnvironmentNotice host={form.host} confirmed={prodAck} onConfirmChange={setProdAck} target="db" />

        {/* 类型选择 */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {typeKeys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onUpdate({ type: k, port: String(DB_TYPE_META[k].defaultPort) })}
              className={
                "rounded-lg border px-2 py-2 text-left transition-colors focus-visible:shadow-[var(--focus-ring)] " +
                (form.type === k ? "border-primary bg-primary/10" : "border-border hover:border-primary/40")
              }
            >
              <span className={"block text-xs font-semibold " + (form.type === k ? "text-primary" : "text-foreground")}>{DB_TYPE_META[k].name}</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{DB_TYPE_META[k].note}</span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">Oracle 的连接组件在本环境装不上，暂不支持真连——可以用内置练习库练 SQL 功底。</p>

        {/* 表单 */}
        <div className="mt-3 space-y-2.5">
          <label className="block">
            <span className="text-[11px] font-semibold text-muted-foreground">连接名称（自己认得就行）</span>
            <input
              value={form.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="如：演练 MySQL"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
            />
          </label>
          <div className="grid grid-cols-[1fr_110px] gap-2">
            <label className="block">
              <span className="text-[11px] font-semibold text-muted-foreground">主机地址</span>
              <input
                value={form.host}
                onChange={(e) => onUpdate({ host: e.target.value })}
                placeholder="IP 或域名，如 123.45.67.89"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-muted-foreground">端口</span>
              <input
                value={form.port}
                onChange={(e) => onUpdate({ port: e.target.value })}
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] font-semibold text-muted-foreground">数据库名</span>
              <input
                value={form.database}
                onChange={(e) => onUpdate({ database: e.target.value })}
                placeholder="如 mes_practice"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-muted-foreground">用户名</span>
              <input
                value={form.username}
                onChange={(e) => onUpdate({ username: e.target.value })}
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-[11px] font-semibold text-muted-foreground">
              密码{isEdit ? "（留空 = 保留原密码）" : ""}
            </span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => onUpdate({ password: e.target.value })}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
            />
          </label>
        </div>

        {testResult && (
          <p className={"mt-2 rounded-lg px-3 py-2 text-[11px] " + (testResult.ok ? "border border-primary/30 bg-primary/5 text-primary" : "border border-destructive/40 bg-destructive/5 text-destructive")}>
            {testResult.message}
          </p>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onTest}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 focus-visible:shadow-[var(--focus-ring)]"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
            测试连接
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={busy || (Boolean(form.host) && looksLikeProductionHost(form.host) && !prodAck)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40 focus-visible:shadow-[var(--focus-ring)]"
          >
            <Save className="h-3.5 w-3.5" />
            保存连接
          </button>
        </div>
      </div>
    </div>
  )
}

export type { DbConnectionView }
