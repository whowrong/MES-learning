// 数据库实操营内容加载器：从 public/content/db-training/ 运行时拉取（加组/加任务不改代码）
// 格式契约见 .rh/pages/db-training.md 与 docs/content-format.md「数据库实操营」
import { getBasename } from "@/lib/pb"

export type DbGroupId = "query" | "join" | "clean" | "report"

/** 任务校验方式：
 *  - result：把用户 SQL 的执行结果与 expect 对比（查询类任务）
 *  - state：用户执行变更后提交，后端跑 check.sql 验证库状态与 expect 一致（清洗类任务） */
export interface DbTaskCheck {
  mode: "result" | "state"
  sql: string
  expect: unknown[][]
}

export interface DbTask {
  id: string
  title: string
  difficulty: string
  minutes: number
  scene: string
  goal: string
  starterSql?: string
  check: DbTaskCheck
  answerSql: string
  hint: string
  explanation: string
  term_ids: string[]
}

export interface DbGroupBank {
  group: DbGroupId
  groupName: string
  brief: string
  tasks: DbTask[]
}

export interface DbIndex {
  groups: Array<{ group: DbGroupId; file: string }>
  rankTexts: Record<string, string>
}

export const DB_GROUP_ORDER: DbGroupId[] = ["query", "join", "clean", "report"]

/** 数据库连接（前端视角：明文密码只在提交瞬间存在，永不回显） */
export type DbConnType = "builtin" | "mysql" | "sqlserver" | "postgres"

export interface DbConnectionView {
  id: string
  label: string
  type: Exclude<DbConnType, "builtin">
  host: string
  port?: number
  database: string
  username: string
  hasSecret: boolean
  createdAt?: string
}

export const DB_TYPE_META: Record<string, { name: string; defaultPort: number; note: string }> = {
  builtin: { name: "内置练习库", defaultPort: 0, note: "预置 MES 业务表与脏数据，随时可重置" },
  mysql: { name: "MySQL / MariaDB", defaultPort: 3306, note: "小厂 MES 最常见的开源库" },
  sqlserver: { name: "SQL Server", defaultPort: 1433, note: "商业 MES 主流库，默认实例端口 1433" },
  postgres: { name: "PostgreSQL", defaultPort: 5432, note: "开源进阶选择，云上托管常见" },
}

function contentUrl(path: string): string {
  const base = getBasename().replace(/\/$/, "")
  return `${base}/content/db-training/${path}`
}

async function fetchJson<T>(url: string, what: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${what}加载失败（HTTP ${res.status}）`)
  return (await res.json()) as T
}

function validateTask(task: DbTask, at: string): void {
  if (!task.title) throw new Error(`${at} 缺标题 title`)
  if (!task.difficulty) throw new Error(`${at} 缺难度 difficulty`)
  if (!Number.isFinite(task.minutes) || task.minutes < 1) throw new Error(`${at} 缺预计时长 minutes`)
  if (!task.scene || task.scene.length < 10) throw new Error(`${at} 业务场景 scene 不完整`)
  if (!task.goal || task.goal.length < 5) throw new Error(`${at} 缺目标 goal`)
  if (!task.check?.sql) throw new Error(`${at} 缺校验 SQL check.sql`)
  if (task.check.mode !== "result" && task.check.mode !== "state") throw new Error(`${at} check.mode 非法`)
  if (!Array.isArray(task.check.expect) || task.check.expect.length === 0) throw new Error(`${at} 缺期望结果 check.expect`)
  for (const row of task.check.expect) {
    if (!Array.isArray(row)) throw new Error(`${at} check.expect 必须是二维数组`)
  }
  if (!task.answerSql) throw new Error(`${at} 缺参考答案 answerSql`)
  if (!task.hint || task.hint.length < 5) throw new Error(`${at} 缺提示 hint`)
  if (!task.explanation || task.explanation.length < 20) throw new Error(`${at} 缺讲解 explanation`)
  if (!Array.isArray(task.term_ids)) throw new Error(`${at} 缺 term_ids（可为空数组）`)
}

/** 校验任务组内容文件结构：坏内容直接报错，不让它渲染到一半崩 */
export function validateDbBank(bank: DbGroupBank): DbGroupBank {
  if (!bank || typeof bank.group !== "string") throw new Error("数据库任务内容缺少 group 字段")
  if (!bank.groupName) throw new Error(`任务组「${bank.group}」缺 groupName`)
  if (!bank.brief || bank.brief.length < 10) throw new Error(`任务组「${bank.group}」缺简介 brief`)
  if (!Array.isArray(bank.tasks) || bank.tasks.length < 2) throw new Error(`任务组「${bank.group}」至少 2 个任务`)
  const ids = new Set<string>()
  for (const task of bank.tasks) {
    const at = `任务组「${bank.group}」任务 ${task.id ?? "?"}`
    if (!task.id) throw new Error(`任务组「${bank.group}」有任务缺 id`)
    if (ids.has(task.id)) throw new Error(`${at} id 重复`)
    ids.add(task.id)
    validateTask(task, at)
  }
  return bank
}

export async function loadDbIndex(): Promise<DbIndex> {
  return fetchJson<DbIndex>(contentUrl("index.json"), "数据库实操营清单")
}

export async function loadDbGroups(): Promise<DbGroupBank[]> {
  const idx = await loadDbIndex()
  const groups: DbGroupBank[] = []
  for (const entry of idx.groups ?? []) {
    const bank = await fetchJson<DbGroupBank>(contentUrl(entry.file), `任务组「${entry.group}」`)
    groups.push(validateDbBank(bank))
  }
  groups.sort((a, b) => DB_GROUP_ORDER.indexOf(a.group) - DB_GROUP_ORDER.indexOf(b.group))
  return groups
}
