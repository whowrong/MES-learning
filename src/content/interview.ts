// 面试题库加载器：从 public/content/interview/ 运行时拉取（加题不改代码）
// 格式契约见 .rh/pages/interview.md 与 docs/content-format.md「面试题库」
import { getBasename } from "@/lib/pb"
import { shuffle } from "@/content/loader"

export type InterviewType = "single" | "multiple" | "judge" | "short"
export type InterviewCategory = "biz" | "data" | "sql" | "ops" | "soft"
export type TierId = "intern" | "campus" | "social" | "exp1" | "exp2" | "exp3"

export interface InterviewOption {
  id: string
  text: string
}

export interface InterviewQuestion {
  id: string
  type: InterviewType
  category: InterviewCategory
  prompt: string
  /** single/multiple 必填；judge 可空（代码生成「对/错」）；short 为空 */
  options: InterviewOption[]
  /** single/judge 为字符串（judge 取值 yes/no）；multiple 为 id 数组；short 为空串 */
  answer: string | string[]
  /** 参考答案/深度解析 */
  reference: string
  /** 面试中说出来让面试官眼前一亮的点 */
  bonus_points: string[]
  term_ids: string[]
  source_hint: string
}

export interface InterviewBank {
  tier: TierId
  tierName: string
  tierHint: string
  questions: InterviewQuestion[]
}

export interface InterviewIndex {
  banks: Array<{ tier: TierId; file: string }>
  rankTexts: Record<string, string>
}

export const TIER_ORDER: TierId[] = ["intern", "campus", "social", "exp1", "exp2", "exp3"]

export const CATEGORY_LABELS: Record<InterviewCategory, string> = {
  biz: "MES 实施业务",
  data: "数据与主数据",
  sql: "数据库 SQL",
  ops: "服务器与运维",
  soft: "项目与软素质",
}

export const CATEGORY_LIST = Object.keys(CATEGORY_LABELS) as InterviewCategory[]

export const TYPE_LABELS: Record<InterviewType, string> = {
  single: "单选",
  multiple: "多选",
  judge: "判断",
  short: "简答自评",
}

/** 组卷题量选项 */
export const PAPER_SIZES = [
  { id: "quick", label: "快速卷", count: 8 },
  { id: "standard", label: "标准卷", count: 15 },
  { id: "all", label: "全部上场", count: 0 },
] as const

export type PaperSizeId = (typeof PAPER_SIZES)[number]["id"]

/** judge 题的固定选项（内容文件里 options 可省略） */
export const JUDGE_OPTIONS: InterviewOption[] = [
  { id: "yes", text: "对，这个说法成立" },
  { id: "no", text: "错，这个说法不成立" },
]

function contentUrl(path: string): string {
  // 预览态挂在 /app-preview/<appid>/ 子路径下：必须按部署前缀拼
  const base = getBasename().replace(/\/$/, "")
  return `${base}/content/interview/${path}`
}

async function fetchJson<T>(url: string, what: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${what}加载失败（HTTP ${res.status}）`)
  return (await res.json()) as T
}

const VALID_TYPES: InterviewType[] = ["single", "multiple", "judge", "short"]
const VALID_CATEGORIES: InterviewCategory[] = ["biz", "data", "sql", "ops", "soft"]

/** 校验题库文件结构：坏题直接报错，不让它渲染到一半崩 */
export function validateBank(bank: InterviewBank): InterviewBank {
  if (!bank || typeof bank.tier !== "string") throw new Error("面试题库缺少 tier 字段")
  if (!Array.isArray(bank.questions) || bank.questions.length === 0) throw new Error(`题库「${bank.tier}」缺 questions`)
  for (const q of bank.questions) {
    const at = `题 ${q.id ?? "?"}`
    if (!VALID_TYPES.includes(q.type)) throw new Error(`${at} 的 type 非法: ${String(q.type)}`)
    if (!VALID_CATEGORIES.includes(q.category)) throw new Error(`${at} 的 category 非法: ${String(q.category)}`)
    if (!q.prompt) throw new Error(`${at} 缺题干 prompt`)
    if (!q.reference) throw new Error(`${at} 缺参考答案 reference`)
    if (!Array.isArray(q.bonus_points) || q.bonus_points.length === 0) throw new Error(`${at} 缺加分点 bonus_points`)
    if (!Array.isArray(q.term_ids)) throw new Error(`${at} 缺 term_ids（可为空数组）`)
    if (q.type === "single") {
      if (!Array.isArray(q.options) || q.options.length < 2) throw new Error(`${at} 单选题至少 2 个选项`)
      if (typeof q.answer !== "string" || !q.options.some((o) => o.id === q.answer)) throw new Error(`${at} 的 answer 不在选项里`)
    } else if (q.type === "multiple") {
      if (!Array.isArray(q.options) || q.options.length < 3) throw new Error(`${at} 多选题至少 3 个选项`)
      if (!Array.isArray(q.answer) || q.answer.length < 2) throw new Error(`${at} 多选题 answer 至少 2 个`)
      if (q.answer.length >= q.options.length) throw new Error(`${at} 多选题必须至少有一个干扰项`)
      for (const a of q.answer) {
        if (!q.options.some((o) => o.id === a)) throw new Error(`${at} 的 answer ${a} 不在选项里`)
      }
    } else if (q.type === "judge") {
      if (q.answer !== "yes" && q.answer !== "no") throw new Error(`${at} 判断题 answer 必须是 yes/no`)
    }
    // short：answer 允许为空串，靠 reference + 自评
  }
  return bank
}

export async function loadInterviewIndex(): Promise<InterviewIndex> {
  return fetchJson<InterviewIndex>(contentUrl("index.json"), "面试题库清单")
}

export async function loadInterviewBanks(): Promise<InterviewBank[]> {
  const idx = await loadInterviewIndex()
  const banks: InterviewBank[] = []
  for (const entry of idx.banks ?? []) {
    const bank = await fetchJson<InterviewBank>(contentUrl(entry.file), `面试题库「${entry.tier}」`)
    banks.push(validateBank(bank))
  }
  // 按固定档位顺序排列（清单顺序错了也不影响展示）
  banks.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))
  return banks
}

/** 按分类过滤 + 打乱 + 截断组卷；count=0 表示全量 */
export function pickPaper(questions: InterviewQuestion[], count: number): InterviewQuestion[] {
  const shuffled = shuffle(questions)
  return count > 0 ? shuffled.slice(0, count) : shuffled
}
