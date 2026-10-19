// 连续学习打卡（纯函数，可单测）：Duolingo 式 streak
// 日期一律本地时区的 YYYY-MM-DD 字符串，now 由调用方传入保证可测。

function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function todayStr(now: number): string {
  return dayKey(new Date(now))
}

/** 打卡：把今天加进学习日列表（已打过原样返回，不去重排序历史） */
export function addStudyDay(days: string[], now: number): string[] {
  const key = todayStr(now)
  if (days.includes(key)) return days
  return [...days, key]
}

/**
 * 连续学习天数：从今天往回数连续的自然日。
 * 今天还没打卡不算断（昨天打过就继续接着数），今天昨天都没打才是 0。
 */
export function computeStreak(days: string[], now: number): number {
  const set = new Set(days)
  const cur = new Date(now)
  if (!set.has(dayKey(cur))) {
    cur.setDate(cur.getDate() - 1)
    if (!set.has(dayKey(cur))) return 0
  }
  let streak = 0
  while (set.has(dayKey(cur))) {
    streak++
    cur.setDate(cur.getDate() - 1)
  }
  return streak
}
