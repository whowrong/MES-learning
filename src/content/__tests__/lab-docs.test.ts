// 实操营题目文档的一一对应校验：不允许有题无文档，也不允许有文档无题。
//
// 规则：
// 1. 每一道数据库实操营题目、每一道运维实操营题目都必须带 doc 引用字段，
//    且引用的文档文件真实存在；
// 2. public/content/labs/ 下不允许存在没有对应题目的孤儿文档；
// 3. 每份文档必须包含约定的 10 个章节（人读的信息 + AI 可解析的执行要点都在里面）；
// 4. 文档必须与题目内容对得上（题面、验收判据都出现在文档里），题目改了要重新生成文档；
// 5. 文档里不得出现口令、密钥、token。
import { describe, expect, it } from "vitest"

const docFiles = import.meta.glob("../../../public/content/labs/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>

const dbFiles = import.meta.glob("../../../public/content/db-training/*.json", { eager: true }) as Record<string, unknown>
const opsFiles = import.meta.glob("../../../public/content/ops-training/*.json", { eager: true }) as Record<string, unknown>

interface Question {
  id: string
  title: string
  kind: "db" | "ops-terminal" | "ops-choice" | "ops-order"
  module: string
  doc?: { id?: string; path?: string; title?: string }
  accept?: string[]
  checkSql?: string
  goal?: string
  objective?: string
}

const questions: Question[] = []
for (const mod of Object.values(dbFiles) as Array<Record<string, unknown>>) {
  const tasks = (mod.tasks ?? []) as Array<Record<string, unknown>>
  for (const t of tasks) {
    const check = (t.check ?? {}) as Record<string, unknown>
    questions.push({
      id: String(t.id),
      title: String(t.title),
      kind: "db",
      module: `数据库实操营 · ${String(mod.groupName)}`,
      doc: t.doc as Question["doc"],
      checkSql: typeof check.sql === "string" ? check.sql : undefined,
      goal: typeof t.goal === "string" ? t.goal : undefined,
    })
  }
}
for (const mod of Object.values(opsFiles) as Array<Record<string, unknown>>) {
  const items = (mod.items ?? []) as Array<Record<string, unknown>>
  for (const it of items) {
    const steps = (it.steps ?? []) as Array<Record<string, unknown>>
    const ticket = (it.ticket ?? {}) as Record<string, unknown>
    questions.push({
      id: String(it.id),
      title: String(it.title),
      kind: it.kind === "terminal" ? "ops-terminal" : it.kind === "choice" ? "ops-choice" : "ops-order",
      module: `运维实操营 · ${String(mod.domainName)}`,
      doc: it.doc as Question["doc"],
      accept: steps.map((s) => String((s.accept ?? []).join(""))).filter(Boolean),
      objective: typeof ticket.objective === "string" ? ticket.objective : undefined,
    })
  }
}

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

function docText(id: string): string | undefined {
  const key = Object.keys(docFiles).find((k) => k.endsWith(`/labs/${id}.md`))
  return key ? docFiles[key] : undefined
}

describe("题目与文档一一对应", () => {
  it("题目总量符合预期（数据库实操营 20 题 + 运维实操营 28 条）", () => {
    const db = questions.filter((q) => q.kind === "db")
    const ops = questions.filter((q) => q.kind !== "db")
    const terminal = questions.filter((q) => q.kind === "ops-terminal")
    expect(db.length).toBe(20)
    // 运维实操营：原有 20 条 + 本轮新增 7 道小型排障题 + 1 道大型综合题
    expect(ops.length).toBe(28)
    expect(terminal.length).toBe(16)
    expect(questions.length).toBe(48)
  })

  it("每道题目都带 doc 引用字段，且文档真实存在", () => {
    for (const q of questions) {
      expect(q.doc, `${q.id} 缺 doc 引用字段`).toBeTruthy()
      expect(q.doc!.id).toBe(q.id)
      expect(q.doc!.path).toBe(`/content/labs/${q.id}.md`)
      expect(docText(q.id), `${q.id} 的文档文件缺失`).toBeTruthy()
    }
  })

  it("没有孤儿文档（目录里每个 .md 都对应一道题）", () => {
    const ids = new Set(questions.map((q) => q.id))
    const files = Object.keys(docFiles).map((k) => k.split("/").pop()!.replace(/\.md$/, ""))
    for (const f of files) {
      expect(ids.has(f), `孤儿文档：${f}`).toBe(true)
    }
    expect(files.length).toBe(questions.length)
  })

  it("每份文档都包含约定的章节与演练提示", () => {
    for (const q of questions) {
      const content = docText(q.id)!
      for (const section of REQUIRED_SECTIONS) {
        expect(content.includes(section), `${q.id} 文档缺章节：${section}`).toBe(true)
      }
      expect(content.includes("演练专用"), `${q.id} 文档缺演练专用提示`).toBe(true)
      expect(content.includes("可机器判定"), `${q.id} 文档缺机器判据说明`).toBe(true)
    }
  })

  it("文档与题目内容对得上（题面与验收判据都在文档里）", () => {
    for (const q of questions) {
      const content = docText(q.id)!
      expect(content.includes(q.title), `${q.id} 文档标题与题目不一致`).toBe(true)
      if (q.kind === "db" && q.checkSql) {
        const normalized = q.checkSql.replace(/\s+/g, " ").trim()
        expect(content.includes(normalized), `${q.id} 文档缺校验 SQL`).toBe(true)
      }
      if (q.kind === "ops-terminal") {
        for (const pattern of q.accept ?? []) {
          expect(content.includes(pattern.replace(/\s+/g, " ").trim()), `${q.id} 文档缺验收正则 ${pattern}`).toBe(true)
        }
      }
    }
  })

  it("文档里不出现口令、密钥、token 等敏感串", () => {
    const forbidden = /password\s*[:=]\s*\S+|passwd|secret\s*[:=]|token\s*[:=]|ghp_[A-Za-z0-9]{10,}|sk_[A-Za-z0-9]{10,}/i
    for (const [k, content] of Object.entries(docFiles)) {
      expect(forbidden.test(content), `${k} 里出现疑似敏感串`).toBe(false)
    }
  })
})
