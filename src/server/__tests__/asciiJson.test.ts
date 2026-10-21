import { describe, expect, it } from "vitest"
// @ts-ignore 服务端 ESM 脚本无类型声明，运行时由 vitest 直接解析
import { asciiSafeJson } from "../../../server/asciiJson.mjs"

// v1.14.2 回归：pb_hooks 对 $os.cmd 输出逐字节 String.fromCharCode（Latin-1 等价），
// UTF-8 中文会变 mojibake（「Q235钢板」→「Q235é¢æ¿」），导致结果比对永远失败。
describe("asciiSafeJson（服务端执行器输出防乱码）", () => {
  it("输出为纯 ASCII 字符流（hook 逐字节转换无损的前提）", () => {
    const s = asciiSafeJson({ rows: [["Q235钢板", "已完成"], ["emoji😀"]] }) as string
    expect(Array.from(s).every((ch) => ch.codePointAt(0)! < 128)).toBe(true)
  })

  it("JSON.parse 后中文与增补平面字符正确还原", () => {
    const src = { rows: [["Q235钢板", "已完成"], ["emoji😀"]], n: 16 }
    expect(JSON.parse(asciiSafeJson(src))).toEqual(src)
  })

  it("完整模拟 pb_hooks 链路：字节数组 → 分块 fromCharCode → JSON.parse", () => {
    const src = { ok: true, columns: ["item_name"], rows: [["Q235钢板 "]] }
    const stdout = asciiSafeJson(src) as string
    const bytes = Array.from(stdout).map((ch) => ch.charCodeAt(0))
    let text = ""
    for (let j = 0; j < bytes.length; j += 8192) {
      text += String.fromCharCode.apply(null, bytes.slice(j, j + 8192))
    }
    expect(JSON.parse(text)).toEqual(src)
  })

  it("ASCII 内容原样保留（不产生多余转义）", () => {
    expect(asciiSafeJson({ a: 1, b: "SELECT 1" })).toBe('{"a":1,"b":"SELECT 1"}')
  })
})
