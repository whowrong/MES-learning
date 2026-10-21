// 真实服务器模式 Logic：SSH 连接管理 + 真实终端（危险命令确认后执行）+ 文档库（发送到服务器 / 发给 AI agent）
// 凭据明文只在表单提交瞬间存在；所有真实操作有预览+确认环节
import { useCallback, useEffect, useMemo, useState } from "react"
import { getBasename } from "@/lib/pb"
import { GLOBAL_DANGER, type TerminalLine } from "@/game/opsTerminal"
import {
  deployDocsApi,
  sshlabApi,
  type DeployDoc,
  type NewServerConnection,
  type ServerConnectionView,
  type SshExecResult,
} from "@/lib/labApi"

/** 预置部署文档模板（内容驱动，public/content/ops-training/deploy-docs.json） */
export interface DeployDocTemplate {
  id: string
  title: string
  doc_type: string
  summary: string
  content: string
  commands: Array<{ label: string; cmd: string }>
}

export interface ServerForm {
  id?: string
  label: string
  host: string
  port: string
  username: string
  authType: "password" | "key"
  password: string
  privateKey: string
}

const EMPTY_SERVER_FORM: ServerForm = { label: "", host: "", port: "22", username: "root", authType: "password", password: "", privateKey: "" }

/** 待确认的真实操作（危险命令 / 上传 / 部署命令） */
export interface PendingAction {
  kind: "danger-cmd" | "upload" | "deploy-step"
  title: string
  detail: string
  command?: string
  run: () => void | Promise<void>
}

function docUrl(): string {
  const base = getBasename().replace(/\/$/, "")
  return `${base}/content/ops-training/deploy-docs.json`
}

/** 命中全局危险命令表则返回拦截教学文案 */
function matchGlobalDanger(cmd: string): string | null {
  for (const d of GLOBAL_DANGER) {
    try {
      if (new RegExp(d.pattern, "i").test(cmd)) return d.output
    } catch {
      // 忽略坏正则（红线测试另行把关）
    }
  }
  return null
}

export function useRealServer() {
  // 连接管理
  const [serverConns, setServerConns] = useState<ServerConnectionView[]>([])
  const [srvForm, setSrvForm] = useState<ServerForm>(EMPTY_SERVER_FORM)
  const [srvDialogOpen, setSrvDialogOpen] = useState(false)
  const [srvTestResult, setSrvTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [srvBusy, setSrvBusy] = useState(false)
  const [srvNotice, setSrvNotice] = useState("")

  // 真实终端
  const [activeConnId, setActiveConnId] = useState("")
  const [realLines, setRealLines] = useState<TerminalLine[]>([])
  const [realBusy, setRealBusy] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  // 文档库
  const [docTemplates, setDocTemplates] = useState<DeployDocTemplate[]>([])
  const [userDocs, setUserDocs] = useState<DeployDoc[]>([])
  const [activeDoc, setActiveDoc] = useState<{ title: string; content: string; commands: Array<{ label: string; cmd: string }> } | null>(null)
  const [uploadPath, setUploadPath] = useState("/opt/mes/docs/")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [docBusy, setDocBusy] = useState(false)
  const [agentResult, setAgentResult] = useState("")

  const refreshConns = useCallback(async () => {
    try {
      const r = await sshlabApi.listConnections()
      setServerConns(r.connections ?? [])
    } catch {
      // 后端未就绪时静默（面板会显示空列表）
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      await refreshConns()
      try {
        const res = await fetch(docUrl())
        if (res.ok) {
          const data = (await res.json()) as { docs?: DeployDocTemplate[] }
          if (!cancelled) setDocTemplates(Array.isArray(data.docs) ? data.docs : [])
        }
      } catch {
        // 模板加载失败不阻塞
      }
      try {
        const r = await deployDocsApi.list()
        if (!cancelled) setUserDocs(r.items ?? [])
      } catch {
        // 文档库加载失败不阻塞
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [refreshConns])

  const activeConn = useMemo(() => serverConns.find((c) => c.id === activeConnId) ?? null, [serverConns, activeConnId])

  // ── 连接管理 ─────────────────────────────────────────────
  const openSrvDialog = useCallback((existing?: ServerConnectionView) => {
    if (existing) {
      setSrvForm({
        id: existing.id,
        label: existing.label,
        host: existing.host,
        port: String(existing.port ?? 22),
        username: existing.username,
        authType: existing.authType === "key" ? "key" : "password",
        password: "",
        privateKey: "",
      })
    } else {
      setSrvForm(EMPTY_SERVER_FORM)
    }
    setSrvTestResult(null)
    setSrvDialogOpen(true)
  }, [])

  const closeSrvDialog = useCallback(() => setSrvDialogOpen(false), [])

  const updateSrvForm = useCallback((patch: Partial<ServerForm>) => {
    setSrvForm((prev) => ({ ...prev, ...patch }))
    setSrvTestResult(null)
  }, [])

  const buildInlineSrv = useCallback((): NewServerConnection | null => {
    if (!srvForm.label.trim() || !srvForm.host.trim() || !srvForm.username.trim()) return null
    const conn: NewServerConnection = {
      id: srvForm.id,
      label: srvForm.label.trim(),
      host: srvForm.host.trim(),
      port: srvForm.port ? Number(srvForm.port) : 22,
      username: srvForm.username.trim(),
    }
    if (srvForm.authType === "key") {
      if (srvForm.privateKey.trim()) conn.privateKey = srvForm.privateKey
      else if (!srvForm.id) return null
    } else {
      if (srvForm.password) conn.password = srvForm.password
      else if (!srvForm.id) return null
    }
    return conn
  }, [srvForm])

  const testSrvForm = useCallback(async () => {
    const inline = buildInlineSrv()
    if (!inline) {
      setSrvTestResult({ ok: false, message: "名称、主机、用户名和凭据必填（编辑时凭据留空 = 用已存的）" })
      return
    }
    setSrvBusy(true)
    try {
      const r = await sshlabApi.test(inline.id && !inline.password && !inline.privateKey ? inline.id : undefined, inline)
      setSrvTestResult({ ok: Boolean(r.ok), message: r.ok ? "连接成功：" + (r.stdout || "").split("\n").filter(Boolean).slice(0, 2).join(" | ") : (r.error || "连接失败") })
    } catch (e) {
      setSrvTestResult({ ok: false, message: e instanceof Error ? e.message : "连接失败" })
    } finally {
      setSrvBusy(false)
    }
  }, [buildInlineSrv])

  const saveSrvForm = useCallback(async () => {
    const inline = buildInlineSrv()
    if (!inline) {
      setSrvTestResult({ ok: false, message: "名称、主机、用户名和凭据必填" })
      return
    }
    setSrvBusy(true)
    try {
      const r = await sshlabApi.saveConnection(inline)
      if (r.ok && r.connection) {
        await refreshConns()
        setSrvDialogOpen(false)
        setSrvNotice(`服务器「${r.connection.label}」已保存（凭据只存在服务端）`)
      } else {
        setSrvTestResult({ ok: false, message: r.error || "保存失败" })
      }
    } catch (e) {
      setSrvTestResult({ ok: false, message: e instanceof Error ? e.message : "保存失败" })
    } finally {
      setSrvBusy(false)
    }
  }, [buildInlineSrv, refreshConns])

  const deleteSrvConn = useCallback(
    async (id: string) => {
      try {
        await sshlabApi.deleteConnection(id)
        await refreshConns()
        if (activeConnId === id) {
          setActiveConnId("")
          setRealLines([])
        }
      } catch {
        setSrvNotice("删除连接失败")
      }
    },
    [activeConnId, refreshConns],
  )

  // ── 真实终端 ─────────────────────────────────────────────
  const openRealTerminal = useCallback(
    (connId: string) => {
      const conn = serverConns.find((c) => c.id === connId)
      if (!conn) return
      setActiveConnId(connId)
      setSrvNotice("")
      setRealLines([
        { kind: "info", text: `已连接 ${conn.username}@${conn.host}:${conn.port}（${conn.label}）` },
        { kind: "warn", text: "⚠ 这是真实服务器：每条命令都会实际执行。危险命令会先弹确认。" },
      ])
    },
    [serverConns],
  )

  const closeRealTerminal = useCallback(() => {
    setActiveConnId("")
    setRealLines([])
    setPendingAction(null)
  }, [])

  const execRemote = useCallback(
    async (cmd: string) => {
      if (!activeConnId) return
      setRealBusy(true)
      try {
        const r: SshExecResult = await sshlabApi.exec(activeConnId, cmd)
        setRealLines((prev) => {
          const next = [...prev]
          if (r.ok) {
            if (r.stdout) next.push({ kind: "out", text: r.stdout.replace(/\n$/, "") })
            if (r.stderr) next.push({ kind: "warn", text: r.stderr.replace(/\n$/, "") })
            if (!r.stdout && !r.stderr) next.push({ kind: "out", text: `(无输出，退出码 ${r.code ?? 0})` })
            if (r.code !== 0 && r.code !== undefined) next.push({ kind: "warn", text: `退出码 ${r.code}` })
          } else {
            next.push({ kind: "warn", text: `执行失败：${r.error || "未知错误"}` })
          }
          return next
        })
      } catch (e) {
        setRealLines((prev) => [...prev, { kind: "warn", text: `执行失败：${e instanceof Error ? e.message : String(e)}` }])
      } finally {
        setRealBusy(false)
      }
    },
    [activeConnId],
  )

  const sendRealCommand = useCallback(
    (cmd: string) => {
      const trimmed = cmd.trim()
      if (!trimmed || realBusy || !activeConnId) return
      setRealLines((prev) => [...prev, { kind: "cmd", text: trimmed }])
      const danger = matchGlobalDanger(trimmed)
      if (danger) {
        setPendingAction({
          kind: "danger-cmd",
          title: "危险命令确认",
          detail: danger,
          command: trimmed,
          run: () => execRemote(trimmed),
        })
        return
      }
      void execRemote(trimmed)
    },
    [realBusy, activeConnId, execRemote],
  )

  const confirmPending = useCallback(() => {
    const p = pendingAction
    setPendingAction(null)
    if (p) void p.run()
  }, [pendingAction])

  const cancelPending = useCallback(() => {
    const p = pendingAction
    setPendingAction(null)
    if (p?.kind === "danger-cmd") {
      setRealLines((prev) => [...prev, { kind: "info", text: "（已取消执行）" }])
    }
  }, [pendingAction])

  /** 复制真实终端全部会话（含服务器信息头，供贴给 AI 请教） */
  const copyRealSession = useCallback(async (): Promise<boolean> => {
    if (!activeConn) return false
    const parts = [
      `【真实服务器会话】${activeConn.label}（${activeConn.username}@${activeConn.host}:${activeConn.port}）`,
      "—— 命令与输出 ——",
      ...realLines.map((l) => (l.kind === "cmd" ? `$ ${l.text}` : l.text)),
    ]
    const text = parts.join("\n")
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch {
      // 落入兜底
    }
    try {
      const ta = document.createElement("textarea")
      ta.value = text
      ta.setAttribute("readonly", "")
      ta.style.position = "fixed"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      return true
    } catch {
      return false
    }
  }, [activeConn, realLines])

  // ── 文档库 ─────────────────────────────────────────────
  const openTemplateDoc = useCallback((tpl: DeployDocTemplate) => {
    setActiveDoc({ title: tpl.title, content: tpl.content, commands: tpl.commands ?? [] })
    setUploadPath("/opt/mes/docs/")
    setAgentResult("")
  }, [])

  const openUserDoc = useCallback((doc: DeployDoc) => {
    const commands = (doc.commands || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((cmd, i) => ({ label: `步骤 ${i + 1}`, cmd }))
    setActiveDoc({ title: doc.title, content: doc.content, commands })
    setUploadPath("/opt/mes/docs/")
    setAgentResult("")
  }, [])

  const closeDoc = useCallback(() => setActiveDoc(null), [])

  const saveUserDoc = useCallback(
    async (title: string, content: string, commands: string) => {
      setDocBusy(true)
      try {
        await deployDocsApi.create({ title, content, commands, doc_type: "自建文档" })
        const r = await deployDocsApi.list()
        setUserDocs(r.items ?? [])
        setSrvNotice(`文档「${title}」已保存`)
      } catch (e) {
        setSrvNotice(e instanceof Error ? e.message : "文档保存失败")
      } finally {
        setDocBusy(false)
      }
    },
    [],
  )

  const deleteUserDoc = useCallback(async (id: string) => {
    try {
      await deployDocsApi.remove(id)
      const r = await deployDocsApi.list()
      setUserDocs(r.items ?? [])
    } catch {
      setSrvNotice("文档删除失败")
    }
  }, [])

  /** 发送文档到服务器：先预览确认上传，再（可选）逐条确认执行部署命令 */
  const sendDocToServer = useCallback(() => {
    if (!activeDoc || !activeConnId) return
    const fileName = uploadPath.replace(/\/$/, "") + "/" + activeDoc.title.replace(/[\\/:*?"<>|\s]+/g, "_") + ".md"
    setPendingAction({
      kind: "upload",
      title: "确认上传文档到服务器？",
      detail: `目标路径：${fileName}\n文档：${activeDoc.title}（${activeDoc.content.length} 字符）`,
      run: async () => {
        setDocBusy(true)
        try {
          const r = await sshlabApi.upload(activeConnId, fileName, activeDoc.content)
          setSrvNotice(r.ok ? `文档已上传到 ${fileName}` : (r.error || "上传失败"))
        } catch (e) {
          setSrvNotice(e instanceof Error ? e.message : "上传失败")
        } finally {
          setDocBusy(false)
        }
      },
    })
  }, [activeDoc, activeConnId, uploadPath])

  /** 一键部署：逐条预览确认执行文档附带的命令 */
  const runDeployStep = useCallback(
    (index: number) => {
      if (!activeDoc || !activeConnId) return
      const step = activeDoc.commands[index]
      if (!step) return
      setPendingAction({
        kind: "deploy-step",
        title: `确认执行部署命令 ${index + 1}/${activeDoc.commands.length}？`,
        detail: `${step.label}\n命令将在你的真实服务器上执行。`,
        command: step.cmd,
        run: async () => {
          setDocBusy(true)
          try {
            const r = await sshlabApi.exec(activeConnId, step.cmd, 120000)
            setSrvNotice(
              r.ok
                ? `「${step.label}」执行完成（退出码 ${r.code ?? 0}）${r.stdout ? "：" + r.stdout.slice(0, 120) : ""}`
                : `「${step.label}」执行失败：${r.error || ""}`,
            )
          } catch (e) {
            setSrvNotice(e instanceof Error ? e.message : "执行失败")
          } finally {
            setDocBusy(false)
          }
        },
      })
    },
    [activeDoc, activeConnId],
  )

  /** 组「部署任务包」markdown：给 AI agent 的完整上下文 */
  const buildTaskPack = useCallback((): string => {
    if (!activeDoc) return ""
    const connDesc = activeConn
      ? `目标服务器：${activeConn.username}@${activeConn.host}:${activeConn.port}（${activeConn.label}，SSH 可登录）`
      : "目标服务器：未在本页连接（请把服务器信息补充给 agent）"
    const cmdSection =
      activeDoc.commands.length > 0
        ? "\n\n## 建议命令序列（按顺序执行，每步确认输出再继续）\n" + activeDoc.commands.map((c, i) => `${i + 1}. ${c.label}\n   \`\`\`bash\n   ${c.cmd}\n   \`\`\``).join("\n")
        : ""
    return `# 部署任务包：${activeDoc.title}

${connDesc}

## 你的任务
阅读下面的部署文档，在目标服务器上完成环境部署。要求：每一步执行前先说明目的，执行后核对输出；遇到报错先诊断再重试，不要盲目重复执行；全部完成后按验收清单逐项确认。

## 部署文档

${activeDoc.content}${cmdSection}
`
  }, [activeDoc, activeConn])

  const copyTaskPack = useCallback(async (): Promise<boolean> => {
    const text = buildTaskPack()
    if (!text) return false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch {
      // 落入兜底
    }
    try {
      const ta = document.createElement("textarea")
      ta.value = text
      ta.setAttribute("readonly", "")
      ta.style.position = "fixed"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      return true
    } catch {
      return false
    }
  }, [buildTaskPack])

  const downloadTaskPack = useCallback(() => {
    const text = buildTaskPack()
    if (!text || !activeDoc) return
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `deploy-task-${activeDoc.title.replace(/[\\/:*?"<>|\s]+/g, "_")}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [buildTaskPack, activeDoc])

  const pushTaskPack = useCallback(async () => {
    const text = buildTaskPack()
    if (!text || !webhookUrl.trim()) {
      setAgentResult("先填写你的 AI agent 接收地址（http/https）")
      return
    }
    setDocBusy(true)
    try {
      const r = await sshlabApi.webhook(webhookUrl.trim(), {
        type: "deploy-task",
        title: activeDoc?.title ?? "",
        markdown: text,
      })
      setAgentResult(r.ok ? `已推送（对方返回 ${r.statusCode}）${r.response ? "：" + r.response.slice(0, 100) : ""}` : `推送失败：${r.error || `对方返回 ${r.statusCode}`}`)
    } catch (e) {
      setAgentResult(e instanceof Error ? e.message : "推送失败")
    } finally {
      setDocBusy(false)
    }
  }, [buildTaskPack, webhookUrl, activeDoc])

  const realServerView = useMemo(() => {
    const view = {
      serverConns,
      srvDialogOpen,
      srvForm,
      srvTestResult,
      srvBusy,
      srvNotice,
      activeConn,
      activeConnId,
      realLines,
      realBusy,
      pendingAction,
      docTemplates,
      userDocs,
      activeDoc,
      uploadPath,
      webhookUrl,
      docBusy,
      agentResult,
    }
    return view
  }, [serverConns, srvDialogOpen, srvForm, srvTestResult, srvBusy, srvNotice, activeConn, activeConnId, realLines, realBusy, pendingAction, docTemplates, userDocs, activeDoc, uploadPath, webhookUrl, docBusy, agentResult])

  return {
    realServerView,
    openSrvDialog,
    closeSrvDialog,
    updateSrvForm,
    testSrvForm,
    saveSrvForm,
    deleteSrvConn,
    openRealTerminal,
    closeRealTerminal,
    sendRealCommand,
    confirmPending,
    cancelPending,
    copyRealSession,
    openTemplateDoc,
    openUserDoc,
    closeDoc,
    saveUserDoc,
    deleteUserDoc,
    sendDocToServer,
    runDeployStep,
    copyTaskPack,
    downloadTaskPack,
    pushTaskPack,
    setUploadPath,
    setWebhookUrl,
  }
}
