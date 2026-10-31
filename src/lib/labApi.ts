// labApi — 数据库实操营 / 真实服务器模式的后端代理接口封装
// 全部走 getPocketBaseUrl() 相对前缀（__pb 代理），凭据明文只在提交瞬间经过，接口响应永不回传
import { getPocketBaseUrl, pbFetch } from "@/lib/pb"
import type { DbConnectionView } from "@/content/dbTraining"

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await pbFetch(`${getPocketBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  })
  const data = (await res.json().catch(() => null)) as T & { error?: string; message?: string } | null
  if (!res.ok || !data) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data
}

async function get<T>(path: string): Promise<T> {
  const res = await pbFetch(`${getPocketBaseUrl()}${path}`)
  const data = (await res.json().catch(() => null)) as T & { error?: string; message?: string } | null
  if (!res.ok || !data) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data
}

// ---------- 数据库实操营 ----------

export interface SqlExecResult {
  ok: boolean
  columns?: string[]
  rows?: unknown[][]
  affectedRows?: number
  truncated?: boolean
  total?: number
  message?: string
  error?: string
  native?: string
}

export interface NewDbConnection {
  id?: string
  label: string
  type: "mysql" | "sqlserver" | "postgres"
  host: string
  port?: number
  database: string
  username: string
  /** 明文密码只在提交时出现；编辑时留空 = 保留原密码 */
  password?: string
}

export const dblabApi = {
  listConnections: () => get<{ ok: boolean; connections: DbConnectionView[] }>("/api/dblab/connections"),
  saveConnection: (connection: NewDbConnection) =>
    post<{ ok: boolean; connection?: DbConnectionView; error?: string }>("/api/dblab/connections", { connection }),
  deleteConnection: (id: string) => post<{ ok: boolean }>("/api/dblab/connections/delete", { id }),
  /** connectionId = "builtin" 走内置练习库；也可传未保存的 inline connection 直接测试 */
  test: (connectionId?: string, connection?: NewDbConnection) =>
    post<SqlExecResult>("/api/dblab/test", { connectionId, connection }),
  exec: (connectionId: string, sql: string) => post<SqlExecResult>("/api/dblab/exec", { connectionId, sql }),
  /** 模式 B：一次性环境的连接不落连接登记文件，口令只在这次请求里经过 */
  execInline: (connection: LabEnvConnection, sql: string) =>
    post<SqlExecResult>("/api/dblab/exec", { connection, sql }),
  resetBuiltin: () => post<SqlExecResult>("/api/dblab/reset-builtin", {}),
}

// ---------- 真实服务器（SSH） ----------

export interface SshExecResult {
  ok: boolean
  stdout?: string
  stderr?: string
  code?: number
  message?: string
  error?: string
  native?: string
}

export interface NewServerConnection {
  id?: string
  label: string
  host: string
  port?: number
  username: string
  /** 密码与私钥二选一；编辑时留空 = 保留原值 */
  password?: string
  privateKey?: string
}

export interface ServerConnectionView {
  id: string
  label: string
  host: string
  port: number
  username: string
  authType: "password" | "key"
  hasSecret: boolean
  createdAt?: string
}

export const sshlabApi = {
  listConnections: () => get<{ ok: boolean; connections: ServerConnectionView[] }>("/api/sshlab/connections"),
  saveConnection: (connection: NewServerConnection) =>
    post<{ ok: boolean; connection?: ServerConnectionView; error?: string }>("/api/sshlab/connections", { connection }),
  deleteConnection: (id: string) => post<{ ok: boolean }>("/api/sshlab/connections/delete", { id }),
  test: (connectionId?: string, connection?: NewServerConnection) =>
    post<SshExecResult>("/api/sshlab/test", { connectionId, connection }),
  exec: (connectionId: string, command: string, timeoutMs?: number) =>
    post<SshExecResult>("/api/sshlab/exec", { connectionId, command, timeoutMs }),
  /** 模式 B：一次性 sshd 环境的连接不落连接登记文件 */
  execInline: (connection: LabEnvConnection, command: string, timeoutMs?: number) =>
    post<SshExecResult>("/api/sshlab/exec", { connection, command, timeoutMs }),
  upload: (connectionId: string, remotePath: string, content: string) =>
    post<SshExecResult>("/api/sshlab/upload", { connectionId, remotePath, content }),
  /** 把部署任务包 POST 到用户自己的 AI agent 接收端（服务端转发避免跨域） */
  webhook: (url: string, payload: unknown) =>
    post<{ ok: boolean; statusCode?: number; response?: string; error?: string }>("/api/sshlab/webhook", { url, payload }),
}

// ---------- 模式 B：站点自带的一次性 Docker 演练环境 ----------

/** 一次性环境的连接描述（口令只存在于浏览器内存与本次请求里） */
export interface LabEnvConnection {
  type?: "mysql" | "postgres" | "sqlserver"
  host: string
  port: number
  database?: string
  username: string
  password?: string
}

export interface LabEnvInfo {
  id: string
  kind: "db" | "server"
  engine: string
  status: string
  host: string
  port: number
  container: string
  createdAt: string
  connection: LabEnvConnection
}

export interface LabEnvStatusEntry {
  id: string
  container: string
  state: string
  status: string
  detail: string
  createdAt: string
  expired: boolean
}

export const labEnvApi = {
  create: (kind: "db" | "server", dbType?: "mysql" | "postgres" | "sqlserver") =>
    post<{ ok: boolean; env?: LabEnvInfo; error?: string; native?: string }>("/api/labenv/create", { kind, dbType }),
  destroy: (id: string) =>
    post<{ ok: boolean; status?: string; existed?: boolean; error?: string }>("/api/labenv/destroy", { id }),
  status: () =>
    post<{ ok: boolean; envs?: LabEnvStatusEntry[]; swept?: string[]; error?: string }>("/api/labenv/status", {}),
}

// ---------- 演练作业通道（异步提交 + 轮询） ----------

/**
 * 为什么走作业通道：站点外层平台网关对单个 HTTP 请求约 20 秒硬截断
 * （实测 sleep 25s 必返 502），放宽服务端内部超时救不了 502。
 * 所以长耗时的演练步骤一律「提交即返回 jobId，再轮询取结果」。
 */
export type LabJobKind = "db" | "server" | "labenv"

export interface LabJobPayload {
  kind: LabJobKind
  /** labenv 用：create / destroy / status */
  action?: "create" | "destroy" | "status"
  /** labenv 用：一次性环境是数据库还是服务器 */
  envKind?: "db" | "server"
  dbType?: "mysql" | "postgres" | "sqlserver"
  connectionId?: string
  connection?: LabEnvConnection
  sql?: string
  command?: string
  /** 单步执行上限（服务端会再兜一层硬上限） */
  timeoutMs?: number
  id?: string
}

export interface LabJobResult {
  ok?: boolean
  error?: string
  message?: string
  stdout?: string
  stderr?: string
  code?: number
  rows?: unknown[][]
  affectedRows?: number
  columns?: string[]
  env?: LabEnvInfo
  [k: string]: unknown
}

export interface LabJobSubmitResponse {
  ok: boolean
  jobId?: string
  expiresAt?: string
  error?: string
}

export interface LabJobPollResponse {
  ok: boolean
  status?: "pending" | "done"
  result?: LabJobResult
  durationMs?: number
  error?: string
}

export const labJobApi = {
  submit: (payload: LabJobPayload) => post<LabJobSubmitResponse>("/api/labjob/submit", payload),
  poll: (jobId: string) => post<LabJobPollResponse>("/api/labjob/poll", { jobId }),
}

/** 轮询间隔 */
export const LAB_JOB_POLL_INTERVAL_MS = 1500
/** 单步硬上限：5 分钟（服务端同值兜底，避免出现无上限的挂死） */
export const LAB_STEP_TIMEOUT_MS = 300000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface LabJobOutcome {
  ok: boolean
  result?: LabJobResult
  error?: string
  elapsedMs: number
}

/**
 * 提交一个演练作业并轮询到结束。
 * 连续多次轮询失败才判失败（偶发网络抖动不该让整步作废）。
 */
export async function runLabJob(
  payload: LabJobPayload,
  opts?: { timeoutMs?: number; intervalMs?: number },
): Promise<LabJobOutcome> {
  const started = Date.now()
  const timeoutMs = opts?.timeoutMs ?? LAB_STEP_TIMEOUT_MS + 30000
  const intervalMs = opts?.intervalMs ?? LAB_JOB_POLL_INTERVAL_MS
  let submit: LabJobSubmitResponse
  try {
    submit = await labJobApi.submit(payload)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "作业提交失败", elapsedMs: Date.now() - started }
  }
  if (!submit.ok || !submit.jobId) {
    return { ok: false, error: submit.error || "作业提交失败", elapsedMs: Date.now() - started }
  }
  let consecutiveErrors = 0
  for (;;) {
    await sleep(intervalMs)
    let polled: LabJobPollResponse | null = null
    try {
      polled = await labJobApi.poll(submit.jobId)
    } catch {
      polled = null
    }
    if (!polled) {
      consecutiveErrors += 1
      if (consecutiveErrors >= 3) {
        return { ok: false, error: "作业查询连续失败", elapsedMs: Date.now() - started }
      }
      continue
    }
    consecutiveErrors = 0
    if (!polled.ok) {
      return { ok: false, error: polled.error || "作业查询失败", elapsedMs: Date.now() - started }
    }
    if (polled.status === "done") {
      const result = polled.result ?? {}
      return {
        ok: result.ok !== false,
        result,
        error: result.ok !== false ? undefined : result.error || "作业执行失败",
        elapsedMs: Date.now() - started,
      }
    }
    if (Date.now() - started > timeoutMs) {
      return {
        ok: false,
        error: `作业超过 ${Math.round(timeoutMs / 1000)} 秒仍未结束，已放弃等待`,
        elapsedMs: Date.now() - started,
      }
    }
  }
}

// ---------- 部署文档库（MCP collection deploy_docs 的自定义 REST 路由） ----------

export interface DeployDoc {
  id: string
  title: string
  content: string
  commands?: string
  doc_type?: string
  created?: string
  updated?: string
}

export const deployDocsApi = {
  list: () => get<{ items: DeployDoc[] }>("/api/deploy_docs"),
  create: (doc: { title: string; content: string; commands?: string; doc_type?: string }) =>
    post<DeployDoc>("/api/deploy_docs", doc),
  /** MCP 装的 update 路由是 PATCH */
  update: async (id: string, patch: Partial<Omit<DeployDoc, "id">>): Promise<DeployDoc> => {
    const res = await pbFetch(`${getPocketBaseUrl()}/api/deploy_docs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`)
    return data as DeployDoc
  },
  remove: (id: string) => pbFetch(`${getPocketBaseUrl()}/api/deploy_docs/${id}`, { method: "DELETE" }).then(() => ({ ok: true })),
}
