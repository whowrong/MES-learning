#!/usr/bin/env node
// progress-guard.mjs — 学习进度不变量校验工具（只读，绝不写生产数据）
//
// 用途: 部署前后对 player_progress 存档做逐条快照与比对，确认
//       「上线前后刘先生的学习进度原样保留」。任何基线记录被改动或消失，
//       都会被判为部署失败（退出码 1），供部署脚本触发自动回滚。
//
// 实现: 直接只读打开 PocketBase 的 SQLite 数据文件（--data-dir 指到 pb_data），
//       不经过 API、不需要超级用户口令、不产生任何写操作，也不会污染存档数据。
//
// 用法:
//   node progress-guard.mjs snapshot --data-dir /workspace/app/pb_data --out snapshot.json
//   node progress-guard.mjs compare --before before.json --after after.json
//
// snapshot 产出: { takenAt, dataFile, recordCount, records: [{ id, created, updated, fields: {...}, hash }] }
// compare 规则:
//   - 基线里的每条记录都必须在 after 中存在，且 fields 完全一致 → 否则算差异
//   - after 里多出来的记录标记为 added（不算失败，但要报告，供人工确认是不是新建的测试记录）
//   - 只比对基线里出现过的字段；部署新增的字段（如 career_history）在旧记录上为空属正常
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { DatabaseSync } from "node:sqlite"

const FIELD_ORDER = [
  "chapter_status", "gauges", "review_queue", "term_mastery", "review_state", "study_days",
  "interview_history", "factory_history", "ops_history", "db_history", "career_history", "last_route",
]

function fail(msg, code = 1) {
  process.stderr.write(`[progress-guard] ${msg}\n`)
  process.exit(code)
}

function openData(dataDir) {
  const candidates = [
    path.join(dataDir, "data.db"),
    path.join(dataDir, "pb_data", "data.db"),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  fail(`找不到 PocketBase 数据文件: 试过 ${candidates.join(", ")}`)
}

function snapshot(dataDir) {
  const file = openData(dataDir)
  const db = new DatabaseSync(file, { readOnly: true })
  let tables = []
  try {
    tables = db.prepare("select name from sqlite_master where type='table'").all().map((r) => String(r.name))
  } finally {
    db.close()
  }
  if (!tables.includes("player_progress")) {
    return { takenAt: new Date().toISOString(), dataFile: file, recordCount: 0, records: [], note: "player_progress 集合不存在" }
  }
  const db2 = new DatabaseSync(file, { readOnly: true })
  let rows = []
  try {
    // 整行读出来，再按约定字段顺序取值；不认识的列直接忽略（老实例字段更少也照样能读）
    rows = db2.prepare("select * from player_progress").all()
  } finally {
    db2.close()
  }
  const records = rows.map((r) => {
    const fields = {}
    for (const f of FIELD_ORDER) {
      if (f in r) fields[f] = r[f] === null || r[f] === undefined ? null : String(r[f])
    }
    const hash = crypto.createHash("sha256").update(JSON.stringify(fields)).digest("hex")
    return {
      id: String(r.id),
      created: String(r.created ?? ""),
      updated: String(r.updated ?? ""),
      fields,
      hash,
    }
  })
  records.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return {
    takenAt: new Date().toISOString(),
    dataFile: file,
    recordCount: records.length,
    records,
  }
}

function compare(beforePath, afterPath) {
  const before = JSON.parse(fs.readFileSync(beforePath, "utf8"))
  const after = JSON.parse(fs.readFileSync(afterPath, "utf8"))
  const beforeMap = new Map((before.records || []).map((r) => [r.id, r]))
  const afterMap = new Map((after.records || []).map((r) => [r.id, r]))
  const changed = []
  const missing = []
  for (const [id, b] of beforeMap) {
    const a = afterMap.get(id)
    if (!a) {
      missing.push(id)
      continue
    }
    const diffFields = []
    for (const k of Object.keys(b.fields || {})) {
      const bv = b.fields[k]
      const av = a.fields ? a.fields[k] : undefined
      if (String(bv ?? "") !== String(av ?? "")) diffFields.push({ field: k, before: bv, after: av ?? null })
    }
    if (diffFields.length) changed.push({ id, fields: diffFields })
  }
  const added = [...afterMap.keys()].filter((id) => !beforeMap.has(id))
  const ok = changed.length === 0 && missing.length === 0
  const report = {
    ok,
    checkedAt: new Date().toISOString(),
    before: { takenAt: before.takenAt, recordCount: before.recordCount },
    after: { takenAt: after.takenAt, recordCount: after.recordCount },
    changed,
    missing,
    added,
  }
  process.stdout.write(JSON.stringify(report, null, 2) + "\n")
  if (!ok) {
    process.stderr.write(
      `[progress-guard] 学习进度不变量校验失败: 变更 ${changed.length} 条, 丢失 ${missing.length} 条\n`,
    )
  }
  process.exit(ok ? 0 : 1)
}

const [cmd, ...rest] = process.argv.slice(2)
const args = {}
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    const key = rest[i].slice(2)
    const next = rest[i + 1]
    if (next && !next.startsWith("--")) {
      args[key] = next
      i++
    } else {
      args[key] = true
    }
  }
}

if (cmd === "snapshot") {
  if (!args["data-dir"]) fail("缺少 --data-dir")
  const snap = snapshot(args["data-dir"])
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true })
    fs.writeFileSync(args.out, JSON.stringify(snap, null, 2) + "\n")
    process.stderr.write(`[progress-guard] 快照已写入 ${args.out}（${snap.recordCount} 条存档记录）\n`)
  } else {
    process.stdout.write(JSON.stringify(snap, null, 2) + "\n")
  }
  process.exit(0)
} else if (cmd === "compare") {
  if (!args.before || !args.after) fail("缺少 --before 或 --after")
  compare(args.before, args.after)
} else {
  fail("用法: progress-guard.mjs snapshot --data-dir <pb_data> --out <file> | compare --before <f> --after <f>")
}
