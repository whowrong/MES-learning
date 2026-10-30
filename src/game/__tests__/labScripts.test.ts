// AI 演练脚本：提示词拼装、模型输出解析、危险判定、步骤断言与环境不符检测。
import { describe, expect, it } from "vitest"
import {
  buildLabScriptPrompt,
  detectLabDanger,
  environmentMismatch,
  extractJsonBlock,
  looksLikeProduction,
  matchLabAssert,
  stripCommandWrappers,
  parseLabScriptResponse,
  type LabStep,
} from "@/game/labScripts"

const GOOD = JSON.stringify({
  env_check: ["确认连接可达"],
  prep_steps: [
    { id: "p1", title: "建表", command: "CREATE TABLE demo(id INT);", expect: "表建好", assert: ["^CREATE TABLE"], danger: false },
  ],
  exec_steps: [
    { id: "e1", title: "查行数", command: "SELECT COUNT(*) FROM demo;", expect: "0", assert: ["0"], danger: false },
  ],
  notes: "演练环境，随便造",
})

describe("提示词拼装", () => {
  it("带题目、文档与连接描述，且不含口令", () => {
    const prompt = buildLabScriptPrompt({
      title: "月会拷问",
      doc: "# 月会拷问\n- 验收标准",
      connection: { kind: "db", type: "mysql", host: "10.0.0.9", port: 3306, database: "drill", username: "drill" },
    })
    expect(prompt).toContain("月会拷问")
    expect(prompt).toContain("10.0.0.9")
    expect(prompt).toContain("drill")
    expect(prompt).toContain("JSON")
    expect(prompt.toLowerCase()).not.toContain("password=")
  })

  it("服务器连接同样不携带凭据", () => {
    const prompt = buildLabScriptPrompt({
      title: "磁盘打满",
      doc: "文档",
      connection: { kind: "server", host: "10.0.0.8", port: 22, username: "ops" },
    })
    expect(prompt).toContain("10.0.0.8")
    expect(prompt.toLowerCase()).not.toContain("privatekey")
  })
})

describe("模型输出解析", () => {
  it("能解析标准 JSON（含代码块包裹）", () => {
    const parsed = parseLabScriptResponse("```json\n" + GOOD + "\n```")
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.script.prep_steps).toHaveLength(1)
    expect(parsed.script.exec_steps[0].command).toContain("SELECT")
    expect(parsed.script.prep_steps[0].assert).toEqual(["^CREATE TABLE"])
  })

  it("解析失败要明确报错，不静默通过", () => {
    const bad = parseLabScriptResponse("这里没有 JSON")
    expect(bad.ok).toBe(false)
    if (bad.ok) return
    expect(bad.error).toContain("JSON")
  })

  it("缺 assert 的步骤直接丢弃整份结果", () => {
    const parsed = parseLabScriptResponse(
      JSON.stringify({ prep_steps: [{ id: "p1", command: "ls", expect: "", assert: [] }], exec_steps: [] }),
    )
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toContain("assert")
  })

  it("extractJsonBlock 能从废话里抠出 JSON", () => {
    expect(extractJsonBlock("好的，结果如下：{\"a\":1} 以上。")).toBe('{"a":1}')
    expect(extractJsonBlock("没有大括号")).toBeNull()
  })
})

describe("危险命令判定", () => {
  it("删除/清库/重启类命令要拦", () => {
    expect(detectLabDanger("rm -rf /data/archive").danger).toBe(true)
    expect(detectLabDanger("DROP TABLE work_orders;").danger).toBe(true)
    expect(detectLabDanger("systemctl stop nginx").danger).toBe(true)
  })

  it("只读命令不拦", () => {
    expect(detectLabDanger("df -h /data").danger).toBe(false)
    expect(detectLabDanger("SELECT COUNT(*) FROM work_orders;").danger).toBe(false)
  })
})

describe("步骤断言", () => {
  const step: LabStep = { id: "s1", title: "t", command: "df -h", expect: "", assert: ["^Filesystem"] }
  it("命中任一正则即通过", () => {
    expect(matchLabAssert(step, "Filesystem Size Used")).toBe(true)
    expect(matchLabAssert(step, "nothing here")).toBe(false)
  })

  it("命令带 sudo / env / timeout 包装时仍按去掉包装后的命令判定", () => {
    const findStep: LabStep = { id: "s2", title: "t", command: "find", expect: "", assert: ["^find\\b.*-mtime"] }
    expect(matchLabAssert(findStep, "sudo find /data/archive -mtime +14")).toBe(true)
    expect(matchLabAssert(findStep, "find /data/archive -mtime +14")).toBe(true)
    const dfStep: LabStep = { id: "s3", title: "t", command: "df", expect: "", assert: ["^df\\b"] }
    expect(matchLabAssert(dfStep, "timeout 10 df -i /data")).toBe(true)
    expect(matchLabAssert(dfStep, "env LANG=C df -i /data")).toBe(true)
    expect(matchLabAssert(dfStep, "sudo -n df -i /data")).toBe(true)
    expect(matchLabAssert(dfStep, "cat /etc/hosts")).toBe(false)
  })

  it("去掉包装只影响命令头部，命令本体仍按原样判定", () => {
    expect(stripCommandWrappers("sudo find /data -mtime +14")).toBe("find /data -mtime +14")
    expect(stripCommandWrappers("env LANG=C df -h")).toBe("df -h")
    expect(stripCommandWrappers("df -h")).toBe("df -h")
  })
})

describe("生产环境识别与环境不符", () => {
  it("带 prod / 生产 / 正式 的主机名要提示", () => {
    expect(looksLikeProduction("prod-mysql-01")).toBe(true)
    expect(looksLikeProduction("MES-PROD-DB")).toBe(true)
    expect(looksLikeProduction("生产库服务器")).toBe(true)
    expect(looksLikeProduction("10.0.0.9")).toBe(false)
    expect(looksLikeProduction("drill-mysql-01")).toBe(false)
  })

  it("文档点名 MySQL 而连的是 PostgreSQL 要提示", () => {
    const doc = "数据库版本：MySQL 8.0.x / MariaDB 10.11"
    expect(environmentMismatch(doc, { kind: "db", type: "postgres" })).toContain("环境不符")
    expect(environmentMismatch(doc, { kind: "db", type: "mysql" })).toBeNull()
    expect(environmentMismatch(doc, { kind: "server" })).toBeNull()
  })
})
