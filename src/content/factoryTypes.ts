// 厂型特训营内容加载器：从 public/content/factory-types/ 运行时拉取（加厂型/加题不改代码）
// 格式契约见 .rh/pages/factory-types.md 与 docs/content-format.md「厂型特训营」
import { getBasename } from "@/lib/pb"
import { shuffle } from "@/content/loader"

export type FactoryTypeId = "discrete" | "flow" | "hybrid"

export interface FactoryOption {
  id: string
  text: string
}

/** 典型踩坑案例（档案页第 4 屏） */
export interface FactoryPitfallCase {
  id: string
  scene: string
  consequence: string
  lesson: string
  term_ids: string[]
}

/** 档案页一屏：正文（body，可含 {{term_id}} 标注）或清单（items）或踩坑案例（cases）三选一 */
export interface FactoryBriefPage {
  id: string
  title: string
  body?: string
  items?: string[]
  cases?: FactoryPitfallCase[]
}

/** 场景实战测验题：结构与关卡 quiz 题一致（提交即判定 + 三句话讲解） */
export interface FactoryQuizQuestion {
  id: string
  prompt: string
  options: FactoryOption[]
  answer: string
  term_ids: string[]
  feedback: {
    factory: string
    data: string
    consultant: string
  }
}

export interface FactoryBank {
  type: FactoryTypeId
  typeName: string
  tagline: string
  industries: string[]
  brief: FactoryBriefPage[]
  quiz: {
    perRound: number
    questions: FactoryQuizQuestion[]
  }
}

export interface FactoryIndex {
  types: Array<{ type: FactoryTypeId; file: string }>
  rankTexts: Record<string, string>
}

export const FACTORY_TYPE_ORDER: FactoryTypeId[] = ["discrete", "flow", "hybrid"]

function contentUrl(path: string): string {
  // 预览态挂在 /app-preview/<appid>/ 子路径下：必须按部署前缀拼
  const base = getBasename().replace(/\/$/, "")
  return `${base}/content/factory-types/${path}`
}

async function fetchJson<T>(url: string, what: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${what}加载失败（HTTP ${res.status}）`)
  return (await res.json()) as T
}

/** 校验厂型内容文件结构：坏内容直接报错，不让它渲染到一半崩 */
export function validateFactoryBank(bank: FactoryBank): FactoryBank {
  if (!bank || typeof bank.type !== "string") throw new Error("厂型内容缺少 type 字段")
  if (!bank.typeName) throw new Error(`厂型「${bank.type}」缺 typeName`)
  if (!Array.isArray(bank.brief) || bank.brief.length === 0) throw new Error(`厂型「${bank.type}」缺档案页 brief`)
  for (const page of bank.brief) {
    if (!page.title) throw new Error(`厂型「${bank.type}」档案页 ${page.id ?? "?"} 缺标题`)
    const hasContent = Boolean(page.body) || (Array.isArray(page.items) && page.items.length > 0) || (Array.isArray(page.cases) && page.cases.length > 0)
    if (!hasContent) throw new Error(`厂型「${bank.type}」档案页「${page.title}」没有内容（body/items/cases 全空）`)
  }
  const quiz = bank.quiz
  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) throw new Error(`厂型「${bank.type}」缺测验题库`)
  if (!Number.isFinite(quiz.perRound) || quiz.perRound < 1 || quiz.perRound > quiz.questions.length) {
    throw new Error(`厂型「${bank.type}」perRound 非法（应为 1~题库量）`)
  }
  for (const q of quiz.questions) {
    const at = `厂型「${bank.type}」题 ${q.id ?? "?"}`
    if (!q.prompt) throw new Error(`${at} 缺题干 prompt`)
    if (!Array.isArray(q.options) || q.options.length < 2) throw new Error(`${at} 至少 2 个选项`)
    if (!q.options.some((o) => o.id === q.answer)) throw new Error(`${at} 的 answer 不在选项里`)
    if (!Array.isArray(q.term_ids)) throw new Error(`${at} 缺 term_ids（可为空数组）`)
    if (!q.feedback || !q.feedback.factory || !q.feedback.data || !q.feedback.consultant) {
      throw new Error(`${at} 三句话讲解（factory/data/consultant）不完整`)
    }
  }
  return bank
}

export async function loadFactoryIndex(): Promise<FactoryIndex> {
  return fetchJson<FactoryIndex>(contentUrl("index.json"), "厂型清单")
}

export async function loadFactoryBanks(): Promise<FactoryBank[]> {
  const idx = await loadFactoryIndex()
  const banks: FactoryBank[] = []
  for (const entry of idx.types ?? []) {
    const bank = await fetchJson<FactoryBank>(contentUrl(entry.file), `厂型「${entry.type}」`)
    banks.push(validateFactoryBank(bank))
  }
  // 按固定厂型顺序排列（清单顺序错了也不影响展示）
  banks.sort((a, b) => FACTORY_TYPE_ORDER.indexOf(a.type) - FACTORY_TYPE_ORDER.indexOf(b.type))
  return banks
}

/** 打乱 + 截断抽题（perRound 定格本局） */
export function pickFactoryQuiz(questions: FactoryQuizQuestion[], count: number): FactoryQuizQuestion[] {
  const shuffled = shuffle(questions)
  return count > 0 ? shuffled.slice(0, count) : shuffled
}
