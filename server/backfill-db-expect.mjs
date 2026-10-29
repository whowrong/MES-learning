#!/usr/bin/env node
// backfill-db-expect.mjs — 内容维护工具：对内置练习库执行每个任务的 check.sql，
// 把真实结果回填进任务文件的 check.expect（result 模式）；state 模式验证 answerSql 执行后断言成立。
// 用法: node server/backfill-db-expect.mjs
import fs from "node:fs"
import path from "node:path"
import { seedPracticeDb } from "./seed-practice-db.mjs"
import { DatabaseSync } from "node:sqlite"

const TMP_DB = "/workspace/pocketbase-bin/lab-data/practice-tmp.db"
const CONTENT_DIR = "/workspace/app/public/content/db-training"

function normalize(v) {
  if (v === null || v === undefined) return null
  if (typeof v === "bigint") return Number(v)
  return v
}

function runSql(dbPath, sql) {
  const db = new DatabaseSync(dbPath)
  try {
    const text = String(sql || "").trim()
    if (/^(select|with)\b/i.test(text)) {
      const rows = db.prepare(text).all()
      const cols = rows.length ? Object.keys(rows[0]) : []
      return { columns: cols, rows: rows.map((r) => cols.map((c) => normalize(r[c]))) }
    }
    // DDL/DML 用 exec()：node:sqlite 的 prepare() 只编译并执行第一条语句，
    // 多语句的参考答案（例如 clean 组的「改引用 → 删主数据 → 验干净」）会被截断，
    // 导致 state 模式误报「正确答案下断言不成立」。
    db.exec(text)
    return { affected: 0 }
  } finally {
    db.close()
  }
}

seedPracticeDb(TMP_DB)
let filled = 0
let verified = 0
const problems = []

for (const file of ["query.json", "join.json", "clean.json", "report.json"]) {
  const fp = path.join(CONTENT_DIR, file)
  const bank = JSON.parse(fs.readFileSync(fp, "utf8"))
  let changed = false
  for (const task of bank.tasks) {
    // 每个任务从干净库状态出发
    seedPracticeDb(TMP_DB)
    if (task.check.mode === "result") {
      const r = runSql(TMP_DB, task.check.sql)
      if (!r.rows) { problems.push(`${task.id}: check.sql 不是查询`); continue }
      task.check.expect = r.rows
      changed = true
      filled++
      // 参考答案必须能得到同样结果：执行 answerSql 后重跑 check.sql 比对
      // （answerSql 可能是查询，也可能是多语句 DML，统一按「执行后再查」验证）
      seedPracticeDb(TMP_DB)
      runSql(TMP_DB, task.answerSql)
      const r2 = runSql(TMP_DB, task.check.sql)
      if (JSON.stringify(r2.rows) !== JSON.stringify(r.rows)) {
        problems.push(`${task.id}: answerSql 与 check.sql 结果不一致`)
      }
    } else if (task.check.mode === "state") {
      // 模拟用户做对：执行 answerSql 后，check.sql 结果应等于 expect
      runSql(TMP_DB, task.answerSql)
      const r = runSql(TMP_DB, task.check.sql)
      if (JSON.stringify(r.rows) !== JSON.stringify(task.check.expect)) {
        problems.push(`${task.id}: state 断言在正确答案下不成立，得到 ${JSON.stringify(r.rows)}`)
      } else {
        verified++
      }
    }
  }
  if (changed) fs.writeFileSync(fp, JSON.stringify(bank, null, 2) + "\n")
}

fs.rmSync(TMP_DB, { force: true })
console.log(JSON.stringify({ filled, verified, problems }, null, 2))
process.exit(problems.length ? 1 : 0)
