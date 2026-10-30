// 自由沙盘 页面状态机。
//
// 三件事：读存档判断第三章是否通关（没通关不给进）、加载沙盘内容、跑沙盘引擎。
// 沙盘里的库存 / 工单 / BOM 全部只活在页面状态里，不写 player_progress，
// 也不影响主线进度与 12 个受监控字段。
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { pbFetch, getPocketBaseUrl } from "@/lib/pb"
import { loadSandboxContent, type SandboxContent } from "@/content/sandbox"
import {
  adjustStock,
  cancelOrder,
  createOrder,
  createSandboxState,
  isSandboxUnlocked,
  materialNeeds,
  sandboxLockMessage,
  setBomQty,
  setStock,
  advanceOrder,
  type SandboxOrder,
  type SandboxState,
} from "@/game/sandbox"
import type { ProgressRecord } from "@/content/chapters"

function progressApi(): string {
  return `${getPocketBaseUrl()}/api/player_progress`
}

export function useSandbox() {
  const navigate = useNavigate()
  const [content, setContent] = useState<SandboxContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [chapterStatus, setChapterStatus] = useState<Record<string, string>>({})
  const [progressReadable, setProgressReadable] = useState(true)
  const [state, setState] = useState<SandboxState | null>(null)
  const [productId, setProductId] = useState("")
  const [qty, setQty] = useState(1)
  const [selectedOrderId, setSelectedOrderId] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [mod, progressRes] = await Promise.all([
          loadSandboxContent(),
          pbFetch(progressApi()).catch(() => null),
        ])
        if (cancelled) return
        setContent(mod)
        setState(createSandboxState(mod))
        setProductId(mod.products[0]?.id ?? "")
        if (progressRes && progressRes.ok) {
          const data = await progressRes.json()
          const items: Array<Partial<ProgressRecord> & { id?: string }> = Array.isArray(data?.items) ? data.items : []
          if (items.length > 0) {
            setChapterStatus((items[0].chapter_status ?? {}) as Record<string, string>)
          } else {
            setProgressReadable(true)
          }
        } else {
          // 读不到存档（未登录或接口异常）：按「没通关」处理，不放宽门槛
          setProgressReadable(false)
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "沙盘内容加载失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const unlocked = isSandboxUnlocked(chapterStatus)
  const lockMessage = sandboxLockMessage(chapterStatus)

  const goHome = useCallback(() => navigate("/"), [navigate])

  const update = useCallback((fn: (prev: SandboxState) => SandboxState) => {
    setState((prev) => (prev ? fn(prev) : prev))
  }, [])

  const onSetStock = useCallback((materialId: string, value: number) => {
    update((prev) => setStock(prev, materialId, value))
  }, [update])

  const onAdjustStock = useCallback((materialId: string, delta: number) => {
    update((prev) => adjustStock(prev, materialId, delta))
  }, [update])

  const onSetBomQty = useCallback((pid: string, materialId: string, value: number) => {
    update((prev) => setBomQty(prev, pid, materialId, value))
  }, [update])

  const onCreateOrder = useCallback(() => {
    if (!content) return
    update((prev) => {
      const next = createOrder(prev, content, productId, qty)
      const created = next.orders[next.orders.length - 1]
      if (created && created.id !== prev.orders[prev.orders.length - 1]?.id) {
        setSelectedOrderId(created.id)
      }
      return next
    })
  }, [content, productId, qty, update])

  const onAdvance = useCallback((orderId: string) => {
    if (!content) return
    update((prev) => advanceOrder(prev, content, orderId))
  }, [content, update])

  const onCancel = useCallback((orderId: string) => {
    update((prev) => cancelOrder(prev, orderId))
  }, [update])

  const orders = state?.orders ?? []
  const selectedOrder: SandboxOrder | undefined = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? orders[orders.length - 1],
    [orders, selectedOrderId],
  )
  const needs = useMemo(
    () => (state && selectedOrder ? materialNeeds(state, selectedOrder) : {}),
    [state, selectedOrder],
  )

  return {
    loading,
    loadError,
    content,
    state,
    unlocked,
    lockMessage,
    progressReadable,
    orders,
    selectedOrder,
    needs,
    productId,
    qty,
    setProductId,
    setQty,
    setSelectedOrderId,
    onSetStock,
    onAdjustStock,
    onSetBomQty,
    onCreateOrder,
    onAdvance,
    onCancel,
    goHome,
  }
}
