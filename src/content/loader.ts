// 内容加载器：从 public/content/ 运行时拉取关卡与术语（加关卡不改代码）
// 类型即内容文件格式契约，字段说明见 docs/content-format.md
import { getBasename } from "@/lib/pb"
import type { ContentSettlement } from "@/game/settlement"

export interface TermDef {
  id: string
  term: string
  dialect: string
  definition: string
  example: string
  knowledge_id: string
  /** 讲解图 id（src/components/illustrations 的 ILLUSTRATIONS 注册表），缺省不显示图 */
  illustration?: string
}

export interface MatchFeedback {
  factory: string
  data: string
  consultant: string
}

export interface MatchQuoteDef {
  id: string
  text: string
  answer: string
  term_ids: string[]
  feedback: MatchFeedback
}

export interface MatchStageDef {
  id: string
  type: "match"
  title: string
  intro: string
  concepts: string[]
  quotes: MatchQuoteDef[]
  /** 每局从题库随机抽取的条数（缺省 = 全量上场） */
  perRound?: number
}

export interface SortStepDef {
  id: string
  text: string
  note: string
}

export interface SortStageDef {
  id: string
  type: "sort"
  title: string
  intro: string
  maxAttempts?: number
  steps: SortStepDef[]
}

/** 场景抉择（单选判断题）：答完立即判定并展示三句话讲解 */
export interface QuizOptionDef {
  id: string
  text: string
}

export interface QuizQuestionDef {
  id: string
  prompt: string
  options: QuizOptionDef[]
  answer: string
  term_ids: string[]
  feedback: MatchFeedback
}

export interface QuizStageDef {
  id: string
  type: "quiz"
  title: string
  intro: string
  questions: QuizQuestionDef[]
  /** 每局从题库随机抽取的题数（缺省 = 全量上场） */
  perRound?: number
}

/** 限时填空速答：题干里用 ____ 挖空，从选项里选词填入，每题限时（秒） */
export interface FillStageDef {
  id: string
  type: "fill"
  title: string
  intro: string
  secondsPerQuestion?: number
  questions: QuizQuestionDef[]
  /** 每局从题库随机抽取的题数（缺省 = 全量上场） */
  perRound?: number
}

/**
 * 真假鉴定：从 match 题库自动衍生（每句引语出「对/错」两道配对题），
 * 无需手写题目，组合随机、重玩不重样。
 */
export interface JudgeStageDef {
  id: string
  type: "judge"
  title: string
  intro: string
  /** 每局抽取的引语句数（每句衍生 2 道判断） */
  perRound?: number
  /** 素材来源的 match 关 id（缺省 "match"） */
  sourceStageId?: string
}

export type StageDef = MatchStageDef | QuizStageDef | FillStageDef | JudgeStageDef | SortStageDef

export interface RankTexts {
  S?: string
  A?: string
  B?: string
  C?: string
}

export interface LevelResultDef {
  progressReward: number
  clearedText: string
  nextChapterHint: string
  /** 总评分档位评语（S/A/B/C），结算页展示 */
  rankTexts?: RankTexts
  /** 内容驱动的仪表结算配置；缺省时走第一章默认规则 */
  settlement?: ContentSettlement
}

export interface LevelDef {
  chapter: number
  title: string
  scene: string
  knowledge_ids: string[]
  story: string[]
  stages: StageDef[]
  result: LevelResultDef
}

interface LevelsIndex {
  levels: Array<{ chapter: number; file: string }>
}

function contentUrl(path: string): string {
  // 预览态挂在 /app-preview/<appid>/ 子路径下：必须按部署前缀拼，
  // 写死 BASE_URL("/") 会打到网关根、拿回 HTML 导致 JSON 解析报错
  const base = getBasename().replace(/\/$/, "")
  return `${base}/content/${path}`
}

async function fetchJson<T>(url: string, what: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${what}加载失败（HTTP ${res.status}）`)
  return (await res.json()) as T
}

/** 校验关卡文件结构，缺关键字段直接报错而不是渲染到一半崩 */
function validateLevel(level: LevelDef): LevelDef {
  if (!level || typeof level.chapter !== "number") throw new Error("关卡文件缺少 chapter 字段")
  if (!Array.isArray(level.stages) || level.stages.length === 0) throw new Error("关卡文件缺少 stages")
  for (const st of level.stages) {
    if (st.type === "match") {
      if (!Array.isArray(st.concepts) || !Array.isArray(st.quotes)) throw new Error(`match 关「${st.id}」缺 concepts/quotes`)
      for (const q of st.quotes) {
        if (!q.feedback || !q.feedback.factory || !q.feedback.data || !q.feedback.consultant) {
          throw new Error(`引语 ${q.id} 缺三句话讲解（factory/data/consultant）`)
        }
      }
    } else if (st.type === "quiz" || st.type === "fill") {
      if (!Array.isArray(st.questions) || st.questions.length === 0) throw new Error(`${st.type} 关「${st.id}」缺 questions`)
      for (const q of st.questions) {
        if (!Array.isArray(q.options) || q.options.length < 2) throw new Error(`题 ${q.id} 至少要有 2 个选项`)
        if (!q.options.some((o) => o.id === q.answer)) throw new Error(`题 ${q.id} 的 answer 不在选项里`)
        if (!q.feedback || !q.feedback.factory || !q.feedback.data || !q.feedback.consultant) {
          throw new Error(`题 ${q.id} 缺三句话讲解（factory/data/consultant）`)
        }
      }
    } else if (st.type === "judge") {
      // 真假鉴定从 match 题库衍生：校验素材源存在且 perRound 合法
      const srcId = st.sourceStageId ?? "match"
      const src = level.stages.find((s) => s.id === srcId && s.type === "match")
      if (!src) throw new Error(`judge 关「${st.id}」的素材源 match 关「${srcId}」不存在`)
    } else if (st.type === "sort") {
      if (!Array.isArray(st.steps) || st.steps.length === 0) throw new Error(`sort 关「${st.id}」缺 steps`)
    } else {
      throw new Error(`未知 stage 类型: ${String((st as StageDef).type)}`)
    }
  }
  return level
}

export async function loadTerms(): Promise<Record<string, TermDef>> {
  const data = await fetchJson<{ terms: TermDef[] }>(contentUrl("terms.json"), "术语库")
  const map: Record<string, TermDef> = {}
  for (const t of data.terms ?? []) map[t.id] = t
  return map
}

export async function loadLevel(chapter: number): Promise<LevelDef> {
  const idx = await fetchJson<LevelsIndex>(contentUrl("levels/index.json"), "关卡清单")
  const entry = (idx.levels ?? []).find((l) => l.chapter === chapter)
  if (!entry) throw new Error(`第 ${chapter} 章的关卡内容还没上架`)
  const level = await fetchJson<LevelDef>(contentUrl(`levels/${entry.file}`), `第 ${chapter} 章内容`)
  return validateLevel(level)
}

/** 打乱数组（返回新数组）。加载时执行一次，保证同一局顺序稳定 */
export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
