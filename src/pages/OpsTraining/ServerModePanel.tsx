import { useEffect, useRef, useState } from "react"
import {
  Server, Plus, TerminalSquare, Copy, Check, LogOut, Pencil, Trash2, TriangleAlert,
  FileText, UploadCloud, Rocket, Bot, Download, ChevronRight, X, Loader2, ShieldAlert,
} from "lucide-react"
import { DrillEnvironmentNotice } from "@/components/lab/DrillEnvironmentNotice"
import { looksLikeProduction as looksLikeProductionHost } from "@/game/labScripts"
import type { useOpsTraining } from "./useOpsTraining"
import type { DeployDocTemplate } from "./useRealServer"

type P = ReturnType<typeof useOpsTraining>

const LINE_CLASS: Record<string, string> = {
  cmd: "font-semibold text-foreground",
  out: "whitespace-pre-wrap text-muted-foreground",
  info: "whitespace-pre-wrap text-primary/90",
  warn: "whitespace-pre-wrap text-destructive",
  ok: "whitespace-pre-wrap text-primary",
}

/** 真实服务器模式：服务器终端 / 部署文档库 两个页签 */
export function ServerModePanel({ p, onExit }: { p: P; onExit: () => void }) {
  const [tab, setTab] = useState<"terminal" | "docs">("terminal")
  const v = p.realServerView

  return (
    <section className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
      {/* 顶部：返回 + 页签 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:shadow-[var(--focus-ring)]"
        >
          <LogOut className="h-3.5 w-3.5" />
          返回模拟演练
        </button>
        <div className="ml-auto flex rounded-lg border border-border p-0.5">
          <button
            type="button"
            onClick={() => setTab("terminal")}
            className={"flex items-center gap-1 rounded-md px-3 py-1 text-xs transition-colors " + (tab === "terminal" ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <TerminalSquare className="h-3.5 w-3.5" />
            服务器终端
          </button>
          <button
            type="button"
            onClick={() => setTab("docs")}
            className={"flex items-center gap-1 rounded-md px-3 py-1 text-xs transition-colors " + (tab === "docs" ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <FileText className="h-3.5 w-3.5" />
            部署文档库
          </button>
        </div>
      </div>

      {v.srvNotice && (
        <p className="mb-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-[11px] text-primary">{v.srvNotice}</p>
      )}

      {tab === "terminal" ? <ServerTerminalTab p={p} /> : <DocsTab p={p} />}

      {/* 连接表单弹窗 */}
      {v.srvDialogOpen && <SrvConnDialog p={p} />}

      {/* 待确认操作弹窗（危险命令 / 上传 / 部署命令） */}
      {v.pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={v.pendingAction.title}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl">
            <p className="flex items-center gap-2 text-sm font-bold text-destructive">
              {v.pendingAction.kind === "danger-cmd" ? <ShieldAlert className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
              {v.pendingAction.title}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{v.pendingAction.detail}</p>
            {v.pendingAction.command && (
              <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/70 p-2.5 font-mono text-[11px] text-foreground">{v.pendingAction.command}</pre>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={p.cancelPending} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:shadow-[var(--focus-ring)]">
                取消
              </button>
              <button type="button" onClick={p.confirmPending} className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground focus-visible:shadow-[var(--focus-ring)]">
                确认执行
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

/** 页签一：服务器连接 + 真实终端 */
function ServerTerminalTab({ p }: { p: P }) {
  const v = p.realServerView
  const [cmd, setCmd] = useState("")
  const [copied, setCopied] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [v.realLines.length])

  const submit = () => {
    const c = cmd.trim()
    if (!c || v.realBusy) return
    p.sendRealCommand(c)
    setCmd("")
    inputRef.current?.focus()
  }

  return (
    <>
      {/* 连接列表 */}
      <div className="mb-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">我的演练服务器</h2>
          <button
            type="button"
            onClick={() => p.openSrvDialog()}
            className="ml-auto flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary hover:text-primary focus-visible:shadow-[var(--focus-ring)]"
          >
            <Plus className="h-3 w-3" />
            登记服务器
          </button>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          凭据只保存在本站服务端（不出现在页面代码与公开仓库），列表永久脱敏。建议用<b className="text-foreground">演练专用账号</b>；服务器需允许 SSH 从外网访问（云主机记得安全组放行）。
        </p>
        {v.serverConns.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
            还没有登记服务器。登记一台你自己的 Linux 演练机，就能在这个终端里对它真敲命令。
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {v.serverConns.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                <Server className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="text-xs font-semibold text-foreground">{c.label}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                  {({ generic: "通用 SSH", instabox: "Instabox", cloady: "Cloady", bohrium: "Bohrium", uppcoder: "Uppcoder" } as const)[c.platform]}
                  {c.connType === "manual" ? " · 网页终端" : c.connType === "api-cli" ? " · API 执行" : c.transport === "tailscale" ? " · Tailscale SSH" : c.transport === "jump" ? " · 跳板 SSH" : " · SSH"}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {c.connType === "manual" ? c.panelUrl : c.connType === "api-cli" ? `机器 ${c.machine}` : `${c.username}@${c.host}:${c.port} · ${c.authType === "key" ? "私钥" : c.authType === "none" ? "免密" : "密码"} ${c.hasSecret ? "••••••" : ""}`}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{c.canExec ? "可执行" : "仅人工"}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{c.canUpload ? "可上传" : "不可上传"}</span>
                <span className="max-w-[180px] truncate text-[10px] text-muted-foreground">{c.persistence}</span>
                <span className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => p.openRealTerminal(c.id)}
                    aria-label={c.canExec ? `进入 ${c.label} 终端` : `选择 ${c.label} 作为人工部署目标`}
                    title={!c.canExec ? "仅人工终端；选择后自动部署流程会跳过此连接" : undefined}
                    className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground focus-visible:shadow-[var(--focus-ring)]"
                  >
                    <TerminalSquare className="h-3 w-3" />
                    {c.canExec ? (v.activeConnId === c.id ? "回到终端" : "进入终端") : v.activeConnId === c.id ? "已选人工目标" : "选择人工目标"}
                  </button>
                  <button type="button" onClick={() => p.openSrvDialog(c)} aria-label={`编辑 ${c.label}`} className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => p.deleteSrvConn(c.id)} aria-label={`删除 ${c.label}`} className="rounded-md border border-border p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 真实终端 */}
      {v.activeConn?.connType === "manual" ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">{v.activeConn.label}：仅人工网页终端</p>
          <p className="mt-1">此连接不能从本站自动执行命令或上传。选择它作为部署目标后，文档任务包会明确跳过自动部署。</p>
          {v.activeConn.panelUrl && <a href={v.activeConn.panelUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block underline">打开平台面板</a>}
        </div>
      ) : v.activeConn && (
        <div className="overflow-hidden rounded-xl border border-destructive/40 bg-muted/60 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-destructive/40 bg-destructive/10 px-3 py-1.5">
            <span className="flex items-center gap-1 text-[11px] font-bold text-destructive">
              <ShieldAlert className="h-3.5 w-3.5" />
              真实服务器 · 命令将实际执行
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {v.activeConn.connType === "api-cli" ? `Instabox · ${v.activeConn.machine}` : `${v.activeConn.username}@${v.activeConn.host}`}
            </span>
            <button
              type="button"
              onClick={async () => {
                const ok = await p.copyRealSession()
                setCopied(ok)
                setTimeout(() => setCopied(false), 1500)
              }}
              className="ml-auto flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground focus-visible:shadow-[var(--focus-ring)]"
              aria-label="复制全部会话记录"
            >
              {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
              {copied ? "已复制" : "复制全部"}
            </button>
            <button type="button" onClick={p.closeRealTerminal} className="text-[11px] text-muted-foreground underline-offset-2 hover:underline">
              断开
            </button>
          </div>
          <div
            ref={scrollRef}
            className="h-[42vh] min-h-[240px] select-text overflow-y-auto px-3 py-2.5 font-mono text-xs leading-relaxed sm:h-[48vh]"
            onClick={() => {
              const sel = window.getSelection()
              if (sel && sel.toString().length > 0) return
              inputRef.current?.focus()
            }}
            role="log"
            aria-live="polite"
          >
            {v.realLines.map((line, i) => (
              <p key={i} className={"mb-1 " + (LINE_CLASS[line.kind] ?? "")}>
                {line.kind === "cmd" ? `$ ${line.text}` : line.text}
              </p>
            ))}
            {v.realBusy && <p className="mb-1 animate-pulse text-muted-foreground">执行中…</p>}
          </div>
          <div className="flex items-center gap-2 border-t border-border bg-muted/80 px-3 py-2">
            <span className="shrink-0 font-mono text-xs text-primary">[{v.activeConn.connType === "api-cli" ? `Instabox:${v.activeConn.machine}` : `${v.activeConn.username}@${v.activeConn.label}`}]$</span>
            <input
              ref={inputRef}
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit()
              }}
              disabled={v.realBusy}
              placeholder="输入命令后回车（危险命令会先弹确认）…"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="真实服务器命令输入"
              className="min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>
      )}
    </>
  )
}

/** 页签二：部署文档库（预置模板 + 自建文档 → 发送到服务器 / 发给 AI agent） */
function DocsTab({ p }: { p: P }) {
  const v = p.realServerView
  const [showNewDoc, setShowNewDoc] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newContent, setNewContent] = useState("")
  const [newCommands, setNewCommands] = useState("")
  const [copied, setCopied] = useState(false)

  return (
    <>
      {v.activeDoc ? (
        <DocActionPanel p={p} copied={copied} setCopied={setCopied} />
      ) : (
        <div className="space-y-3">
          {/* 预置模板 */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <FileText className="h-4 w-4 text-primary" />
              预置部署手册
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground">写好的演练环境部署文档：可以发送到你的服务器，也可以打包发给你的 AI agent 让它照着装。</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {v.docTemplates.map((tpl: DeployDocTemplate) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    onClick={() => p.openTemplateDoc(tpl)}
                    className="group w-full rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-left transition-colors hover:border-primary/50 focus-visible:shadow-[var(--focus-ring)]"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      {tpl.title}
                      <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <span className="mt-0.5 block text-[10px] text-primary">{tpl.doc_type}</span>
                    <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{tpl.summary}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* 自建文档 */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">我的文档</h2>
              <button
                type="button"
                onClick={() => setShowNewDoc((s) => !s)}
                className="ml-auto flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary hover:text-primary focus-visible:shadow-[var(--focus-ring)]"
              >
                <Plus className="h-3 w-3" />
                新建文档
              </button>
            </div>
            {showNewDoc && (
              <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="文档标题，如：我的演练机环境清单"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                  aria-label="文档标题"
                />
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={6}
                  placeholder="正文（支持 Markdown）：环境说明、装机步骤、注意事项…"
                  className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                  aria-label="文档正文"
                />
                <textarea
                  value={newCommands}
                  onChange={(e) => setNewCommands(e.target.value)}
                  rows={3}
                  placeholder="可选：一键部署命令，一行一条（发送后可逐条确认执行）"
                  className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                  aria-label="部署命令"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowNewDoc(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={v.docBusy || !newTitle.trim() || !newContent.trim()}
                    onClick={async () => {
                      await p.saveUserDoc(newTitle.trim(), newContent, newCommands)
                      setNewTitle(""); setNewContent(""); setNewCommands(""); setShowNewDoc(false)
                    }}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    保存文档
                  </button>
                </div>
              </div>
            )}
            {v.userDocs.length === 0 && !showNewDoc && (
              <p className="mt-2 text-[11px] text-muted-foreground">还没有自建文档。把你自己的环境清单、装机笔记存进来，随时发给服务器或 AI agent。</p>
            )}
            <ul className="mt-2 space-y-1.5">
              {v.userDocs.map((d) => (
                <li key={d.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <button type="button" onClick={() => p.openUserDoc(d)} className="min-w-0 flex-1 text-left focus-visible:shadow-[var(--focus-ring)]">
                    <span className="block truncate text-xs font-semibold text-foreground">{d.title}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{d.content.slice(0, 60)}…</span>
                  </button>
                  <button type="button" onClick={() => p.deleteUserDoc(d.id)} aria-label={`删除文档 ${d.title}`} className="rounded-md border border-border p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}

/** 文档动作面板：预览 + 发送到服务器 + 一键部署 + 发给 AI agent */
function DocActionPanel({ p, copied, setCopied }: { p: P; copied: boolean; setCopied: (v: boolean) => void }) {
  const v = p.realServerView
  const doc = v.activeDoc!
  const hasConn = Boolean(v.activeConnId)

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="text-sm font-bold text-foreground">{doc.title}</h2>
          <button type="button" onClick={p.closeDoc} className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground focus-visible:shadow-[var(--focus-ring)]">
            <X className="h-3.5 w-3.5" />
            关闭文档
          </button>
        </div>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {doc.content}
        </pre>
      </div>

      {/* 发送到服务器 */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <UploadCloud className="h-3.5 w-3.5 text-primary" />
          发送到服务器
        </h3>
        {!hasConn ? (
          <p className="mt-1.5 text-[11px] text-muted-foreground">先在「服务器终端」页签里进入一台服务器的终端，这里就能把文档上传过去、并按命令序列一键部署。</p>
        ) : (
          <>
            <p className="mt-1 text-[11px] text-muted-foreground">
              当前目标：<b className="text-foreground">{v.activeConn?.label}</b>（{v.activeConn?.connType === "manual" ? `仅人工 · ${v.activeConn.panelUrl}` : v.activeConn?.connType === "api-cli" ? `Instabox · ${v.activeConn.machine}` : `${v.activeConn?.username}@${v.activeConn?.host}` }）
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={v.uploadPath}
                onChange={(e) => p.setUploadPath(e.target.value)}
                placeholder="上传目录，如 /opt/mes/docs/"
                aria-label="上传目录"
                className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={p.sendDocToServer}
                disabled={v.docBusy || !v.activeConn?.canUpload}
                title={!v.activeConn?.canUpload ? "此连接不支持自动上传" : undefined}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40 focus-visible:shadow-[var(--focus-ring)]"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                上传文档（确认后执行）
              </button>
            </div>
            {doc.commands.length > 0 && (
              <div className="mt-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                  <Rocket className="h-3.5 w-3.5 text-primary" />
                  一键部署命令序列（每条单独确认，执行结果显示在上方通知栏）
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {doc.commands.map((c, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5">
                      <span className="text-[11px] text-muted-foreground">{i + 1}.</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold text-foreground">{c.label}</span>
                        <code className="block truncate font-mono text-[10px] text-muted-foreground">{c.cmd}</code>
                      </span>
                      <button
                        type="button"
                        onClick={() => p.runDeployStep(i)}
                        disabled={v.docBusy || !v.activeConn?.canExec}
                        className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-40 focus-visible:shadow-[var(--focus-ring)]"
                      >
                        {v.docBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : "执行"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* 发给 AI agent */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <Bot className="h-3.5 w-3.5 text-primary" />
          发送给我的 AI agent
        </h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          把文档打包成「部署任务包」（任务目标 + 服务器信息 + 文档全文 + 建议命令序列），三种方式交给你的 AI agent 去执行。
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const ok = await p.copyTaskPack()
              setCopied(ok)
              setTimeout(() => setCopied(false), 1500)
            }}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-foreground hover:border-primary hover:text-primary focus-visible:shadow-[var(--focus-ring)]"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "已复制任务包" : "复制任务包"}
          </button>
          <button
            type="button"
            onClick={p.downloadTaskPack}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-foreground hover:border-primary hover:text-primary focus-visible:shadow-[var(--focus-ring)]"
          >
            <Download className="h-3.5 w-3.5" />
            下载 .md 文件
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={v.webhookUrl}
            onChange={(e) => p.setWebhookUrl(e.target.value)}
            placeholder="你的 AI agent 接收地址（http/https webhook）"
            aria-label="AI agent 接收地址"
            className="min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={p.pushTaskPack}
            disabled={v.docBusy}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40 focus-visible:shadow-[var(--focus-ring)]"
          >
            <Bot className="h-3.5 w-3.5" />
            推送任务包
          </button>
        </div>
        {v.agentResult && <p className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">{v.agentResult}</p>}
      </div>
    </div>
  )
}

/** 服务器连接登记弹窗 */
function SrvConnDialog({ p }: { p: P }) {
  const [srvProdAck, setSrvProdAck] = useState(false)
  useEffect(() => { setSrvProdAck(false) }, [p.realServerView.srvForm.host])
  const v = p.realServerView
  const f = v.srvForm
  const setPlatform = (platform: typeof f.platform) => {
    const presets = {
      generic: { connType: "ssh" as const, transport: "direct" as const, host: "", port: "22", username: "root", authType: "password" as const },
      instabox: { connType: "api-cli" as const, transport: "direct" as const, host: "", port: "22", username: "", authType: "none" as const },
      cloady: { connType: "ssh" as const, transport: "direct" as const, host: "ssh.cloady.io", port: "22", username: "", authType: "password" as const },
      bohrium: { connType: "ssh" as const, transport: "tailscale" as const, host: "", port: "22", username: "root", authType: "none" as const },
      uppcoder: { connType: "ssh" as const, transport: "direct" as const, host: "", port: "2222", username: "", authType: "key" as const },
    }
    p.updateSrvForm({ ...presets[platform], platform, label: f.id ? f.label : platform === "instabox" ? "Instabox dev" : platform === "cloady" ? "Cloady 演练机" : platform === "bohrium" ? "Bohrium 演练机" : platform === "uppcoder" ? "Uppcoder Stack" : f.label })
  }
  const switchCloadyMode = (connType: "ssh" | "manual") => p.updateSrvForm(connType === "manual"
    ? { connType, transport: "direct", host: "", username: "", authType: "none" }
    : { connType, transport: "direct", host: "ssh.cloady.io", port: "22", username: "", authType: "password" })
  const switchBohriumMode = (transport: "tailscale" | "direct") => p.updateSrvForm(transport === "tailscale"
    ? { connType: "ssh", transport, host: "", port: "22", username: "root", authType: "none" }
    : { connType: "ssh", transport, host: "", port: "22", username: "root", authType: "key" })
  const mode = f.connType
  const isSsh = mode === "ssh"
  const needsCredentials = isSsh && f.transport !== "tailscale"
  const panelUrl = v.srvTestResult?.panelUrl
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="服务器连接登记">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">{f.id ? "编辑服务器连接" : "登记我的演练服务器"}</h2>
          <button type="button" onClick={p.closeSrvDialog} aria-label="关闭" className="ml-auto rounded p-1 text-muted-foreground hover:text-foreground focus-visible:shadow-[var(--focus-ring)]"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          所有凭据仅存本站服务端且列表不回显。真实服务器命令会实际执行；请只登记专用演练环境，勿填生产密钥。
        </p>
        {!f.id && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {([
              ["generic", "通用 SSH"], ["instabox", "Instabox"], ["cloady", "Cloady"], ["bohrium", "Bohrium"], ["uppcoder", "Uppcoder"],
            ] as const).map(([platform, title]) => (
              <button key={platform} type="button" onClick={() => setPlatform(platform)} aria-pressed={f.platform === platform}
                className={`rounded-lg border px-3 py-2 text-left text-xs ${f.platform === platform ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"}`}>
                <span className="block font-semibold">{title}</span>
                <span className="mt-0.5 block text-[10px]">{platform === "instabox" ? "API-CLI" : platform === "cloady" ? "SSH / 网页终端" : platform === "bohrium" ? "Tailscale / SSH" : platform === "uppcoder" ? "SSH 私钥" : "SSH 直连/跳板"}</span>
              </button>
            ))}
          </div>
        )}
        {f.platform === "cloady" && (
          <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
            <p className="font-semibold text-foreground">选择连接方式</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => switchCloadyMode("ssh")} className={`rounded-md border px-2 py-1 ${mode === "ssh" ? "border-primary text-primary" : "border-border"}`}>按服务凭证 SSH</button>
              <button type="button" onClick={() => switchCloadyMode("manual")} className={`rounded-md border px-2 py-1 ${mode === "manual" ? "border-primary text-primary" : "border-border"}`}>网页终端（仅人工）</button>
            </div>
            {mode === "ssh" ? <p>面板 Terminal 的钥匙图标可查看单服务凭证。ssh.cloady.io 仅有 IPv6；本站出口若无 IPv6 会连不上。Alpine 用 apk、没有 systemd、只有一个外部端口；临时层在 Restart、Stop/Start 或 Redeploy 后会清空文件和已装包，重启后需脚本重建。</p> : <p>登记应用面板链接和备注；本站不会自动执行或上传，测试会返回 MANUAL_ONLY 并给出打开链接。</p>}
          </div>
        )}
        {f.platform === "bohrium" && (
          <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
            <p className="font-semibold text-foreground">选择连接方式</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => switchBohriumMode("tailscale")} className={`rounded-md border px-2 py-1 ${f.transport === "tailscale" ? "border-primary text-primary" : "border-border"}`}>Tailnet SSH</button>
              <button type="button" onClick={() => switchBohriumMode("direct")} className={`rounded-md border px-2 py-1 ${f.transport === "direct" ? "border-primary text-primary" : "border-border"}`}>网关 SSH 转发</button>
            </div>
            {f.transport === "tailscale" ? <p>本站后端必须先加入并获准进入你的 tailnet。SSH 会话约 25–30 秒可能断开，使用短小、可重入命令。备选：容器内运行 sshd，通过香港网关 frp 映射 TCP 端口后按普通 SSH 密钥连接。</p> : <p>填入 frp 网关地址和映射端口，以密钥登录；这是普通 SSH 连接。</p>}
          </div>
        )}
        {f.platform === "uppcoder" && <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-muted-foreground">待实测：Stack 中先 Add to stack 勾选 SSH，再到 Settings → SSH Keys 添加公钥。用户名填写应用自己的用户，不是门户账号；端口 2222，只支持私钥。浏览器 VS Code 终端可作人工兜底。</p>}
        {f.platform === "instabox" && <p className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">需要本站服务器安装 Instabox CLI；API key 只在表单提交时传到服务端，不进入代码或仓库。仅需 machines:read + machines:write 权限，不要授予 delete。机器 Debian，user 有 sudo，/data 为持久盘；闲置暂停或冷却时稍后重试。</p>}
        {f.platform === "generic" && <p className="mt-3 text-[11px] text-muted-foreground">SSH 可选直连或通过另一条已登记 SSH 连接跳转。凭据留空编辑时会保留服务端旧值。</p>}
        <DrillEnvironmentNotice host={f.host} confirmed={srvProdAck} onConfirmChange={setSrvProdAck} target="server" />
        <div className="mt-3 space-y-2.5">
          <label className="block"><span className="text-[11px] font-semibold text-muted-foreground">服务器名称</span><input value={f.label} onChange={(e) => p.updateSrvForm({ label: e.target.value })} placeholder="如：Instabox dev" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none" /></label>
          {mode === "manual" ? <>
            <label className="block"><span className="text-[11px] font-semibold text-muted-foreground">平台面板 URL</span><input value={f.panelUrl} onChange={(e) => p.updateSrvForm({ panelUrl: e.target.value })} placeholder="https://…" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none" /></label>
            <p className="text-[10px] text-muted-foreground">可在服务器名称或备注中写应用/环境；此模式不会启用执行和上传。</p>
          </> : mode === "api-cli" ? <>
            <label className="block"><span className="text-[11px] font-semibold text-muted-foreground">机器名或 ID</span><input value={f.machine} onChange={(e) => p.updateSrvForm({ machine: e.target.value })} placeholder="dev" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none" /></label>
            <label className="block"><span className="text-[11px] font-semibold text-muted-foreground">Instabox API key{f.id ? "（留空 = 保留原 key）" : ""}</span><input type="password" value={f.apiKey} onChange={(e) => p.updateSrvForm({ apiKey: e.target.value })} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none" /></label>
            <label className="block"><span className="text-[11px] font-semibold text-muted-foreground">CLI 路径（可选）</span><input value={f.cliPath} onChange={(e) => p.updateSrvForm({ cliPath: e.target.value })} placeholder="instabox" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none" /></label>
          </> : <>
            <div className="grid grid-cols-[1fr_100px] gap-2">
              <label className="block"><span className="text-[11px] font-semibold text-muted-foreground">{f.transport === "tailscale" ? "Tailnet 设备名" : "主机地址"}</span><input value={f.host} onChange={(e) => p.updateSrvForm({ host: e.target.value })} placeholder={f.platform === "uppcoder" ? "<stack>-editor.<server>.websson.cloud" : f.platform === "cloady" ? "ssh.cloady.io" : "IP 或域名"} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none" /></label>
              <label className="block"><span className="text-[11px] font-semibold text-muted-foreground">SSH 端口</span><input value={f.port} onChange={(e) => p.updateSrvForm({ port: e.target.value })} inputMode="numeric" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none" /></label>
            </div>
            <label className="block"><span className="text-[11px] font-semibold text-muted-foreground">用户名{f.platform === "uppcoder" ? "（应用自身用户，不是门户账号）" : ""}</span><input value={f.username} onChange={(e) => p.updateSrvForm({ username: e.target.value })} autoComplete="off" readOnly={f.transport === "tailscale"} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none read-only:opacity-70" /></label>
            {f.platform === "generic" && <label className="block"><span className="text-[11px] font-semibold text-muted-foreground">SSH 传输方式</span><select value={f.transport} onChange={(e) => p.updateSrvForm({ transport: e.target.value as typeof f.transport })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"><option value="direct">直连</option><option value="jump">已登记跳板机</option></select></label>}
            {f.transport === "jump" && <label className="block"><span className="text-[11px] font-semibold text-muted-foreground">跳板连接</span><select value={f.jumpSecretRef} onChange={(e) => p.updateSrvForm({ jumpSecretRef: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"><option value="">选择已登记 SSH 连接</option>{v.serverConns.filter((item) => item.id !== f.id && item.connType === "ssh" && item.transport !== "tailscale").map((item) => <option key={item.id} value={item.id}>{item.label} · {item.host}</option>)}</select></label>}
            {needsCredentials && <>
              {f.platform !== "uppcoder" && <div className="flex gap-2">
                <button type="button" onClick={() => p.updateSrvForm({ authType: "password" })} className={`flex-1 rounded-lg border px-3 py-1.5 text-xs ${f.authType === "password" ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-muted-foreground"}`}>密码认证</button>
                <button type="button" onClick={() => p.updateSrvForm({ authType: "key" })} className={`flex-1 rounded-lg border px-3 py-1.5 text-xs ${f.authType === "key" ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-muted-foreground"}`}>私钥认证</button>
              </div>}
              {f.authType === "password" && f.platform !== "uppcoder" ? <label className="block"><span className="text-[11px] font-semibold text-muted-foreground">密码{f.id ? "（留空 = 保留原密码）" : ""}</span><input type="password" value={f.password} onChange={(e) => p.updateSrvForm({ password: e.target.value })} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none" /></label> : <label className="block"><span className="text-[11px] font-semibold text-muted-foreground">私钥内容{f.id ? "（留空 = 保留原私钥）" : "（粘贴私钥全文）"}</span><textarea value={f.privateKey} onChange={(e) => p.updateSrvForm({ privateKey: e.target.value })} rows={5} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----\n…" className="mt-1 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none" /></label>}
            </>}
            {f.transport === "tailscale" && <p className="text-[10px] text-muted-foreground">免密身份认证；本站后端须已加入并获准使用该 tailnet。</p>}
          </>}
        </div>
        {v.srvTestResult && <div className={`mt-2 rounded-lg px-3 py-2 text-[11px] ${v.srvTestResult.ok ? "border border-primary/30 bg-primary/5 text-primary" : "border border-destructive/40 bg-destructive/5 text-destructive"}`}>
          <p>{v.srvTestResult.message}</p>
          {panelUrl && /^https?:\/\//i.test(panelUrl) && <a href={panelUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block underline">打开平台面板</a>}
        </div>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={p.testSrvForm} disabled={v.srvBusy} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 focus-visible:shadow-[var(--focus-ring)]">{v.srvBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Server className="h-3.5 w-3.5" />}测试连接</button>
          <button type="button" onClick={p.saveSrvForm} disabled={v.srvBusy || (Boolean(f.host) && looksLikeProductionHost(f.host) && !srvProdAck)} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40 focus-visible:shadow-[var(--focus-ring)]">保存连接</button>
        </div>
      </div>
    </div>
  )
}
