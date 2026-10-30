// 自由沙盘：内容加载器与类型定义。
//
// 内容与代码分离（与站内其它模块一致）：物料、产品 BOM、工序、提示语都放在
// public/content/sandbox/index.json，代码只负责加载、校验与渲染。
import { getBasename } from "@/lib/pb"
import type { SandboxContent } from "@/game/sandbox"

export type { SandboxContent }

function contentUrl(path: string): string {
  const base = getBasename().replace(/\/$/, "")
  return `${base}/content/${path}`
}

/** 校验沙盘内容结构：缺关键字段直接报错，不渲染到一半崩 */
export function validateSandboxContent(content: SandboxContent): SandboxContent {
  if (!content || typeof content.moduleId !== "string") throw new Error("沙盘内容缺少 moduleId")
  if (!Array.isArray(content.materials) || content.materials.length === 0) throw new Error("沙盘内容缺物料")
  if (!Array.isArray(content.products) || content.products.length === 0) throw new Error("沙盘内容缺产品")
  if (!Array.isArray(content.workCenters) || content.workCenters.length === 0) throw new Error("沙盘内容缺工作中心")
  if (!Array.isArray(content.tips) || content.tips.length === 0) throw new Error("沙盘内容缺提示语")
  const materialIds = new Set<string>()
  for (const m of content.materials) {
    if (!m.id || !m.name || !m.unit) throw new Error("沙盘物料缺 id / name / unit")
    if (!Number.isFinite(m.initial)) throw new Error(`沙盘物料 ${m.id} 缺初始库存`)
    if (materialIds.has(m.id)) throw new Error(`沙盘物料 id 重复：${m.id}`)
    materialIds.add(m.id)
  }
  const wcIds = new Set<string>()
  for (const w of content.workCenters) {
    if (!w.id || !w.name) throw new Error("沙盘工作中心缺 id / name")
    if (wcIds.has(w.id)) throw new Error(`沙盘工作中心 id 重复：${w.id}`)
    wcIds.add(w.id)
  }
  const productIds = new Set<string>()
  for (const p of content.products) {
    if (!p.id || !p.name) throw new Error("沙盘产品缺 id / name")
    if (productIds.has(p.id)) throw new Error(`沙盘产品 id 重复：${p.id}`)
    productIds.add(p.id)
    if (!Array.isArray(p.operations) || p.operations.length === 0) throw new Error(`沙盘产品 ${p.id} 缺工序`)
    for (const op of p.operations) {
      if (!wcIds.has(op)) throw new Error(`沙盘产品 ${p.id} 引用了未知工序 ${op}`)
    }
    if (!Array.isArray(p.bom) || p.bom.length === 0) throw new Error(`沙盘产品 ${p.id} 缺 BOM`)
    for (const line of p.bom) {
      if (!materialIds.has(line.material)) throw new Error(`沙盘产品 ${p.id} 引用了未知物料 ${line.material}`)
      if (!Number.isFinite(line.qty) || line.qty <= 0) throw new Error(`沙盘产品 ${p.id} 的 BOM 用量非法`)
    }
  }
  return content
}

/** 拉取沙盘内容 */
export async function loadSandboxContent(): Promise<SandboxContent> {
  const res = await fetch(contentUrl("sandbox/index.json"))
  if (!res.ok) throw new Error(`沙盘内容加载失败（HTTP ${res.status}）`)
  return validateSandboxContent((await res.json()) as SandboxContent)
}
