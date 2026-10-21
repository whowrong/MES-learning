#!/usr/bin/env node
// dblab.mjs — 数据库实操营服务端执行器（由 pb_hooks 经 $os.cmd 调用）
// 输入: argv[2] = JSON 字符串  输出: stdout 单行 JSON，永远 exit 0（错误也在 JSON 里）
// 支持: builtin(node:sqlite 内置练习库) / mysql(mysql2) / sqlserver(mssql) / postgres(pg)
// 凭据文件: LAB_DATA/db-connections.json —— 明文只落此文件（仓库外，chmod 600），列表/回显一律脱敏
import { DatabaseSync } from "node:sqlite"
import fs from "node:fs"
import path from "node:path"
import { seedPracticeDb } from "./seed-practice-db.mjs"

const LAB_DATA = "/workspace/pocketbase-bin/lab-data"
const CONN_FILE = path.join(LAB_DATA, "db-connections.json")
const PRACTICE_DB = path.join(LAB_DATA, "practice.db")
const MAX_ROWS = 500 // 结果集截断上限（防打爆前端）
const TIMEOUT_MS = 20000

function out(obj) {
  process.stdout.write(JSON.stringify(obj))
  process.exit(0)
}

function fail(error, native) {
  out({ ok: false, error, native: native ? String(native).slice(0, 2000) : undefined })
}

// ---------- 凭据存取（本进程内完成，明文凭据永不出现在输出里） ----------
function loadConns() {
  try {
    return JSON.parse(fs.readFileSync(CONN_FILE, "utf8"))
  } catch {
    return {}
  }
}
function saveConns(map) {
  fs.mkdirSync(LAB_DATA, { recursive: true })
  fs.writeFileSync(CONN_FILE, JSON.stringify(map, null, 2), { mode: 0o600 })
}
function maskConn(c) {
  return {
    id: c.id,
    label: c.label,
    type: c.type,
    host: c.host,
    port: c.port,
    database: c.database,
    username: c.username,
    // 密码/私钥永不回传，只告诉前端"已存"
    hasSecret: Boolean(c.password || c.privateKey),
    createdAt: c.createdAt,
  }
}

// ---------- SQL 拆分（朴素按分号，练习场景够用；字符串字面量里的分号是已知限制） ----------
function splitStatements(sql) {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function isQueryLike(stmt) {
  return /^\s*(select|with|show|describe|desc|explain|pragma)\b/i.test(stmt)
}

function truncateRows(rows) {
  const arr = Array.isArray(rows) ? rows : []
  return { rows: arr.slice(0, MAX_ROWS), truncated: arr.length > MAX_ROWS, total: arr.length }
}

// ---------- 内置练习库（SQLite） ----------
function ensurePracticeDb() {
  fs.mkdirSync(LAB_DATA, { recursive: true })
  if (!fs.existsSync(PRACTICE_DB)) seedPracticeDb(PRACTICE_DB)
}

function execBuiltin(statements) {
  ensurePracticeDb()
  const db = new DatabaseSync(PRACTICE_DB)
  try {
    let lastResult = null
    let affectedTotal = 0
    for (const stmt of statements) {
      const s = db.prepare(stmt)
      if (isQueryLike(stmt)) {
        const rows = s.all()
        const columns = rows.length > 0 ? Object.keys(rows[0]) : inferColumnsFromSql(stmt)
        lastResult = { columns, ...truncateRows(rows.map((r) => columns.map((c) => normalize(r[c])))) }
      } else {
        const info = s.run()
        affectedTotal += Number(info.changes ?? 0)
        lastResult = { columns: [], rows: [], affectedRows: Number(info.changes ?? 0) }
      }
    }
    return { ok: true, ...lastResult, affectedRows: affectedTotal || lastResult?.affectedRows }
  } finally {
    db.close()
  }
}

function inferColumnsFromSql() {
  return []
}
function normalize(v) {
  if (v === null || v === undefined) return null
  if (typeof v === "bigint") return Number(v)
  if (v instanceof Uint8Array) return `[BLOB ${v.length} bytes]`
  return v
}

// ---------- MySQL / MariaDB ----------
async function execMysql(conn, statements, action) {
  const mysql = await import("mysql2/promise")
  const c = await mysql.createConnection({
    host: conn.host,
    port: Number(conn.port || 3306),
    user: conn.username,
    password: conn.password,
    database: conn.database,
    multipleStatements: true,
    connectTimeout: TIMEOUT_MS,
  })
  try {
    if (action === "test") {
      await c.query("SELECT 1")
      return { ok: true, message: "连接成功" }
    }
    const sql = statements.join("; ")
    const [result, fields] = await c.query(sql)
    if (Array.isArray(result) && Array.isArray(result[0]) && result[0] && "affectedRows" in (result[0] ?? {})) {
      // 多语句返回数组
      const last = result[result.length - 1]
      if (Array.isArray(last)) {
        const columns = last.length ? Object.keys(last[0]) : []
        return { ok: true, columns, ...truncateRows(last.map((r) => columns.map((c2) => normalize(r[c2])))) }
      }
      return { ok: true, columns: [], rows: [], affectedRows: last.affectedRows }
    }
    if (Array.isArray(result)) {
      const columns = fields?.map((f) => f.name) ?? (result.length ? Object.keys(result[0]) : [])
      return { ok: true, columns, ...truncateRows(result.map((r) => columns.map((c2) => normalize(r[c2])))) }
    }
    return { ok: true, columns: [], rows: [], affectedRows: result.affectedRows }
  } finally {
    await c.end().catch(() => {})
  }
}

// ---------- PostgreSQL ----------
async function execPg(conn, statements, action) {
  const pg = await import("pg")
  const c = new pg.Client({
    host: conn.host,
    port: Number(conn.port || 5432),
    user: conn.username,
    password: conn.password,
    database: conn.database,
    connectionTimeoutMillis: TIMEOUT_MS,
    statement_timeout: TIMEOUT_MS,
  })
  await c.connect()
  try {
    if (action === "test") {
      await c.query("SELECT 1")
      return { ok: true, message: "连接成功" }
    }
    const res = await c.query(statements.join("; "))
    const columns = res.fields?.map((f) => f.name) ?? []
    return { ok: true, columns, ...truncateRows((res.rows ?? []).map((r) => columns.map((c2) => normalize(r[c2])))), affectedRows: res.rowCount ?? undefined }
  } finally {
    await c.end().catch(() => {})
  }
}

// ---------- SQL Server ----------
async function execMssql(conn, statements, action) {
  const mssql = await import("mssql")
  const pool = await mssql.connect({
    server: conn.host,
    port: Number(conn.port || 1433),
    user: conn.username,
    password: conn.password,
    database: conn.database,
    options: { encrypt: false, trustServerCertificate: true },
    connectionTimeout: TIMEOUT_MS,
    requestTimeout: TIMEOUT_MS,
  })
  try {
    if (action === "test") {
      await pool.request().query("SELECT 1 AS ok")
      return { ok: true, message: "连接成功" }
    }
    const res = await pool.request().batch(statements.join("; "))
    const columns = res.recordset?.columns ? Object.keys(res.recordset.columns) : res.recordset?.[0] ? Object.keys(res.recordset[0]) : []
    return {
      ok: true,
      columns,
      ...truncateRows((res.recordset ?? []).map((r) => columns.map((c2) => normalize(r[c2])))),
      affectedRows: Array.isArray(res.rowsAffected) ? res.rowsAffected.reduce((a, b) => a + b, 0) : res.rowsAffected,
    }
  } finally {
    await pool.close().catch(() => {})
  }
}

// ---------- 主入口 ----------
async function main() {
  let req
  try {
    req = JSON.parse(process.argv[2])
  } catch (e) {
    return fail("请求解析失败", e)
  }
  const { action } = req

  try {
    if (action === "list") {
      return out({ ok: true, connections: Object.values(loadConns()).map(maskConn) })
    }
    if (action === "save") {
      const c = req.connection || {}
      if (!c.label || !c.type) return fail("缺少连接名称或类型")
      const map = loadConns()
      const id = c.id || "db-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
      const prev = map[id]
      map[id] = {
        id,
        label: String(c.label).slice(0, 60),
        type: ["mysql", "sqlserver", "postgres"].includes(c.type) ? c.type : "mysql",
        host: String(c.host || "").slice(0, 200),
        port: Number(c.port) || undefined,
        database: String(c.database || "").slice(0, 100),
        username: String(c.username || "").slice(0, 100),
        // 编辑时不传密码 = 保留原密码
        password: c.password !== undefined && c.password !== "" ? String(c.password) : prev?.password ?? "",
        createdAt: prev?.createdAt || new Date().toISOString(),
      }
      saveConns(map)
      return out({ ok: true, connection: maskConn(map[id]) })
    }
    if (action === "delete") {
      const map = loadConns()
      delete map[req.id]
      saveConns(map)
      return out({ ok: true })
    }
    if (action === "reset-builtin") {
      fs.mkdirSync(LAB_DATA, { recursive: true })
      seedPracticeDb(PRACTICE_DB)
      return out({ ok: true, message: "练习库已重置为初始状态" })
    }

    // test / exec：解析连接
    let conn = { type: "builtin" }
    if (req.connectionId && req.connectionId !== "builtin") {
      const found = loadConns()[req.connectionId]
      if (!found) return fail("连接不存在或已删除")
      conn = found
    } else if (req.connection) {
      conn = { ...req.connection } // 未保存直接测试
    }

    if (action === "test" || action === "exec") {
      const statements = action === "exec" ? splitStatements(String(req.sql || "")) : []
      if (action === "exec" && statements.length === 0) return fail("SQL 为空")
      let r
      if (conn.type === "builtin") {
        if (action === "test") {
          ensurePracticeDb()
          r = { ok: true, message: "内置练习库就绪" }
        } else {
          r = execBuiltin(statements)
        }
      } else if (conn.type === "mysql") {
        r = await execMysql(conn, statements, action)
      } else if (conn.type === "postgres") {
        r = await execPg(conn, statements, action)
      } else if (conn.type === "sqlserver") {
        r = await execMssql(conn, statements, action)
      } else {
        return fail("不支持的数据库类型: " + conn.type)
      }
      return out(r)
    }
    return fail("未知 action: " + action)
  } catch (e) {
    // 驱动原生错误原样带给前端（这是学习的一部分：看懂数据库报错）
    const msg = e?.message || String(e)
    return fail(translateDbError(msg), msg)
  }
}

function translateDbError(msg) {
  const m = String(msg)
  if (/ECONNREFUSED/i.test(m)) return "连接被拒绝：检查主机、端口，以及数据库是否允许外网访问"
  if (/ETIMEDOUT|ESOCKETTIMEDOUT|timeout/i.test(m)) return "连接超时：网络不通或防火墙/安全组未放行该端口"
  if (/ENOTFOUND|getaddrinfo/i.test(m)) return "主机名解析失败：检查主机地址拼写"
  if (/Access denied|password authentication failed|Login failed/i.test(m)) return "认证失败：账号或密码错误"
  if (/ER_NO_SUCH_TABLE|does not exist|Invalid object name/i.test(m)) return "表或库不存在：" + m
  return m.slice(0, 300)
}

main()
