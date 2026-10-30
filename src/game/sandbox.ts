// 自由沙盘：纯逻辑引擎（建工单 / 改库存 / 改 BOM / 推进工序 / 缺料停线）。
//
// 设计约束：
// - 全部是纯函数，输入旧状态、返回新状态，方便写单测；
// - 不写任何存档（player_progress），沙盘里的库存与工单只活在当前页面；
// - 解锁判定只认站内第三章「建模与配置」通关这一条，不擅自放宽。

/** 自由沙盘的解锁章节：第三章「建模与配置」通关后开放 */
export const SANDBOX_UNLOCK_CHAPTER_ID = 3

export interface SandboxBomLine {
  /** 原料 id */
  material: string
  /** 单台用量 */
  qty: number
}

export interface SandboxMaterialDef {
  id: string
  name: string
  unit: string
  /** 初始库存 */
  initial: number
  /** 给使用者看的提示 */
  note?: string
}

export interface SandboxProductDef {
  id: string
  name: string
  /** 工序（工作中心 id）顺序 */
  operations: string[]
  bom: SandboxBomLine[]
  note?: string
}

export interface SandboxWorkCenterDef {
  id: string
  name: string
  /** 单台工时（小时），用于展示负荷 */
  hoursPerUnit?: number
}

export interface SandboxContent {
  moduleId: string
  title: string
  subtitle: string
  intro: string
  tips: string[]
  materials: SandboxMaterialDef[]
  products: SandboxProductDef[]
  workCenters: SandboxWorkCenterDef[]
}

export type SandboxOrderStatus = "planned" | "running" | "blocked" | "done"
export type SandboxStepStatus = "pending" | "done"

export interface SandboxShortage {
  material: string
  /** 这一批需要多少 */
  need: number
  /** 现在有多少 */
  have: number
}

export interface SandboxOrder {
  id: string
  productId: string
  qty: number
  status: SandboxOrderStatus
  /** 已经推进到第几道工序（-1 = 还没领料开工） */
  stepIndex: number
  steps: { opId: string; status: SandboxStepStatus }[]
  shortage?: SandboxShortage
}

export interface SandboxLogEntry {
  at: string
  text: string
  tone: "info" | "good" | "warn" | "danger"
}

export interface SandboxState {
  /** 原料库存（允许为负，用来演示负库存） */
  inventory: Record<string, number>
  /** 可编辑的 BOM：productId -> 单台用量 */
  bom: Record<string, SandboxBomLine[]>
  orders: SandboxOrder[]
  /** 完工数：productId -> 台数 */
  finished: Record<string, number>
  log: SandboxLogEntry[]
}

function nowStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function withLog(state: SandboxState, text: string, tone: SandboxLogEntry["tone"] = "info"): SandboxState {
  return { ...state, log: [{ at: nowStamp(), text, tone }, ...state.log].slice(0, 60) }
}

/** 第三章是否已通关 → 自由沙盘是否开放 */
export function isSandboxUnlocked(chapterStatus: Record<string, string | undefined> | undefined): boolean {
  if (!chapterStatus) return false
  return chapterStatus[String(SANDBOX_UNLOCK_CHAPTER_ID)] === "cleared"
}

/** 锁定时的提示文案：说清楚还差哪一条，不含糊 */
export function sandboxLockMessage(chapterStatus: Record<string, string | undefined> | undefined): string {
  const state = chapterStatus?.[String(SANDBOX_UNLOCK_CHAPTER_ID)]
  if (state === "cleared") return ""
  if (state === "open") {
    return `第${SANDBOX_UNLOCK_CHAPTER_ID}章「建模与配置」已经解锁、还没通关：通关之后自由沙盘自动开放。`
  }
  return `第${SANDBOX_UNLOCK_CHAPTER_ID}章「建模与配置」还没解锁：先按主线把前面的章节打通，通关第${SANDBOX_UNLOCK_CHAPTER_ID}章之后自由沙盘自动开放。`
}

export function createSandboxState(content: SandboxContent): SandboxState {
  const inventory: Record<string, number> = {}
  for (const m of content.materials) inventory[m.id] = m.initial
  const bom: Record<string, SandboxBomLine[]> = {}
  for (const p of content.products) bom[p.id] = p.bom.map((line) => ({ ...line }))
  const finished: Record<string, number> = {}
  for (const p of content.products) finished[p.id] = 0
  return {
    inventory,
    bom,
    orders: [],
    finished,
    log: [{ at: nowStamp(), text: "沙盘已就绪：改库存、下工单，推进工序看物料怎么流动。", tone: "info" }],
  }
}

/** 直接设定某个原料的库存（允许负数） */
export function setStock(state: SandboxState, materialId: string, value: number): SandboxState {
  if (!Number.isFinite(value)) return state
  const inventory = { ...state.inventory, [materialId]: Math.round(value * 100) / 100 }
  const next = { ...state, inventory }
  const mat = materialId
  return withLog(next, `库存调整：${mat} → ${inventory[materialId]}`, value < 0 ? "warn" : "info")
}

/** 在现有库存上加减 */
export function adjustStock(state: SandboxState, materialId: string, delta: number): SandboxState {
  const current = state.inventory[materialId] ?? 0
  return setStock(state, materialId, current + delta)
}

/** 改单台用量（演示「BOM 错了整条线会怎样」） */
export function setBomQty(state: SandboxState, productId: string, materialId: string, qty: number): SandboxState {
  if (!Number.isFinite(qty) || qty < 0) return state
  const lines = state.bom[productId] ?? []
  const existing = lines.find((l) => l.material === materialId)
  const nextLines = existing
    ? lines.map((l) => (l.material === materialId ? { ...l, qty } : l))
    : [...lines, { material: materialId, qty }]
  return withLog(
    { ...state, bom: { ...state.bom, [productId]: nextLines } },
    `BOM 改动：${productId} 的 ${materialId} 单台用量 → ${qty}`,
    "warn",
  )
}

/** 这一批订单各原料需要多少 */
export function materialNeeds(state: SandboxState, order: SandboxOrder): Record<string, number> {
  const lines = state.bom[order.productId] ?? []
  const needs: Record<string, number> = {}
  for (const line of lines) {
    needs[line.material] = (needs[line.material] ?? 0) + line.qty * order.qty
  }
  return needs
}

export function createOrder(state: SandboxState, content: SandboxContent, productId: string, qty: number): SandboxState {
  const product = content.products.find((p) => p.id === productId)
  if (!product) return state
  const count = Math.floor(qty)
  if (!Number.isFinite(count) || count <= 0) return state
  const order: SandboxOrder = {
    id: `WO-${String(state.orders.length + 1).padStart(3, "0")}`,
    productId,
    qty: count,
    status: "planned",
    stepIndex: -1,
    steps: product.operations.map((opId) => ({ opId, status: "pending" as SandboxStepStatus })),
  }
  return withLog(
    { ...state, orders: [...state.orders, order] },
    `新建工单 ${order.id}：${product.name} × ${count}`,
    "info",
  )
}

/**
 * 推进一道工序。
 * - 第一道工序领料：按当前 BOM 扣原料；库存不够就停线（blocked），不扣料；
 * - 之后的工序只推进在制品位置，不额外扣料；
 * - 最后一道工序做完 → 完工入库。
 */
export function advanceOrder(state: SandboxState, content: SandboxContent, orderId: string): SandboxState {
  const order = state.orders.find((o) => o.id === orderId)
  if (!order || order.status === "done") return state
  const product = content.products.find((p) => p.id === order.productId)
  if (!product) return state

  if (order.stepIndex < 0) {
    // 领料开工
    const needs = materialNeeds(state, order)
    for (const [materialId, need] of Object.entries(needs)) {
      const have = state.inventory[materialId] ?? 0
      if (have < need) {
        const shortage: SandboxShortage = { material: materialId, need, have }
        const blocked: SandboxOrder = { ...order, status: "blocked", shortage }
        return withLog(
          { ...state, orders: state.orders.map((o) => (o.id === orderId ? blocked : o)) },
          `停线：${order.id} 缺料 ${materialId}（需 ${need}，只有 ${have}）`,
          "danger",
        )
      }
    }
    const inventory = { ...state.inventory }
    for (const [materialId, need] of Object.entries(needs)) {
      inventory[materialId] = Math.round(((inventory[materialId] ?? 0) - need) * 100) / 100
    }
    const steps = order.steps.map((s, i) => (i === 0 ? { ...s, status: "done" as SandboxStepStatus } : s))
    const running: SandboxOrder = { ...order, status: "running", stepIndex: 0, steps, shortage: undefined }
    return withLog(
      { ...state, inventory, orders: state.orders.map((o) => (o.id === orderId ? running : o)) },
      `${order.id} 领料开工：${product.operations[0]}`,
      "good",
    )
  }

  // 往后推一道工序
  const nextIndex = order.stepIndex + 1
  if (nextIndex >= order.steps.length) {
    const done: SandboxOrder = { ...order, status: "done", shortage: undefined }
    const finished = { ...state.finished, [order.productId]: (state.finished[order.productId] ?? 0) + order.qty }
    return withLog(
      { ...state, finished, orders: state.orders.map((o) => (o.id === orderId ? done : o)) },
      `${order.id} 完工入库：${product.name} × ${order.qty}`,
      "good",
    )
  }
  const steps = order.steps.map((s, i) => (i === nextIndex ? { ...s, status: "done" as SandboxStepStatus } : s))
  const running: SandboxOrder = { ...order, status: "running", stepIndex: nextIndex, steps, shortage: undefined }
  return withLog(
    { ...state, orders: state.orders.map((o) => (o.id === orderId ? running : o)) },
    `${order.id} 推进到 ${product.operations[nextIndex]}`,
    "info",
  )
}

/** 取消一张工单（未完工的才允许取消） */
export function cancelOrder(state: SandboxState, orderId: string): SandboxState {
  const order = state.orders.find((o) => o.id === orderId)
  if (!order || order.status === "done") return state
  return withLog(
    { ...state, orders: state.orders.map((o) => (o.id === orderId ? { ...o, status: "planned", stepIndex: -1, steps: o.steps.map((s) => ({ ...s, status: "pending" })) } : o)) },
    `${order.id} 已撤回，原料不退还（模拟已投料）`,
    "warn",
  )
}
