// 间隔重复调度（纯函数，可单测）：Anki 式遗忘曲线
// 自评四档：忘了 / 有点印象 / 记住了 / 秒答，对应不同间隔跳跃。
// 所有时间用调用方传入的 now（毫秒时间戳），函数本身不读时钟，保证可测。

export type Rating = "again" | "hard" | "good" | "easy"

export interface ReviewState {
  /** 连续答对档数：0 = 新卡/刚忘，5 = 已牢固（封顶） */
  level: number
  /** 下次复习时间（毫秒时间戳），<= now 即到期 */
  dueAt: number
  /** 上次自评时间 */
  lastRatedAt: number
}

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** level 1..5 对应的间隔：1天 → 3天 → 7天 → 16天 → 35天（艾宾浩斯式递增） */
export const SRS_STEPS_MS = [DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY]

/** 复习间隔档位文案（UI 展示「下次复习」用） */
export function nextDueLabel(state: ReviewState, now: number): string {
  const diff = state.dueAt - now
  if (diff <= 0) return "现在就该复习"
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / MIN))} 分钟后`
  if (diff < DAY) return `${Math.round(diff / HOUR)} 小时后`
  const days = Math.round(diff / DAY)
  return days === 1 ? "明天" : `${days} 天后`
}

/** 对一张卡自评，返回新的调度状态（不改入参） */
export function rateTerm(prev: ReviewState | undefined, rating: Rating, now: number): ReviewState {
  const prevLevel = prev?.level ?? 0
  let level = prevLevel
  let dueAt = now
  if (rating === "again") {
    level = 0
    dueAt = now + 10 * MIN
  } else if (rating === "hard") {
    dueAt = now + 4 * HOUR
  } else if (rating === "good") {
    level = Math.min(prevLevel + 1, 5)
    dueAt = now + SRS_STEPS_MS[Math.max(level - 1, 0)]
  } else {
    level = Math.min(prevLevel + 2, 5)
    dueAt = now + SRS_STEPS_MS[Math.max(level - 1, 0)]
  }
  const next: ReviewState = { level, dueAt, lastRatedAt: now }
  return next
}

/** 掌握度徽标分档（UI 用） */
export function masteryLabel(level: number): { label: string; tone: "bad" | "mid" | "good" } {
  if (level <= 0) {
    const bad = { label: "不熟", tone: "bad" as const }
    return bad
  }
  if (level <= 2) {
    const mid = { label: "模糊", tone: "mid" as const }
    return mid
  }
  if (level <= 4) {
    const good = { label: "熟悉", tone: "good" as const }
    return good
  }
  const mastered = { label: "已掌握", tone: "good" as const }
  return mastered
}

/**
 * 计算本次复习队列：
 * 1. 标记过「不熟」（review_queue 里）但还没评过级的卡优先；
 * 2. 加上所有到期（dueAt <= now）的卡；
 * 去重后按 dueAt 升序（没评过级的排最前）。
 */
export function dueTerms(
  reviewState: Record<string, ReviewState>,
  reviewQueue: string[],
  now: number,
): string[] {
  const fresh = reviewQueue.filter((tid) => !reviewState[tid])
  const due = Object.keys(reviewState)
    .filter((tid) => reviewState[tid].dueAt <= now)
    .sort((a, b) => reviewState[a].dueAt - reviewState[b].dueAt)
  const merged = [...fresh]
  for (const tid of due) if (!merged.includes(tid)) merged.push(tid)
  return merged
}
