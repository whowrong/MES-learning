import { AlertCircle, ArrowLeft, Bug, CheckCircle2, ClipboardCopy, Loader2, RefreshCw, Trash2, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { useDebug } from "./useDebug"

export function DebugPage(p: ReturnType<typeof useDebug>) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/40 to-card">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6">
          <Button variant="ghost" size="sm" onClick={p.goHome} className="shrink-0 rounded-full focus-visible:shadow-[var(--focus-ring)]">
            <ArrowLeft className="mr-1 h-4 w-4" />
            回首页
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bug className="h-3.5 w-3.5" />
            </span>
            <span className="truncate text-sm font-bold text-foreground">诊断面板</span>
            <Badge className="shrink-0 rounded-full bg-muted font-mono text-xs text-muted-foreground">v{p.buildVersion}</Badge>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {p.copiedLabel && <span className="text-xs text-primary">{p.copiedLabel} 已复制</span>}
            <Button onClick={p.copyDiagnostics} className="rounded-full bg-primary text-primary-foreground hover:scale-105 focus-visible:shadow-[var(--focus-ring)]">
              <ClipboardCopy className="mr-1.5 h-4 w-4" />
              复制诊断报告
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        {/* 服务体检 */}
        <section className="rounded-2xl bg-card p-6 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">服务体检</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                内容文件、后端心跳、存档读写逐项检测——报问题时先看这里哪项 FAIL
              </p>
            </div>
            <div className="flex items-center gap-2">
              {p.checkResults && (
                <Badge className={`rounded-full px-3 py-1 text-xs ${p.allPass ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                  {p.allPass ? "全部通过" : `${p.failedCount} 项失败`}
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={() => void p.runChecks()} disabled={p.checking} className="rounded-full focus-visible:shadow-[var(--focus-ring)]">
                {p.checking ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                重新体检
              </Button>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {(p.checkResults ?? []).map((r) => (
              <li key={r.name} className="flex items-start gap-3 rounded-xl bg-muted px-4 py-2.5">
                {r.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {r.name}
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {r.status} · {r.ms}ms
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground" title={r.detail}>
                    {r.detail}
                  </p>
                </div>
              </li>
            ))}
            {p.checking && !p.checkResults && (
              <li className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                正在逐项检测…
              </li>
            )}
          </ul>
        </section>

        {/* 运行时错误日志 */}
        <section className="rounded-2xl bg-card p-6 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">运行时错误日志</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                脚本错误、Promise 异常、页面崩溃（含组件栈）自动收集，刷新不丢，最多留 50 条
              </p>
            </div>
            {p.entries.length > 0 && (
              <Button variant="outline" size="sm" onClick={p.clearErrors} className="rounded-full text-destructive focus-visible:shadow-[var(--focus-ring)]">
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                清空
              </Button>
            )}
          </div>
          {p.entries.length === 0 ? (
            <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              没有记录到任何错误——一切正常。
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {p.entries.map((e, i) => (
                <li key={`${e.t}-${i}`}>
                  <button
                    type="button"
                    onClick={() => p.toggleExpand(i)}
                    className="w-full rounded-xl bg-destructive/10 px-4 py-2.5 text-left focus-visible:shadow-[var(--focus-ring)]"
                  >
                    <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-mono text-xs text-muted-foreground">{e.t}</span>
                      <Badge variant="outline" className="shrink-0 rounded-full text-xs">{e.type}</Badge>
                    </p>
                    <p className="mt-1 truncate text-xs text-foreground">{e.message}</p>
                  </button>
                  {p.expandedIdx === i && e.stack && (
                    <pre className="mt-1 max-h-64 overflow-auto rounded-xl bg-muted px-4 py-3 font-mono text-xs leading-5 text-muted-foreground">
                      {e.stack}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 环境信息 */}
        <section className="rounded-2xl bg-card p-6 shadow-md">
          <h2 className="text-lg font-bold text-foreground">环境信息</h2>
          <dl className="mt-3 space-y-2">
            {p.envRows.map((row) => (
              <div key={row.label} className="flex items-start gap-3 rounded-xl bg-muted px-4 py-2.5">
                <dt className="w-20 shrink-0 text-xs text-muted-foreground">{row.label}</dt>
                <dd className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 存档快照 */}
        <section className="rounded-2xl bg-card p-6 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-foreground">存档快照</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">当前生效的第一条存档记录（章节状态 / 仪表 / 复习调度 / 打卡）</p>
            </div>
            {p.snapshot && (
              <Button variant="outline" size="sm" onClick={() => void p.copyText(p.snapshot, "存档快照")} className="rounded-full focus-visible:shadow-[var(--focus-ring)]">
                <ClipboardCopy className="mr-1 h-3.5 w-3.5" />
                复制
              </Button>
            )}
          </div>
          {p.snapshotError ? (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              存档读取失败：{p.snapshotError}
            </p>
          ) : (
            <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-muted px-4 py-3 font-mono text-xs leading-5 text-foreground">
              {p.snapshot || "加载中…"}
            </pre>
          )}
        </section>
      </main>
    </div>
  )
}
