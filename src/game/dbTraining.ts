// 数据库实操营纯逻辑：结果对比判定、计分、SQL 安全检测（vitest 覆盖）
import { rankForScore } from "./interview"

/** 单元格归一化：数字按值比较（1 == 1.0），null/undefined 等价，其余按字符串 */
export function normalizeCell(v: unknown): string {
  if (v === null || v === undefined) return "NULL"
  if (typeof v === "number") {
    // 浮点尾差容忍到 1e-9；整数保持原样文本
    return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e9) / 1e9)
  }
  if (typeof v === "boolean") return v ? "1" : "0"
  return String(v).trim()
}

export interface JudgeVerdict {
  passed: boolean
  /** 未通过时的定位提示（行数/列数/首个差异单元格） */
  diffHint: string
}

/**
 * 结果集对比：默认按行列顺序严格比较。题目声明 unorderedTieColumns 时，
 * 仅允许排序键完全相同的并列行互换；不同排序键的顺序仍必须匹配期望。
 */
export function judgeTaskResult(
  userRows: unknown[][],
  expect: unknown[][],
  unorderedTieColumns: number[] = [],
): JudgeVerdict {
  if (!Array.isArray(userRows)) return { passed: false, diffHint: "没有可对比的执行结果" }
  if (userRows.length !== expect.length) {
    return {
      passed: false,
      diffHint: `行数不对：你的结果 ${userRows.length} 行，期望 ${expect.length} 行。检查 WHERE 条件口径与 LIMIT。`,
    }
  }
  for (let r = 0; r < expect.length; r++) {
    const uRow = userRows[r] ?? []
    const eRow = expect[r]
    if (uRow.length !== eRow.length) {
      return {
        passed: false,
        diffHint: `第 ${r + 1} 行列数不对：你输出 ${uRow.length} 列，期望 ${eRow.length} 列。对照任务目标检查 SELECT 的列。`,
      }
    }
  }

  if (unorderedTieColumns.length > 0) {
    if (unorderedTieColumns.some((c) => !Number.isInteger(c) || c < 0 || expect.some((row) => c >= row.length))) {
      return { passed: false, diffHint: "结果校验配置错误：并列排序列超出输出列范围。" }
    }
    type RowGroup = { key: string; rows: string[] }
    const groupRows = (rows: unknown[][]): RowGroup[] => {
      const groups: RowGroup[] = []
      for (const row of rows) {
        const key = JSON.stringify(unorderedTieColumns.map((c) => normalizeCell(row[c])))
        const normalizedRow = JSON.stringify(row.map(normalizeCell))
        const last = groups[groups.length - 1]
        if (last?.key === key) last.rows.push(normalizedRow)
        else groups.push({ key, rows: [normalizedRow] })
      }
      return groups
    }
    const actualGroups = groupRows(userRows)
    const expectedGroups = groupRows(expect)
    if (actualGroups.length !== expectedGroups.length) {
      return { passed: false, diffHint: "结果排序分组不一致；检查排序方向以及是否有行落在错误的排序组。" }
    }
    for (let g = 0; g < expectedGroups.length; g++) {
      const actual = actualGroups[g]
      const expectedGroup = expectedGroups[g]
      if (actual.key !== expectedGroup.key) {
        return { passed: false, diffHint: `第 ${g + 1} 个排序组不一致；检查排序方向或结果口径。` }
      }
      const actualRows = [...actual.rows].sort()
      const expectedRows = [...expectedGroup.rows].sort()
      if (actualRows.length !== expectedRows.length || actualRows.some((row, i) => row !== expectedRows[i])) {
        return { passed: false, diffHint: `排序键相同的第 ${g + 1} 组行内容不一致；检查输出列和聚合口径。` }
      }
    }
    return { passed: true, diffHint: "" }
  }

  for (let r = 0; r < expect.length; r++) {
    const uRow = userRows[r] ?? []
    const eRow = expect[r]
    for (let c = 0; c < eRow.length; c++) {
      const u = normalizeCell(uRow[c])
      const e = normalizeCell(eRow[c])
      if (u !== e) {
        return {
          passed: false,
          diffHint: `第 ${r + 1} 行第 ${c + 1} 列不一致：你的值「${u}」，期望「${e}」。检查计算口径或排序方向。`,
        }
      }
    }
  }
  return { passed: true, diffHint: "" }
}

/** 提交次数计分：第 1 次提交校验通过 100 / 第 2 次 80 / 第 3 次及以后或看答案 60 */
export function scoreByAttempts(checkAttempts: number, viewedAnswer: boolean): number {
  if (viewedAnswer) return 60
  if (checkAttempts <= 1) return 100
  if (checkAttempts === 2) return 80
  return 60
}

/** 组总分 = 各任务得分平均（四舍五入） */
export function scoreTaskGroup(taskScores: number[]): number {
  if (taskScores.length === 0) return 0
  return Math.round(taskScores.reduce((a, b) => a + b, 0) / taskScores.length)
}

export { rankForScore as rankForDbScore }

// ---------- SQL 安全检测（前端确认框 + 真连只读保护用） ----------

/** 剥掉 SQL 注释（块注释 + 行注释），只用于语句类型/危险关键字判定，展示仍用原文 */
export function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ")
}

/** 只读语句判定：剥掉注释后以 SELECT / WITH / SHOW / DESCRIBE / EXPLAIN / PRAGMA 开头视为只读 */
export function isReadOnlySql(sql: string): boolean {
  // 编辑器里常带 "-- 提示：…" 起始注释行，不剥会把 SELECT 误判成非只读（与服务端 dblab.mjs 同规则）
  return /^\s*(select|with|show|describe|desc|explain|pragma)\b/i.test(stripSqlComments(sql))
}

export interface SqlDanger {
  level: "warn" | "block"
  label: string
  detail: string
}

/** 危险 SQL 检测：无 WHERE 的 DELETE/UPDATE 与 DROP/TRUNCATE 触发确认；只读保护模式下非只读语句直接拦截 */
export function detectDangerousSql(sql: string, readOnlyGuard: boolean): SqlDanger[] {
  const out: SqlDanger[] = []
  if (!sql.trim()) return out
  if (readOnlyGuard && !isReadOnlySql(sql)) {
    out.push({
      level: "block",
      label: "只读保护已开启",
      detail: "当前连接处于只读保护模式，仅放行查询类语句。确需变更请先关闭只读保护开关。",
    })
    return out
  }
  const statements = sql.split(";").map((s) => s.trim()).filter(Boolean)
  for (const stmt of statements) {
    // 判定用剥注释后的文本，防止 "-- 注释\nDROP TABLE" 绕过确认弹窗；展示仍用原文
    const probe = stripSqlComments(stmt).trim()
    if (/^\s*drop\s+(table|database|schema|index)\b/i.test(probe)) {
      out.push({ level: "warn", label: "DROP 删表/删库", detail: "这条语句会永久删除数据库对象，生产环境执行前必须确认备份。语句：" + stmt.slice(0, 120) })
    } else if (/^\s*truncate\s+table\b/i.test(probe)) {
      out.push({ level: "warn", label: "TRUNCATE 清空表", detail: "整表数据将被清空且无法回滚（多数库不写逐行日志）。语句：" + stmt.slice(0, 120) })
    } else if (/^\s*delete\s+from\b/i.test(probe) && !/\bwhere\b/i.test(probe)) {
      out.push({ level: "warn", label: "无 WHERE 的 DELETE", detail: "将删除整表所有行。确定要全表删除吗？语句：" + stmt.slice(0, 120) })
    } else if (/^\s*update\b/i.test(probe) && !/\bwhere\b/i.test(probe)) {
      out.push({ level: "warn", label: "无 WHERE 的 UPDATE", detail: "将更新整表所有行。确定要全表更新吗？语句：" + stmt.slice(0, 120) })
    } else if (/^\s*alter\s+table\b.*\bdrop\s+column\b/i.test(probe)) {
      out.push({ level: "warn", label: "删除字段", detail: "字段及其全部数据将被删除，且依赖该字段的报表/接口可能立刻报错。语句：" + stmt.slice(0, 120) })
    }
  }
  return out
}
