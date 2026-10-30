// 实操营题目文档的一一对应校验：不允许有题无文档，也不允许有文档无题。
//
// 规则：
// 1. 每一道数据库实操营题目、每一道运维实操营题目都必须带 doc 引用字段，
//    且引用的文档文件真实存在；
// 2. public/content/labs/ 下不允许存在没有对应题目的孤儿文档；
// 3. 每份文档必须包含约定的 10 个章节（人读的信息 + AI 可解析的执行要点都在里面）；
// 4. 文档内容必须与生成器输出一致（题目改了要重新生成文档，防止文档漂移）。
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { buildAll, collectQuestions, renderLabDoc } from "../../../../scripts/build-lab-docs.mjs"

const LABS_DIR = path.resolve(process.cwd(), "public/content/labs")
const META = JSON.parse(fs.readFileSync(path.join(LABS_DIR, "meta.json"), "utf8"))
const REQUIRED_SECTIONS = [
  "## 1. 题目目标与业务背景",
  "## 2. 涉及的数据表或服务",
  "## 3. 需要的账号与权限",
  "## 4. 环境要求（演练专用）",
  "### 4.1 规格基线",
  "### 4.2 额外要求",
  "### 4.3 破坏性提示",
  "## 5. 标准步骤",
  "## 6. 验收标准（可机器判定）",
  "## 7. 常见错误与排查提示",
  "## 8. AI 环境准备步骤（供站内 AI 生成准备脚本）",
  "## 9. AI 执行脚本要点（供站内 AI 生成执行脚本）",
  "## 10. 安全边界与失败处理",
]

const questions = collectQuestions()

describe("题目与文档一一对应", () => {
  it("题目总量符合预期（数据库实操营 20 题 + 运维实操营 28 条）", () => {
    const db = questions.filter((q: { kind: string }) => q.kind === "db")
    const ops = questions.filter((q: { kind: string }) => q.kind !== "db")
    const terminal = questions.filter((q: { kind: string }) => q.kind === "ops-terminal")
    expect(db.length).toBe(20)
    // 运维实操营：原有 20 条 + 本轮新增 7 道小型排障题 + 1 道大型综合题
    expect(ops.length).toBe(28)
    expect(terminal.length).toBe(16)
    expect(questions.length).toBe(48)
  })

  it("每道题目都带 doc 引用字段，且指向真实存在的文档", () => {
    for (const q of questions as Array<{ id: string; raw: Record<string, unknown> }>) {
      const doc = q.raw.doc as { id?: string; path?: string } | undefined
      expect(doc, `${q.id} 缺 doc 引用字段`).toBeTruthy()
      expect(doc!.id).toBe(q.id)
      expect(doc!.path).toBe(`/content/labs/${q.id}.md`)
      const file = path.join(LABS_DIR, `${q.id}.md`)
      expect(fs.existsSync(file), `${q.id} 的文档文件缺失`).toBe(true)
    }
  })

  it("没有孤儿文档（目录里每个 .md 都对应一道题）", () => {
    const ids = new Set((questions as Array<{ id: string }>).map((q) => q.id))
    const files = fs.readdirSync(LABS_DIR).filter((f) => f.endsWith(".md"))
    for (const f of files) {
      expect(ids.has(f.replace(/\.md$/, "")), `孤儿文档：${f}`).toBe(true)
    }
    expect(files.length).toBe(questions.length)
  })

  it("每份文档都包含约定的章节（人读信息 + AI 执行要点）", () => {
    for (const q of questions as Array<{ id: string }>) {
      const content = fs.readFileSync(path.join(LABS_DIR, `${q.id}.md`), "utf8")
      for (const section of REQUIRED_SECTIONS) {
        expect(content.includes(section), `${q.id} 文档缺章节：${section}`).toBe(true)
      }
      expect(content.includes("演练专用"), `${q.id} 文档缺演练专用提示`).toBe(true)
      expect(content.includes("可机器判定"), `${q.id} 文档缺机器判据说明`).toBe(true)
    }
  })

  it("文档内容与生成器输出一致（题目变了要重新生成文档）", () => {
    const meta = JSON.parse(fs.readFileSync(path.join(LABS_DIR, "meta.json"), "utf8"))
    for (const q of questions as Array<{ id: string }>) {
      const onDisk = fs.readFileSync(path.join(LABS_DIR, `${q.id}.md`), "utf8")
      const rendered = renderLabDoc(q, meta)
      expect(onDisk, `${q.id} 文档已过期，请运行 node scripts/build-lab-docs.mjs`).toBe(rendered)
    }
  })

  it("文档里不出现口令、密钥、token 等敏感串", () => {
    const forbidden = /password\s*[:=]\s*\S+|passwd|secret\s*[:=]|token\s*[:=]|ghp_[A-Za-z0-9]{10,}|sk_[A-Za-z0-9]{10,}/i
    for (const f of fs.readdirSync(LABS_DIR).filter((f) => f.endsWith(".md"))) {
      const content = fs.readFileSync(path.join(LABS_DIR, f), "utf8")
      expect(forbidden.test(content), `${f} 里出现疑似敏感串`).toBe(false)
    }
  })

  it("生成器可重复执行且结果稳定", () => {
    const before = fs.readdirSync(LABS_DIR).filter((f) => f.endsWith(".md")).map((f) => fs.readFileSync(path.join(LABS_DIR, f), "utf8"))
    buildAll()
    const after = fs.readdirSync(LABS_DIR).filter((f) => f.endsWith(".md")).map((f) => fs.readFileSync(path.join(LABS_DIR, f), "utf8"))
    expect(after).toEqual(before)
    expect(META.version).toBe(1)
  })
})
