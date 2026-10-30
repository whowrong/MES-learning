// 上线陪产 · 交付闭环：内容加载器与类型定义。
//
// 内容与代码分离（与站内其它模块一致）：讲解卡、判分题、排序题、交付物工作区
// 规范全部放在 public/content/delivery/index.json，代码只负责加载、校验与渲染，
// 后续加题改内容文件即可，不动页面组件。
//
// 判分题与排序题沿用「实习准备营」同一套类型与判定口径（多选少选都算错、
// 顺序题必须完全正确才得分），因此直接复用那边的类型与纯函数。
import { getBasename } from "@/lib/pb"
import type { CareerCard, CareerOrder, CareerQuestion } from "./careerPrep"

/** 判分题（单选 / 多选 / 判断） */
export type DeliveryQuestion = CareerQuestion
/** 流程排序题 */
export type DeliveryOrder = CareerOrder

/** 讲解卡：在站内术语体系里可互链的概念 */
export interface DeliveryCard extends CareerCard {
  /** 回指站内知识编号（K9-7 蓝图 … K10-12 驻场沟通） */
  knowledge_ids: string[]
}

/** 交付物必备要素：站内结构校验的一条规则 */
export interface DeliveryElementDef {
  id: string
  /** 要素名称，如「版本号与生效日期」 */
  label: string
  /** 缺了它会怎样，写给使用者看 */
  hint: string
  /** 命中任意一条即视为该要素齐全（大小写不敏感的正则源串） */
  patterns: string[]
}

/** 一件交付物的写作规范 */
export interface DeliveryDeliverableDef {
  id: string
  title: string
  /** 读者是谁 */
  audience: string
  /** 它要回答什么 */
  purpose: string
  /** 建议结构 */
  template: string
  /** 少于这么多字视为没写完 */
  min_chars: number
  required_elements: DeliveryElementDef[]
  term_ids: string[]
}

/** 交付物工作区 */
export interface DeliveryWorkspaceDef {
  intro: string
  notice: string
  deliverables: DeliveryDeliverableDef[]
}

export interface DeliveryModule {
  moduleId: string
  moduleName: string
  subtitle: string
  intro: string
  knowledge_ids: string[]
  cards: DeliveryCard[]
  questions: DeliveryQuestion[]
  orders: DeliveryOrder[]
  workspace: DeliveryWorkspaceDef
}

export const DELIVERY_TYPE_LABELS: Record<string, string> = {
  single: "单选",
  multiple: "多选",
  judge: "判断",
}

function contentUrl(path: string): string {
  const base = getBasename().replace(/\/$/, "")
  return `${base}/content/${path}`
}

/** 校验模块内容结构：缺关键字段直接报错，不渲染到一半崩 */
export function validateDeliveryModule(mod: DeliveryModule): DeliveryModule {
  if (!mod || typeof mod.moduleId !== "string") throw new Error("交付闭环内容缺少 moduleId")
  if (!Array.isArray(mod.cards) || mod.cards.length === 0) throw new Error("交付闭环内容缺讲解卡")
  if (!Array.isArray(mod.questions) || mod.questions.length === 0) throw new Error("交付闭环内容缺判分题")
  if (!Array.isArray(mod.orders) || mod.orders.length === 0) throw new Error("交付闭环内容缺排序题")
  if (!mod.workspace || !Array.isArray(mod.workspace.deliverables) || mod.workspace.deliverables.length === 0) {
    throw new Error("交付闭环内容缺交付物工作区规范")
  }
  for (const c of mod.cards) {
    if (!c.id || !c.title) throw new Error("讲解卡缺 id 或 title")
    if (!Array.isArray(c.points) || c.points.length === 0) throw new Error(`讲解卡 ${c.id} 缺要点`)
    if (!Array.isArray(c.term_ids)) throw new Error(`讲解卡 ${c.id} 缺 term_ids`)
  }
  for (const q of mod.questions) {
    if (!q.id || !q.prompt) throw new Error("判分题缺 id 或 prompt")
    if (!Array.isArray(q.options) || q.options.length < 2) throw new Error(`判分题 ${q.id} 选项不足`)
    if (q.answer === undefined || q.answer === null || q.answer === "") throw new Error(`判分题 ${q.id} 缺答案`)
    if (Array.isArray(q.answer)) {
      if (q.answer.length === 0) throw new Error(`判分题 ${q.id} 答案为空数组`)
      for (const aid of q.answer) {
        if (!q.options.some((o) => o.id === aid)) throw new Error(`判分题 ${q.id} 答案 ${aid} 不在选项里`)
      }
    } else if (!q.options.some((o) => o.id === q.answer)) {
      throw new Error(`判分题 ${q.id} 答案 ${q.answer} 不在选项里`)
    }
    if (!q.reference) throw new Error(`判分题 ${q.id} 缺参考答案`)
  }
  for (const o of mod.orders) {
    if (!o.id || !o.title) throw new Error("排序题缺 id 或 title")
    if (!Array.isArray(o.steps) || o.steps.length < 2) throw new Error(`排序题 ${o.id} 步骤不足`)
  }
  for (const d of mod.workspace.deliverables) {
    if (!d.id || !d.title) throw new Error("交付物缺 id 或 title")
    if (!Array.isArray(d.required_elements) || d.required_elements.length === 0) {
      throw new Error(`交付物 ${d.id} 缺必备要素规则`)
    }
    for (const el of d.required_elements) {
      if (!el.id || !el.label) throw new Error(`交付物 ${d.id} 的要素缺 id 或 label`)
      if (!Array.isArray(el.patterns) || el.patterns.length === 0) throw new Error(`要素 ${el.id} 缺匹配规则`)
    }
  }
  return mod
}

/** 拉取交付闭环模块内容 */
export async function loadDeliveryModule(): Promise<DeliveryModule> {
  const res = await fetch(contentUrl("delivery/index.json"))
  if (!res.ok) throw new Error(`交付闭环内容加载失败（HTTP ${res.status}）`)
  return validateDeliveryModule((await res.json()) as DeliveryModule)
}
