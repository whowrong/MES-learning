// 运维训练营内容加载器：从 public/content/ops-training/ 运行时拉取（加域/加题不改代码）
// 格式契约见 .rh/pages/ops-training.md 与 docs/content-format.md「运维训练营」
import { getBasename } from "@/lib/pb"
import { shuffle } from "@/content/loader"
import type { AmbientRule, DangerRule, TerminalStep } from "@/game/opsTerminal"

export type OpsDomainId = "linux" | "windows" | "cloud" | "integration"
export type OpsKind = "terminal" | "choice" | "order"

/** 事故工单：终端演练开场的背景 / 现象 / 目标 */
export interface OpsTicket {
  background: string
  symptom: string
  objective: string
}

/** 终端演练：逐步输入命令推进，accept 正则命中才算完成一步 */
export interface OpsTerminalDrill {
  id: string
  kind: "terminal"
  title: string
  difficulty: string
  minutes: number
  ticket: OpsTicket
  prompt: string
  steps: TerminalStep[]
  ambient?: AmbientRule[]
  danger?: DangerRule[]
  sop: string[] // 标准操作序列（演练报告回放）
}

export interface OpsOption {
  id: string
  text: string
}

/** 场景决策题：结构与关卡 quiz 一致，三句话讲解字段沿用 factory/data/consultant，
 *  运维语境下的语义 = 现场会怎样 / 系统与数据会怎样 / 运维该怎么做 */
export interface OpsChoiceQuestion {
  id: string
  prompt: string
  options: OpsOption[]
  answer: string
  term_ids: string[]
  feedback: {
    factory: string
    data: string
    consultant: string
  }
}

/** 场景决策组：一组同主题单选题，一次一题提交即判定 */
export interface OpsChoiceGroup {
  id: string
  kind: "choice"
  title: string
  difficulty: string
  minutes: number
  intro: string
  questions: OpsChoiceQuestion[]
}

/** 排障流程排序组：steps 按正确顺序书写，页面加载时打乱 */
export interface OpsOrderGroup {
  id: string
  kind: "order"
  title: string
  difficulty: string
  minutes: number
  intro: string
  maxAttempts: number
  steps: Array<{ id: string; text: string; note: string }>
}

export type OpsItem = OpsTerminalDrill | OpsChoiceGroup | OpsOrderGroup

export interface OpsDomainBank {
  domain: OpsDomainId
  domainName: string
  brief: string
  items: OpsItem[]
}

export interface OpsIndex {
  domains: Array<{ domain: OpsDomainId; file: string }>
  rankTexts: Record<string, string>
}

export const OPS_DOMAIN_ORDER: OpsDomainId[] = ["linux", "windows", "cloud", "integration"]

function contentUrl(path: string): string {
  // 预览态挂在 /app-preview/<appid>/ 子路径下：必须按部署前缀拼
  const base = getBasename().replace(/\/$/, "")
  return `${base}/content/ops-training/${path}`
}

async function fetchJson<T>(url: string, what: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${what}加载失败（HTTP ${res.status}）`)
  return (await res.json()) as T
}

function validateTerminal(drill: OpsTerminalDrill, at: string): void {
  if (!drill.ticket?.background || !drill.ticket.symptom || !drill.ticket.objective) {
    throw new Error(`${at} 事故工单三要素（background/symptom/objective）不完整`)
  }
  if (!drill.prompt) throw new Error(`${at} 缺终端提示符 prompt`)
  if (!Array.isArray(drill.steps) || drill.steps.length < 2) throw new Error(`${at} 演练步骤至少 2 步`)
  for (const s of drill.steps) {
    const sat = `${at} 步骤 ${s.id ?? "?"}`
    if (!s.objective) throw new Error(`${sat} 缺目标 objective`)
    if (!Array.isArray(s.accept) || s.accept.length === 0) throw new Error(`${sat} 缺 accept 命令模式`)
    for (const p of s.accept) {
      try {
        new RegExp(p, "i")
      } catch {
        throw new Error(`${sat} 的 accept 正则无法编译：${p}`)
      }
    }
    if (!s.output) throw new Error(`${sat} 缺模拟输出 output`)
    if (!s.hint) throw new Error(`${sat} 缺提示 hint`)
    if (!s.explain) throw new Error(`${sat} 缺步骤讲解 explain`)
  }
  for (const a of drill.ambient ?? []) {
    try {
      new RegExp(a.pattern, "i")
    } catch {
      throw new Error(`${at} 的 ambient 正则无法编译：${a.pattern}`)
    }
    if (!a.output) throw new Error(`${at} 的 ambient ${a.pattern} 缺输出`)
  }
  for (const d of drill.danger ?? []) {
    try {
      new RegExp(d.pattern, "i")
    } catch {
      throw new Error(`${at} 的 danger 正则无法编译：${d.pattern}`)
    }
  }
  if (!Array.isArray(drill.sop) || drill.sop.length === 0) throw new Error(`${at} 缺标准操作序列 sop`)
}

function validateChoice(group: OpsChoiceGroup, at: string): void {
  if (!group.intro) throw new Error(`${at} 缺说明 intro`)
  if (!Array.isArray(group.questions) || group.questions.length === 0) throw new Error(`${at} 缺题目`)
  for (const q of group.questions) {
    const qat = `${at} 题 ${q.id ?? "?"}`
    if (!q.prompt) throw new Error(`${qat} 缺题干 prompt`)
    if (!Array.isArray(q.options) || q.options.length < 2) throw new Error(`${qat} 至少 2 个选项`)
    if (!q.options.some((o) => o.id === q.answer)) throw new Error(`${qat} 的 answer 不在选项里`)
    if (!Array.isArray(q.term_ids)) throw new Error(`${qat} 缺 term_ids（可为空数组）`)
    if (!q.feedback?.factory || !q.feedback?.data || !q.feedback?.consultant) {
      throw new Error(`${qat} 三句话讲解（factory/data/consultant）不完整`)
    }
  }
}

function validateOrder(group: OpsOrderGroup, at: string): void {
  if (!group.intro) throw new Error(`${at} 缺说明 intro`)
  if (!Array.isArray(group.steps) || group.steps.length < 3) throw new Error(`${at} 排序步骤至少 3 步`)
  if (!Number.isFinite(group.maxAttempts) || group.maxAttempts < 1) throw new Error(`${at} maxAttempts 非法`)
  for (const s of group.steps) {
    if (!s.text) throw new Error(`${at} 步骤 ${s.id ?? "?"} 缺文案 text`)
    if (!s.note) throw new Error(`${at} 步骤 ${s.id ?? "?"} 缺错位讲解 note`)
  }
}

/** 校验运维训练内容文件结构：坏内容直接报错，不让它渲染到一半崩 */
export function validateOpsBank(bank: OpsDomainBank): OpsDomainBank {
  if (!bank || typeof bank.domain !== "string") throw new Error("运维内容缺少 domain 字段")
  if (!bank.domainName) throw new Error(`训练域「${bank.domain}」缺 domainName`)
  if (!bank.brief) throw new Error(`训练域「${bank.domain}」缺简介 brief`)
  if (!Array.isArray(bank.items) || bank.items.length === 0) throw new Error(`训练域「${bank.domain}」缺训练项目`)
  const ids = new Set<string>()
  for (const item of bank.items) {
    const at = `训练域「${bank.domain}」项目 ${item.id ?? "?"}`
    if (!item.id) throw new Error(`训练域「${bank.domain}」有项目缺 id`)
    if (ids.has(item.id)) throw new Error(`${at} id 重复`)
    ids.add(item.id)
    if (!item.title) throw new Error(`${at} 缺标题 title`)
    if (!item.difficulty) throw new Error(`${at} 缺难度 difficulty`)
    if (!Number.isFinite(item.minutes) || item.minutes < 1) throw new Error(`${at} 缺预计时长 minutes`)
    if (item.kind === "terminal") validateTerminal(item, at)
    else if (item.kind === "choice") validateChoice(item, at)
    else if (item.kind === "order") validateOrder(item, at)
    else throw new Error(`${at} 未知 kind：${(item as { kind: string }).kind}`)
  }
  return bank
}

export async function loadOpsIndex(): Promise<OpsIndex> {
  return fetchJson<OpsIndex>(contentUrl("index.json"), "运维训练营清单")
}

export async function loadOpsBanks(): Promise<OpsDomainBank[]> {
  const idx = await loadOpsIndex()
  const banks: OpsDomainBank[] = []
  for (const entry of idx.domains ?? []) {
    const bank = await fetchJson<OpsDomainBank>(contentUrl(entry.file), `训练域「${entry.domain}」`)
    banks.push(validateOpsBank(bank))
  }
  banks.sort((a, b) => OPS_DOMAIN_ORDER.indexOf(a.domain) - OPS_DOMAIN_ORDER.indexOf(b.domain))
  return banks
}

/** 决策组每局抽题（可选，缺省全量） */
export function pickOpsQuestions(questions: OpsChoiceQuestion[], count: number): OpsChoiceQuestion[] {
  const shuffled = shuffle(questions)
  return count > 0 && count < shuffled.length ? shuffled.slice(0, count) : shuffled
}
