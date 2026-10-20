// 讲解图注册表：术语卡按 illustration 字段取图，加新图在这里登记
import type { ComponentType } from "react"
import { BomTree } from "./BomTree"
import { RouteFlow } from "./RouteFlow"
import { BackflushFlow } from "./BackflushFlow"
import { WorkOrderStates } from "./WorkOrderStates"
import { YieldFunnel } from "./YieldFunnel"
import { WipLevel } from "./WipLevel"
import { InventoryCount } from "./InventoryCount"
import { LossRateBar } from "./LossRateBar"
import { DispatchBoard } from "./DispatchBoard"
import { UnitMismatch } from "./UnitMismatch"
import { DuplicateCodes } from "./DuplicateCodes"
import { CalendarStrip } from "./CalendarStrip"
import { TaktLine } from "./TaktLine"
import { BatchTrace } from "./BatchTrace"
import { ReworkLoop } from "./ReworkLoop"
import { ShiftRotation } from "./ShiftRotation"

export const ILLUSTRATIONS: Record<string, ComponentType> = {
  bom_tree: BomTree,
  route_flow: RouteFlow,
  backflush_flow: BackflushFlow,
  work_order_states: WorkOrderStates,
  yield_funnel: YieldFunnel,
  wip_level: WipLevel,
  inventory_count: InventoryCount,
  loss_rate_bar: LossRateBar,
  dispatch_board: DispatchBoard,
  unit_mismatch: UnitMismatch,
  duplicate_codes: DuplicateCodes,
  calendar_strip: CalendarStrip,
  takt_line: TaktLine,
  batch_trace: BatchTrace,
  rework_loop: ReworkLoop,
  shift_rotation: ShiftRotation,
}

export {
  BomTree,
  RouteFlow,
  BackflushFlow,
  WorkOrderStates,
  YieldFunnel,
  WipLevel,
  InventoryCount,
  LossRateBar,
  DispatchBoard,
  UnitMismatch,
  DuplicateCodes,
  CalendarStrip,
  TaktLine,
  BatchTrace,
  ReworkLoop,
  ShiftRotation,
}
export { ProjectLifecycle } from "./ProjectLifecycle"
export { FactoryShape } from "./FactoryShape"
