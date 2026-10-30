// 上线陪产 · 交付闭环的纯逻辑：组卷判定 + 交付物结构校验。
//
// 判分与计分口径直接复用「实习准备营」的纯函数（多选少选都算错、顺序题必须
// 完全正确才得分），保证站内两个模块的判分标准一致；本文件只新增交付物工作区
// 的结构校验，这部分是站内独一份的能力：按必备要素逐条查文本，而不是数字数。
import { shuffle } from "@/content/loader"
import {
  judgeCareerQuestion,
  scoreCareerPaper,
  wrongCareerTermIds,
  type CareerPaperScore,
} from "@/game/careerPrep"
import type {
  DeliveryDeliverableDef,
  DeliveryModule,
  DeliveryOrder,
  DeliveryQuestion,
} from "@/content/delivery"

export interface DeliveryPaper {
  questions: DeliveryQuestion[]
  order: DeliveryOrder | null
}

/** 组卷：抽题（0 = 全部），顺序题随机取一道 */
export function buildDeliveryPaper(
  mod: DeliveryModule,
  questionCount: number,
  orderCount: number,
): DeliveryPaper {
  const all = shuffle(mod.questions)
  const questions = questionCount > 0 ? all.slice(0, Math.min(questionCount, all.length)) : all
  const orders = shuffle(mod.orders)
  const order = orderCount > 0 ? orders[0] ?? null : null
  return { questions, order }
}

/** 客观题判定（多选按集合相等，单选/判断按字符串相等） */
export function judgeDeliveryQuestion(q: DeliveryQuestion, given: string | string[]): boolean {
  return judgeCareerQuestion(q, given)
}

/** 计分：客观题与顺序题等权，顺序题必须完全正确 */
export function scoreDeliveryPaper(
  paper: DeliveryPaper,
  answers: Map<string, string | string[]>,
  orderAnswer: string[] | null,
): CareerPaperScore {
  return scoreCareerPaper(paper, answers, orderAnswer)
}

/** 答错的题关联术语 → 复习队列（去重） */
export function wrongDeliveryTermIds(score: CareerPaperScore): string[] {
  return wrongCareerTermIds(score)
}

/** 单条必备要素的校验结果 */
export interface DeliveryElementCheck {
  id: string
  label: string
  hint: string
  /** 文本里命中了至少一条规则 */
  ok: boolean
}

/** 一件交付物的结构校验结果 */
export interface DeliveryCheck {
  id: string
  title: string
  /** 当前字数 */
  chars: number
  /** 字数门槛 */
  minChars: number
  /** 字数是否够 */
  enough: boolean
  elements: DeliveryElementCheck[]
  /** 命中的要素数 */
  passed: number
  /** 要素总数 */
  total: number
  /** 齐全度 0~1（只按要素算，字数另计） */
  ratio: number
  /** 该交付物是否算写完（字数够且要素齐全） */
  complete: boolean
  /** 还缺哪些要素（label 列表） */
  missing: string[]
}

function matches(text: string, pattern: string): boolean {
  try {
    return new RegExp(pattern, "i").test(text)
  } catch {
    return false
  }
}

/** 校验一件交付物：字数门槛 + 必备要素逐条命中 */
export function checkDeliverable(def: DeliveryDeliverableDef, text: string): DeliveryCheck {
  const body = typeof text === "string" ? text : ""
  const chars = body.trim().length
  const minChars = def.min_chars > 0 ? def.min_chars : 1
  const elements: DeliveryElementCheck[] = def.required_elements.map((el) => ({
    id: el.id,
    label: el.label,
    hint: el.hint,
    ok: el.patterns.some((p) => matches(body, p)),
  }))
  const passed = elements.filter((e) => e.ok).length
  const total = elements.length
  const enough = chars >= minChars
  return {
    id: def.id,
    title: def.title,
    chars,
    minChars,
    enough,
    elements,
    passed,
    total,
    ratio: total > 0 ? passed / total : 0,
    complete: enough && passed === total,
    missing: elements.filter((e) => !e.ok).map((e) => e.label),
  }
}

export interface DeliveryWorkspaceCheck {
  checks: DeliveryCheck[]
  /** 写完的交付物数量 */
  completeCount: number
  /** 四件交付物整体齐全度 0~1 */
  ratio: number
  /** 四件全部写完 */
  allComplete: boolean
}

/** 校验整个交付物工作区 */
export function checkWorkspace(
  defs: DeliveryDeliverableDef[],
  drafts: Record<string, string>,
): DeliveryWorkspaceCheck {
  const checks = defs.map((d) => checkDeliverable(d, drafts[d.id] ?? ""))
  const completeCount = checks.filter((c) => c.complete).length
  const sum = checks.reduce((s, c) => s + c.ratio, 0)
  return {
    checks,
    completeCount,
    ratio: checks.length > 0 ? sum / checks.length : 0,
    allComplete: checks.length > 0 && completeCount === checks.length,
  }
}

/** 评级与其它模块同一套档位：S≥95 / A≥85 / B≥70 / 其余 C */
export function deliveryRank(score: number): "S" | "A" | "B" | "C" {
  if (score >= 95) return "S"
  if (score >= 85) return "A"
  if (score >= 70) return "B"
  return "C"
}
