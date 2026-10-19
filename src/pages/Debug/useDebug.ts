import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { getPocketBaseUrl, getBasename } from "@/lib/pb"
import { BUILD_VERSION } from "@/version"
import { clearDebugEntries, getDebugEntries, initDebugLog, type DebugEntry } from "@/lib/debugLog"

initDebugLog()

export interface CheckResult {
  name: string
  ok: boolean
  status: string
  ms: number
  detail: string
}

async function timed(name: string, run: () => Promise<{ ok: boolean; status: string; detail: string }>): Promise<CheckResult> {
  const t0 = performance.now()
  try {
    const r = await run()
    const done: CheckResult = { name, ok: r.ok, status: r.status, ms: Math.round(performance.now() - t0), detail: r.detail }
    return done
  } catch (err) {
    const failed: CheckResult = {
      name,
      ok: false,
      status: "异常",
      ms: Math.round(performance.now() - t0),
      detail: err instanceof Error ? err.message : String(err),
    }
    return failed
  }
}

async function checkFetch(name: string, url: string, expectJson: boolean): Promise<CheckResult> {
  return timed(name, async () => {
    const res = await fetch(url)
    if (!res.ok) {
      const bad = { ok: false, status: `HTTP ${res.status}`, detail: url }
      return bad
    }
    let detail = res.headers.get("content-type") ?? ""
    if (expectJson) {
      const text = await res.text()
      try {
        JSON.parse(text)
        detail = `JSON 合法 · ${text.length} 字节`
      } catch {
        const broken = { ok: false, status: "非 JSON", detail: `返回了 HTML/文本（前 60 字）：${text.slice(0, 60)}` }
        return broken
      }
    }
    const good = { ok: true, status: "200", detail }
    return good
  })
}

export function useDebug() {
  const navigate = useNavigate()
  const [checkResults, setCheckResults] = useState<CheckResult[] | null>(null)
  const [checking, setChecking] = useState(false)
  const [entries, setEntries] = useState<DebugEntry[]>([])
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [snapshot, setSnapshot] = useState("")
  const [snapshotError, setSnapshotError] = useState("")
  const [copiedLabel, setCopiedLabel] = useState("")

  const contentBase = `${getBasename().replace(/\/$/, "")}/content`
  const pbBase = getPocketBaseUrl()

  const envRows = useMemo(() => {
    const rows = [
      { label: "构建版本", value: `v${BUILD_VERSION}` },
      { label: "部署前缀", value: getBasename() },
      { label: "后端代理", value: pbBase },
      { label: "页面地址", value: typeof window === "undefined" ? "" : window.location.href },
      { label: "视口", value: typeof window === "undefined" ? "" : `${window.innerWidth} × ${window.innerHeight}` },
      { label: "浏览器", value: typeof navigator === "undefined" ? "" : navigator.userAgent },
    ]
    return rows
  }, [pbBase])

  const refreshEntries = useCallback(() => {
    setEntries(getDebugEntries())
  }, [])

  useEffect(() => {
    refreshEntries()
  }, [refreshEntries])

  const loadSnapshot = useCallback(async () => {
    try {
      const res = await fetch(`${pbBase}/api/player_progress`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const items = Array.isArray(data?.items) ? data.items : []
      if (items.length === 0) {
        setSnapshot("（还没有存档记录）")
        setSnapshotError("")
        return
      }
      setSnapshot(JSON.stringify(items[0], null, 2))
      setSnapshotError("")
    } catch (err) {
      setSnapshot("")
      setSnapshotError(err instanceof Error ? err.message : String(err))
    }
  }, [pbBase])

  const runChecks = useCallback(async () => {
    setChecking(true)
    const results: CheckResult[] = []
    results.push(await checkFetch("术语库内容", `${contentBase}/terms.json`, true))
    results.push(await checkFetch("关卡清单", `${contentBase}/levels/index.json`, true))
    // 按清单逐个测关卡文件
    try {
      const idxRes = await fetch(`${contentBase}/levels/index.json`)
      if (idxRes.ok) {
        const idx = await idxRes.json()
        for (const lv of idx.levels ?? []) {
          results.push(await checkFetch(`第 ${lv.chapter} 章内容`, `${contentBase}/levels/${lv.file}`, true))
        }
      }
    } catch {
      results.push({ name: "关卡清单解析", ok: false, status: "异常", ms: 0, detail: "清单读取失败，无法枚举关卡文件" })
    }
    results.push(await checkFetch("后端服务心跳", `${pbBase}/api/health`, true))
    results.push(await checkFetch("存档读取", `${pbBase}/api/player_progress`, true))
    // 存档写入：把 study_days 原值回写（幂等无害），验证 PATCH 链路；不 POST 新记录，避免污染存档
    results.push(
      await timed("存档写入", async () => {
        const listRes = await fetch(`${pbBase}/api/player_progress`)
        if (!listRes.ok) {
          const bad = { ok: false, status: `HTTP ${listRes.status}`, detail: "读取存档列表失败，无法测试写入" }
          return bad
        }
        const data = await listRes.json()
        const rec = Array.isArray(data?.items) ? data.items[0] : null
        if (!rec?.id) {
          const noRec = { ok: false, status: "无存档", detail: "还没有存档记录，先进一次游戏再测" }
          return noRec
        }
        const patchRes = await fetch(`${pbBase}/api/player_progress/${rec.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ study_days: Array.isArray(rec.study_days) ? rec.study_days : [] }),
        })
        if (!patchRes.ok) {
          const bad = { ok: false, status: `HTTP ${patchRes.status}`, detail: "PATCH 写入被拒" }
          return bad
        }
        const good = { ok: true, status: "200", detail: "幂等回写 study_days 成功" }
        return good
      }),
    )
    setCheckResults(results)
    setChecking(false)
    refreshEntries()
    void loadSnapshot()
  }, [contentBase, pbBase, refreshEntries, loadSnapshot])

  // 进页面自动体检一次
  useEffect(() => {
    void runChecks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copyText = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedLabel(label)
      setTimeout(() => setCopiedLabel(""), 1500)
    } catch {
      setCopiedLabel("复制失败，请手动全选")
      setTimeout(() => setCopiedLabel(""), 2000)
    }
  }, [])

  const copyDiagnostics = useCallback(() => {
    const parts = [
      `构建版本: v${BUILD_VERSION}`,
      `页面地址: ${typeof window === "undefined" ? "" : window.location.href}`,
      `部署前缀: ${getBasename()}`,
      "",
      "== 体检结果 ==",
      ...(checkResults ?? []).map((r) => `${r.ok ? "PASS" : "FAIL"} | ${r.name} | ${r.status} | ${r.ms}ms | ${r.detail}`),
      "",
      "== 最近错误 ==",
      ...(entries.length === 0 ? ["（无）"] : entries.slice(0, 10).map((e) => `[${e.t}] ${e.type}: ${e.message}\n${e.stack ?? ""}`)),
      "",
      "== 存档快照 ==",
      snapshot || snapshotError || "（未加载）",
    ]
    void copyText(parts.join("\n"), "诊断报告")
  }, [checkResults, entries, snapshot, snapshotError, copyText])

  const clearErrors = useCallback(() => {
    clearDebugEntries()
    refreshEntries()
  }, [refreshEntries])

  const toggleExpand = useCallback((idx: number) => {
    setExpandedIdx((cur) => (cur === idx ? null : idx))
  }, [])

  const goHome = useCallback(() => navigate("/"), [navigate])

  const allPass = checkResults !== null && checkResults.every((r) => r.ok)
  const failedCount = checkResults ? checkResults.filter((r) => !r.ok).length : 0

  return {
    envRows,
    checkResults,
    checking,
    allPass,
    failedCount,
    entries,
    expandedIdx,
    snapshot,
    snapshotError,
    copiedLabel,
    buildVersion: BUILD_VERSION,
    runChecks,
    copyDiagnostics,
    copyText,
    clearErrors,
    toggleExpand,
    goHome,
  }
}
