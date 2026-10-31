// 练习库真实表结构（数据库题提示词用）
//
// 为什么要有它：模型写 SQL 时最容易犯的错是「臆造列名」——比如把
// items.item_name 写成 items.name、work_reports.employee_no 写成 emp_no。
// 站内练习库只有这 8 张表、列名固定，把真实结构写进提示词即可压掉这类错误。
//
// 与服务端同源：这份结构来自 server/seed-practice-db.mjs 的建表语句
// （server/__tests__/practiceSchema.test.ts 会解析那份建表语句逐表逐列比对，
// 一旦两边走偏就红）。行数也是同一份确定性种子跑出来的真实行数。
export interface PracticeColumn {
  name: string
  type: string
  primaryKey?: boolean
}

export interface PracticeTable {
  name: string
  /** 该表在确定性种子下的真实行数 */
  rows: number
  columns: PracticeColumn[]
  /** 该表里埋的「坑」，写查询时要注意 */
  note?: string
}

export const PRACTICE_TABLES: PracticeTable[] = [
  {
    name: "items",
    rows: 24,
    columns: [
      { name: "item_code", type: "TEXT", primaryKey: true },
      { name: "item_name", type: "TEXT" },
      { name: "spec", type: "TEXT" },
      { name: "unit", type: "TEXT" },
      { name: "category", type: "TEXT" },
    ],
    note: "同物两码与单位不统一都埋在这里（如 BRG-6201 与 BRG6201）",
  },
  {
    name: "bom",
    rows: 18,
    columns: [
      { name: "id", type: "INTEGER", primaryKey: true },
      { name: "parent_code", type: "TEXT" },
      { name: "child_code", type: "TEXT" },
      { name: "qty_per", type: "REAL" },
      { name: "loss_rate", type: "REAL" },
    ],
    note: "成品→子件用量；qty_per 用量、loss_rate 损耗率",
  },
  {
    name: "employees",
    rows: 18,
    columns: [
      { name: "emp_no", type: "TEXT", primaryKey: true },
      { name: "emp_name", type: "TEXT" },
      { name: "team", type: "TEXT" },
      { name: "role", type: "TEXT" },
    ],
  },
  {
    name: "equipment",
    rows: 10,
    columns: [
      { name: "eq_code", type: "TEXT", primaryKey: true },
      { name: "eq_name", type: "TEXT" },
      { name: "line_code", type: "TEXT" },
      { name: "status", type: "TEXT" },
      { name: "last_maint_date", type: "TEXT" },
    ],
    note: "status 口径含 运行 / 维修中 / 停用",
  },
  {
    name: "work_orders",
    rows: 32,
    columns: [
      { name: "wo_no", type: "TEXT", primaryKey: true },
      { name: "item_code", type: "TEXT" },
      { name: "plan_qty", type: "INTEGER" },
      { name: "done_qty", type: "INTEGER" },
      { name: "status", type: "TEXT" },
      { name: "plan_start", type: "TEXT" },
      { name: "plan_end", type: "TEXT" },
      { name: "line_code", type: "TEXT" },
    ],
    note: "status 有 Released / InProgress / Completed / 已完成 / 完成 / Closed 多种写法",
  },
  {
    name: "work_reports",
    rows: 90,
    columns: [
      { name: "report_id", type: "INTEGER", primaryKey: true },
      { name: "wo_no", type: "TEXT" },
      { name: "op_no", type: "INTEGER" },
      { name: "employee_no", type: "TEXT" },
      { name: "qty_ok", type: "INTEGER" },
      { name: "qty_scrap", type: "INTEGER" },
      { name: "report_time", type: "TEXT" },
      { name: "shift", type: "TEXT" },
    ],
    note: "报工记录；employee_no 对应 employees.emp_no",
  },
  {
    name: "inventory",
    rows: 23,
    columns: [
      { name: "id", type: "INTEGER", primaryKey: true },
      { name: "item_code", type: "TEXT" },
      { name: "warehouse", type: "TEXT" },
      { name: "location", type: "TEXT" },
      { name: "qty_book", type: "INTEGER" },
      { name: "qty_actual", type: "INTEGER" },
    ],
    note: "账实不符埋在这里：qty_book 是账面数、qty_actual 是实盘数",
  },
  {
    name: "sales_orders",
    rows: 16,
    columns: [
      { name: "order_no", type: "TEXT", primaryKey: true },
      { name: "customer", type: "TEXT" },
      { name: "item_code", type: "TEXT" },
      { name: "qty", type: "INTEGER" },
      { name: "due_date", type: "TEXT" },
    ],
  },
]

/** 表结构说明块：直接贴进给模型的提示词 */
export function buildPracticeSchemaPrompt(): string {
  const lines: string[] = []
  lines.push("练习库只有下面这 8 张表，列名与类型如下（行数是该练习库的确定性种子跑出来的真实行数）：")
  for (const t of PRACTICE_TABLES) {
    const cols = t.columns
      .map((c) => `${c.name} ${c.type}${c.primaryKey ? " PRIMARY KEY" : ""}`)
      .join(", ")
    lines.push(`- ${t.name}（${t.rows} 行）: ${cols}`)
    if (t.note) lines.push(`  备注：${t.note}`)
  }
  lines.push("表名与列名必须原样使用上面这份；没有的列不要臆造，")
  lines.push("题目要的列若不存在，改用已有列或聚合函数达成目标。")
  return lines.join("\n")
}
