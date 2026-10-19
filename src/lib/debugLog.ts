// 运行时错误收集器：全局 error / unhandledrejection / React 渲染崩溃都记进环形缓冲，
// localStorage 持久化（刷新不丢），诊断面板展示。容量 50 条，新的在前。

export interface DebugEntry {
  /** ISO 时间戳 */
  t: string
  type: "error" | "unhandledrejection" | "react"
  message: string
  stack?: string
}

const STORAGE_KEY = "mes_debug_log"
const CAP = 50

let buffer: DebugEntry[] = []
let initialized = false

function load(): DebugEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as DebugEntry[]).slice(0, CAP) : []
  } catch {
    return []
  }
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer))
  } catch {
    // localStorage 满/禁用时只保留内存缓冲，诊断面板仍可看
  }
}

export function pushDebugEntry(entry: Omit<DebugEntry, "t">) {
  const next: DebugEntry = { ...entry, t: new Date().toISOString() }
  buffer = [next, ...buffer].slice(0, CAP)
  persist()
}

export function getDebugEntries(): DebugEntry[] {
  return [...buffer]
}

export function clearDebugEntries() {
  buffer = []
  persist()
}

/** 挂全局监听（幂等，模块加载时调用一次） */
export function initDebugLog() {
  if (initialized || typeof window === "undefined") return
  initialized = true
  buffer = load()
  window.addEventListener("error", (e) => {
    pushDebugEntry({
      type: "error",
      message: e.message || "未知脚本错误",
      stack: e.error?.stack ? String(e.error.stack).slice(0, 2000) : `${e.filename}:${e.lineno}:${e.colno}`,
    })
  })
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason
    const message = reason instanceof Error ? reason.message : String(reason ?? "未知 Promise 拒绝")
    const stack = reason instanceof Error && reason.stack ? reason.stack.slice(0, 2000) : undefined
    pushDebugEntry({ type: "unhandledrejection", message, stack })
  })
}
