// 练习库表结构漂移测试。
//
// 前端提示词里用的表结构（src/game/practiceSchema.ts）与服务端真正建的表
// （server/seed-practice-db.mjs）必须一致，否则模型会照着错的列名写 SQL。
// 这里直接解析建表语句逐表逐列比对，并把真实行数也比一遍。
import { describe, expect, it } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { fileURLToPath } from "node:url"
import { seedPracticeDb, exportPracticeSql } from "../seed-practice-db.mjs"
import { PRACTICE_TABLES, buildPracticeSchemaPrompt } from "@/game/practiceSchema"

/** 解析 server/seed-practice-db.mjs 里的 CREATE TABLE 语句 */
function parseSeedDdl(): Map<string, { name: string; type: string; primaryKey: boolean }[]> {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const src = fs.readFileSync(path.join(here, "..", "seed-practice-db.mjs"), "utf8")
  const tables = new Map<string, { name: string; type: string; primaryKey: boolean }[]>()
  const re = /CREATE TABLE (\w+) \(([^;]+)\);/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const table = m[1]
    const cols: { name: string; type: string; primaryKey: boolean }[] = []
    for (const part of m[2].split(",")) {
      const t = part.trim()
      if (!t) continue
      const cm = t.match(/^(\w+)\s+(\w+)(\s+PRIMARY KEY)?(\s+AUTOINCREMENT)?$/)
      if (!cm) continue
      cols.push({ name: cm[1], type: cm[2], primaryKey: Boolean(cm[3]) })
    }
    tables.set(table, cols)
  }
  return tables
}

describe("练习库表结构与前端常量一致", () => {
  it("解析得到 8 张表", () => {
    const ddl = parseSeedDdl()
    expect(ddl.size).toBe(8)
    expect([...ddl.keys()].sort()).toEqual(PRACTICE_TABLES.map((t) => t.name).sort())
  })

  it("逐表逐列比对：表名、列名、列顺序、类型、主键", () => {
    const ddl = parseSeedDdl()
    for (const t of PRACTICE_TABLES) {
      const seed = ddl.get(t.name)
      expect(seed, `建表语句里缺少表 ${t.name}`).toBeTruthy()
      expect(t.columns.map((c) => c.name)).toEqual((seed as { name: string }[]).map((c) => c.name))
      expect(t.columns.map((c) => c.type)).toEqual((seed as { type: string }[]).map((c) => c.type))
      expect(t.columns.map((c) => Boolean(c.primaryKey))).toEqual(
        (seed as { primaryKey: boolean }[]).map((c) => c.primaryKey),
      )
    }
  })

  it("与真实建出来的库再比一遍（PRAGMA table_info 是最终事实）", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mes-practice-pragma-"))
    const dbPath = path.join(dir, "practice.db")
    try {
      seedPracticeDb(dbPath)
      const db = new DatabaseSync(dbPath)
      for (const t of PRACTICE_TABLES) {
        const cols = db.prepare(`PRAGMA table_info(${t.name})`).all() as {
          name: string
          type: string
          pk: number
        }[]
        expect(cols.map((c) => c.name), `${t.name} 列名不一致`).toEqual(t.columns.map((c) => c.name))
        expect(cols.map((c) => c.type), `${t.name} 列类型不一致`).toEqual(t.columns.map((c) => c.type))
        expect(cols.map((c) => c.pk > 0), `${t.name} 主键不一致`).toEqual(
          t.columns.map((c) => Boolean(c.primaryKey)),
        )
      }
      db.close()
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it("行数与真实种子跑出来的行数一致", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mes-practice-schema-"))
    const dbPath = path.join(dir, "practice.db")
    try {
      seedPracticeDb(dbPath)
      const db = new DatabaseSync(dbPath)
      for (const t of PRACTICE_TABLES) {
        const row = db.prepare(`SELECT COUNT(*) AS c FROM ${t.name}`).get() as { c: number }
        expect(row.c, `${t.name} 行数不一致`).toBe(t.rows)
      }
      db.close()
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it("提示词里给出真实列名（items.item_name / work_reports.employee_no）", () => {
    const prompt = buildPracticeSchemaPrompt()
    expect(prompt).toContain("item_name")
    expect(prompt).toContain("employee_no")
    expect(prompt).toContain("items")
    expect(prompt).not.toMatch(/items\.name\b/)
  })
})

// 三种方言的导出语句：模式 B 的一次性容器靠它灌练习库。
describe("练习库的三种方言导出", () => {
  it("插入条数：mysql/postgres 231 行，sqlserver 230 行（主键忽略尾随空格的重复行存不下）", () => {
    for (const d of ["mysql", "postgres"] as const) {
      const { inserts } = exportPracticeSql(d)
      expect(inserts.length, `${d} 插入条数不对`).toBe(231)
    }
    expect(exportPracticeSql("sqlserver").inserts.length).toBe(230)
  })

  it("sqlserver：自增列不进插入列清单（IDENTITY 不能显式给值）", () => {
    const { ddl, inserts } = exportPracticeSql("sqlserver")
    expect(ddl.join("\n")).toContain("IDENTITY(1,1)")
    // bom / inventory / work_reports 是带自增 id 的表
    expect(inserts.some((s) => /^INSERT INTO bom \(id,/i.test(s))).toBe(false)
    expect(inserts.some((s) => /^INSERT INTO inventory \(id,/i.test(s))).toBe(false)
    expect(inserts.some((s) => /^INSERT INTO work_reports \(id,/i.test(s))).toBe(false)
    // 有主键的表照常带主键列
    expect(inserts.some((s) => /^INSERT INTO items \(item_code,/i.test(s))).toBe(true)
  })

  it("建表语句幂等：灌库失败重试不会撞上「表已存在」", () => {
    expect(exportPracticeSql("mysql").ddl.join("\n")).toContain("CREATE TABLE IF NOT EXISTS")
    expect(exportPracticeSql("postgres").ddl.join("\n")).toContain("CREATE TABLE IF NOT EXISTS")
    expect(exportPracticeSql("sqlserver").ddl.join("\n")).toContain("IF OBJECT_ID(")
  })

  it("sqlserver：字符串字面量带 N 前缀，保留字列名加方括号", () => {
    const { inserts } = exportPracticeSql("sqlserver")
    expect(inserts.some((s) => s.includes("N'"))).toBe(true)
    expect(inserts.some((s) => /\[role\]|\[shift\]/.test(s))).toBe(true)
  })
})

describe("练习库的三种方言导出（模式 B 灌库用）", () => {
  it("mysql / postgres 仍是完整 231 行", () => {
    expect(exportPracticeSql("mysql").inserts.length).toBe(231)
    expect(exportPracticeSql("postgres").inserts.length).toBe(231)
  })

  it("sqlserver 跳过尾随空格重复行（SQL Server 主键忽略尾随空格，存不下）", () => {
    const { inserts, skipped } = exportPracticeSql("sqlserver")
    expect(skipped).toEqual([{ 表: "items", 主键: "stl-q235-10" }])
    expect(inserts.length).toBe(230)
    expect(inserts.filter((s) => s.startsWith("INSERT INTO items")).length).toBe(23)
  })

  it("sqlserver 插入语句不带 IDENTITY 自增列，也不带尾随空格脏码", () => {
    const { inserts } = exportPracticeSql("sqlserver")
    expect(inserts.some((s) => /INSERT INTO bom \(id,/.test(s))).toBe(false)
    // items 主键里不再有带尾随空格的脏码（bom/inventory 里的引用列照旧保留）
    expect(inserts.filter((s) => s.startsWith("INSERT INTO items")).some((s) => /N'STL-Q235-10 '/.test(s))).toBe(false)
  })
})
