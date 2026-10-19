// 结算引擎（纯函数，可单测）：仪表结算 / 倒冲扣料（含损耗率）/ 库存计算
// 第三~五章玩法会扩展这里；第一周先落 库存 + 倒冲 + 章节仪表结算。

import { GAUGE_DEFS, type GaugeValue } from "@/content/chapters"

// ---------- 库存与倒冲 ----------

export interface InventoryLine {
  materialId: string
  materialName: string
  unit: string
  /** 当前库存量（可为负：倒冲欠账） */
  qty: number
}

export interface BackflushInput {
  /** 报工合格数量（如 500 把椅子） */
  reportedQty: number
  /** BOM 单耗（如每把椅子 2.5m 钢管） */
  unitUsage: number
  /** 损耗率，0.03 = 3%（切割有废料，领料按多算） */
  lossRate?: number
}

export interface BackflushResult {
  /** 应扣数量 = reportedQty × unitUsage × (1 + lossRate)，保留 4 位小数避免浮点漂移 */
  deductQty: number
}

/** 倒冲扣料应扣量：500 × 2.5 = 1250m；带 3% 损耗 = 1287.5m */
export function computeBackflush(input: BackflushInput): BackflushResult {
  const loss = typeof input.lossRate === "number" && input.lossRate > 0 ? input.lossRate : 0
  const raw = input.reportedQty * input.unitUsage * (1 + loss)
  return { deductQty: Math.round(raw * 10000) / 10000 }
}

export interface DeductResult {
  /** 扣减后的库存行（新对象，不改入参） */
  line: InventoryLine
  /** 是否扣成负库存（欠账：报工了但料不够/没入库，现实里意味着账实不符） */
  negative: boolean
}

/** 从库存行扣减数量，返回新行；qty < 0 时标记 negative */
export function deductInventory(line: InventoryLine, qty: number): DeductResult {
  const newQty = Math.round((line.qty - qty) * 10000) / 10000
  const next: InventoryLine = { ...line, qty: newQty }
  return { line: next, negative: newQty < 0 }
}

/** 盘点差异率：|账面 − 实物| / 账面（账面为 0 时差异即 1） */
export function countVariance(bookQty: number, physicalQty: number): number {
  if (bookQty === 0) return physicalQty === 0 ? 0 : 1
  return Math.abs(bookQty - physicalQty) / Math.abs(bookQty)
}

// ---------- 章节仪表结算 ----------

/** 单项仪表变动（带原因，用于结算页「变动分解」） */
export interface GaugeDelta {
  key: string
  delta: number
  reason: string
}

/**
 * 把一组变动应用到当前仪表快照，返回新快照。
 * 规则：写入 prev=旧值（驱动首页涨跌箭头）、按 GAUGE_DEFS 的 max 与 higherIsBetter 钳制到 [0, max]。
 */
export function applyGaugeDeltas(
  current: Record<string, GaugeValue>,
  deltas: GaugeDelta[],
): Record<string, GaugeValue> {
  const next: Record<string, GaugeValue> = { ...current }
  for (const d of deltas) {
    const def = GAUGE_DEFS.find((g) => g.key === d.key)
    if (!def) continue
    const old = next[d.key]?.value ?? def.defaultValue
    const clamped = Math.max(0, Math.min(def.max, old + d.delta))
    next[d.key] = { value: clamped, prev: old }
  }
  return next
}

export interface ChapterScore {
  /** 连连看答错条数 */
  matchWrong: number
  /** 场景抉择答错题数 */
  quizWrong?: number
  /** 排序错误步数 */
  sortWrong: number
  /** 本章满分时项目进度增量 */
  progressReward: number
}

/**
 * 第 1 章结算：每个决策只影响 2–3 项仪表。
 * - 项目进度：+progressReward（完成调研）
 * - 数据准确率：每错 1 处 -2（听岔了术语，录进系统的字段就会错）
 * - 工人配合度：每错 1 处 -1（师傅觉得你听不懂人话）
 */
export function settleChapter1(score: ChapterScore): GaugeDelta[] {
  const totalWrong = score.matchWrong + (score.quizWrong ?? 0) + score.sortWrong
  const deltas: GaugeDelta[] = [
    { key: "projectProgress", delta: score.progressReward, reason: "完成第一章调研认知，实施路线图往前走了一步" },
  ]
  if (totalWrong > 0) {
    deltas.push({ key: "dataAccuracy", delta: -2 * totalWrong, reason: `答错 ${totalWrong} 处：术语听岔，将来录进系统的字段就会错` })
    deltas.push({ key: "workerMorale", delta: -1 * totalWrong, reason: `答错 ${totalWrong} 处：师傅们觉得你没听懂他们的话` })
  } else {
    deltas.push({ key: "dataAccuracy", delta: 0, reason: "全对：概念对齐，后续录数据的口径不会歪" })
  }
  return deltas
}

// ---------- 内容驱动的章节结算 ----------

export interface WrongPenaltyDef {
  key: string
  /** 每错 1 处的增减值（负数为扣） */
  perWrong: number
  /** 有错时的原因文案，{n} 会替换为总错误数 */
  reason: string
  /** 全对时的原因文案（delta=0） */
  perfectReason?: string
}

export interface ContentSettlement {
  progressReward: number
  progressReason?: string
  wrongPenalties?: WrongPenaltyDef[]
}

/**
 * 按内容文件里的结算配置生成仪表变动（第二章起用；第一章走 settleChapter1 兼容旧内容）。
 * 全对时每项 penalty 记 delta=0 并给 perfectReason，结算页照常展示「为什么没扣」。
 */
export function settleByContent(cfg: ContentSettlement, totalWrong: number): GaugeDelta[] {
  const deltas: GaugeDelta[] = [
    {
      key: "projectProgress",
      delta: cfg.progressReward,
      reason: cfg.progressReason ?? "完成本章，实施项目往前走了一步",
    },
  ]
  for (const p of cfg.wrongPenalties ?? []) {
    if (totalWrong > 0) {
      deltas.push({ key: p.key, delta: p.perWrong * totalWrong, reason: p.reason.replace(/\{n\}/g, String(totalWrong)) })
    } else {
      deltas.push({ key: p.key, delta: 0, reason: p.perfectReason ?? "全对，这项仪表没有受损" })
    }
  }
  return deltas
}

// ---------- 章节总评分 ----------

export type ChapterRank = "S" | "A" | "B" | "C"

export interface ScoreInput {
  matchTotal: number
  matchWrong: number
  quizTotal: number
  quizWrong: number
  /** 真假鉴定（可选，judge 关存在时计入） */
  judgeTotal?: number
  judgeWrong?: number
  sortTotal: number
  sortWrong: number
}

export interface ChapterScoreResult {
  /** 0–100：全部判定点的答对率 */
  score: number
  rank: ChapterRank
  correct: number
  total: number
}

/**
 * 章节总评分 = 答对判定点 / 总判定点（连连看每条、抉择每题、鉴定每题、排序每步都算一个判定点）。
 * 档位：S ≥ 95，A ≥ 85，B ≥ 70，其余 C。
 */
export function computeChapterScore(input: ScoreInput): ChapterScoreResult {
  const total = input.matchTotal + input.quizTotal + (input.judgeTotal ?? 0) + input.sortTotal
  if (total <= 0) return { score: 0, rank: "C", correct: 0, total: 0 }
  const wrong = input.matchWrong + input.quizWrong + (input.judgeWrong ?? 0) + input.sortWrong
  const correct = Math.max(0, total - wrong)
  const score = Math.round((correct / total) * 100)
  const rank: ChapterRank = score >= 95 ? "S" : score >= 85 ? "A" : score >= 70 ? "B" : "C"
  return { score, rank, correct, total }
}
