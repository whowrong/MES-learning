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
  upload: (connectionId: string, remotePath: string, content: string) =>
    post<SshExecResult>("/api/sshlab/upload", { connectionId, remotePath, content }),
  /** 把部署任务包 POST 到用户自己的 AI agent 接收端（服务端转发避免跨域） */
  webhook: (url: string, payload: unknown) =>
    post<{ ok: boolean; statusCode?: number; response?: string; error?: string }>("/api/sshlab/webhook", { url, payload }),
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
