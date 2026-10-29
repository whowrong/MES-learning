// 实习准备营内容加载器：从 public/content/career-prep/ 运行时拉取（加题不改代码）
// 格式契约与既有模块一致：内容在 public/content 下，代码只负责加载与校验。
import { getBasename } from "@/lib/pb"

export type CareerQuestionType = "single" | "multiple" | "judge"

export interface CareerOption {
  id: string
  text: string
}

export interface CareerQuestion {
  id: string
  type: CareerQuestionType
  prompt: string
  options: CareerOption[]
  /** single/judge 为选项 id 字符串；multiple 为 id 数组 */
  answer: string | string[]
  /** 参考答案：为什么是这个答案、面试官在意什么 */
  reference: string
  /** 面试时说出来加分的话 */
  bonus_points: string[]
  term_ids: string[]
  source_hint: string
}

/** 知识点卡片：读完就能讲给面试官听的一段 */
export interface CareerCard {
  id: string
  title: string
  summary: string
  /** 要点清单 */
  points: string[]
  /** 常见坑 */
  pitfalls: string[]
  term_ids: string[]
}

/** 顺序题：把若干步骤按正确顺序排好（实施方法论、排查顺序等） */
export interface CareerOrderStep {
  id: string
  text: string
  note: string
}

export interface CareerOrder {
  id: string
  title: string
  intro: string
  steps: CareerOrderStep[]
}

export interface CareerTrack {
  trackId: string
  trackName: string
  subtitle: string
  intro: string
  cards: CareerCard[]
  questions: CareerQuestion[]
  orders: CareerOrder[]
}

export interface CareerTrackEntry {
  id: string
  file: string
  name: string
  hint: string
}

export interface CareerPaperSize {
  id: string
  label: string
  /** 题目数量，0 = 该赛道全部题目 */
  questionCount: number
  /** 顺序题数量，0 = 不出顺序题 */
  orderCount: number
}

export interface CareerIndex {
  tracks: CareerTrackEntry[]
  rankTexts: Record<string, string>
  paperSizes: CareerPaperSize[]
}

export const CAREER_TRACK_ORDER = ["direction1", "direction4", "base"]

export const CAREER_TRACK_LABELS: Record<string, string> = {
  direction1: "方向1 · 工业软件实施与交付",
  direction4: "方向4 · 产线现场信息化实施",
  base: "通用底座",
}

export const CAREER_TYPE_LABELS: Record<CareerQuestionType, string> = {
  single: "单选",
  multiple: "多选",
  judge: "判断",
}

export const JUDGE_OPTIONS: CareerOption[] = [
  { id: "yes", text: "对，这个说法成立" },
  { id: "no", text: "错，这个说法不成立" },
]

function contentUrl(path: string): string {
  const base = getBasename().replace(/\/$/, "")
  return `${base}/content/${path}`
}

async function fetchJson<T>(url: string, what: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${what}加载失败（HTTP ${res.status}）`)
  return (await res.json()) as T
}

/** 校验赛道内容结构：缺关键字段直接报错，不渲染到一半崩 */
export function validateCareerTrack(track: CareerTrack): CareerTrack {
  if (!track || typeof track.trackId !== "string") throw new Error("赛道内容缺少 trackId")
  if (!Array.isArray(track.cards) || track.cards.length === 0) throw new Error(`赛道 ${track.trackId} 缺知识点卡片`)
  if (!Array.isArray(track.questions) || track.questions.length === 0) throw new Error(`赛道 ${track.trackId} 缺题目`)
  for (const c of track.cards) {
    if (!c.id || !c.title) throw new Error(`赛道 ${track.trackId} 的卡片缺 id/title`)
    if (!Array.isArray(c.points) || c.points.length === 0) throw new Error(`卡片 ${c.id} 缺要点`)
    if (!Array.isArray(c.pitfalls) || c.pitfalls.length === 0) throw new Error(`卡片 ${c.id} 缺常见坑`)
  }
  for (const q of track.questions) {
    if (!q.id) throw new Error(`赛道 ${track.trackId} 有题缺 id`)
    if (q.type !== "single" && q.type !== "multiple" && q.type !== "judge") {
      throw new Error(`题 ${q.id} 的 type 非法: ${String(q.type)}`)
    }
    if (!Array.isArray(q.options) || q.options.length < 2) throw new Error(`题 ${q.id} 至少要有 2 个选项`)
    if (!q.options.some((o) => o.id === q.answer) && !(q.type === "multiple" && Array.isArray(q.answer))) {
      throw new Error(`题 ${q.id} 的 answer 不在选项里`)
    }
    if (q.type === "multiple") {
      if (!Array.isArray(q.answer) || q.answer.length === 0) throw new Error(`多选题 ${q.id} 的 answer 必须是数组`)
      for (const a of q.answer) {
        if (!q.options.some((o) => o.id === a)) throw new Error(`多选题 ${q.id} 的答案 ${a} 不在选项里`)
      }
    }
    if (!q.reference || q.reference.length < 40) throw new Error(`题 ${q.id} 的参考答案太短`)
    if (!Array.isArray(q.bonus_points) || q.bonus_points.length === 0) throw new Error(`题 ${q.id} 缺加分点`)
  }
  for (const o of track.orders ?? []) {
    if (!Array.isArray(o.steps) || o.steps.length < 3) throw new Error(`顺序题 ${o.id} 至少要 3 个步骤`)
    const ids = new Set(o.steps.map((s) => s.id))
    if (ids.size !== o.steps.length) throw new Error(`顺序题 ${o.id} 的步骤 id 重复`)
  }
  return track
}

export async function loadCareerIndex(): Promise<CareerIndex> {
  const data = await fetchJson<CareerIndex>(contentUrl("career-prep/index.json"), "实习准备营清单")
  if (!Array.isArray(data?.tracks) || data.tracks.length === 0) throw new Error("实习准备营清单缺赛道登记")
  return data
}

export async function loadCareerTrack(entry: CareerTrackEntry): Promise<CareerTrack> {
  const track = await fetchJson<CareerTrack>(contentUrl(`career-prep/${entry.file}`), `赛道 ${entry.name}`)
  return validateCareerTrack(track)
}

/** 一次加载全部赛道（清单里的文件按登记顺序加载） */
export async function loadCareerTracks(index: CareerIndex): Promise<CareerTrack[]> {
  const out: CareerTrack[] = []
  for (const entry of index.tracks) {
    out.push(await loadCareerTrack(entry))
  }
  return out
}
