// 讲解图注册表：术语卡按 illustration 字段取图，加新图在这里登记
import type { ComponentType } from "react"
import { BomTree } from "./BomTree"
import { RouteFlow } from "./RouteFlow"
import { BackflushFlow } from "./BackflushFlow"
import { WorkOrderStates } from "./WorkOrderStates"
import { YieldFunnel } from "./YieldFunnel"
import { WipLevel } from "./WipLevel"

export const ILLUSTRATIONS: Record<string, ComponentType> = {
  bom_tree: BomTree,
  route_flow: RouteFlow,
  backflush_flow: BackflushFlow,
  work_order_states: WorkOrderStates,
  yield_funnel: YieldFunnel,
  wip_level: WipLevel,
}

export { BomTree, RouteFlow, BackflushFlow, WorkOrderStates, YieldFunnel, WipLevel }
export { ProjectLifecycle } from "./ProjectLifecycle"
