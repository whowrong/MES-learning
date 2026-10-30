// 自由沙盘内容红线扫描：public/content/sandbox/index.json
import { describe, expect, it } from "vitest"
import sandboxRaw from "../../../public/content/sandbox/index.json"
import { validateSandboxContent, type SandboxContent } from "@/content/sandbox"

const content = sandboxRaw as SandboxContent

describe("沙盘内容结构", () => {
  it("通过 validateSandboxContent 校验", () => {
    expect(() => validateSandboxContent(content)).not.toThrow()
  })

  it("模块 id 与站内路由约定一致", () => {
    expect(content.moduleId).toBe("sandbox")
    expect(content.title.length).toBeGreaterThan(0)
    expect(content.intro.length).toBeGreaterThan(20)
  })

  it("物料至少 4 种，库存都是数字", () => {
    expect(content.materials.length).toBeGreaterThanOrEqual(4)
    for (const m of content.materials) {
      expect(typeof m.initial).toBe("number")
      expect(m.unit.length).toBeGreaterThan(0)
      if (m.note) expect(m.note.length).toBeGreaterThan(4)
    }
  })

  it("至少两个产品，每个都有 BOM 与多道工序", () => {
    expect(content.products.length).toBeGreaterThanOrEqual(2)
    for (const p of content.products) {
      expect(p.bom.length).toBeGreaterThan(0)
      expect(p.operations.length).toBeGreaterThanOrEqual(3)
    }
  })

  it("工作中心数量够用，提示语不少于 3 条", () => {
    expect(content.workCenters.length).toBeGreaterThanOrEqual(3)
    expect(content.tips.length).toBeGreaterThanOrEqual(3)
    for (const tip of content.tips) expect(tip.length).toBeGreaterThan(10)
  })

  it("每个产品的 BOM 都用到了不同物料，能演示断料", () => {
    const used = new Set<string>()
    for (const p of content.products) for (const line of p.bom) used.add(line.material)
    expect(used.size).toBeGreaterThanOrEqual(4)
  })
})
