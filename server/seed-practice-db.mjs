#!/usr/bin/env node
// seed-practice-db.mjs — 内置 MES 业务练习库（SQLite）种子生成器
// 确定性数据（固定种子伪随机），重置后任务断言稳定可复现。
// 数据里故意埋了典型脏数据：一物两码、单位不统一、账实不符、状态口径混乱——对应第二章「洗数据」的实操作业。
import { DatabaseSync } from "node:sqlite"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"

// 固定种子 LCG（确定性，不用 Math.random）
function lcg(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

export function seedPracticeDb(dbPath) {
  if (fs.existsSync(dbPath)) fs.rmSync(dbPath)
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  const rnd = lcg(20261021)
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
  const int = (min, max) => min + Math.floor(rnd() * (max - min + 1))

  db.exec(`
    CREATE TABLE items (item_code TEXT PRIMARY KEY, item_name TEXT, spec TEXT, unit TEXT, category TEXT);
    CREATE TABLE bom (id INTEGER PRIMARY KEY AUTOINCREMENT, parent_code TEXT, child_code TEXT, qty_per REAL, loss_rate REAL);
    CREATE TABLE employees (emp_no TEXT PRIMARY KEY, emp_name TEXT, team TEXT, role TEXT);
    CREATE TABLE equipment (eq_code TEXT PRIMARY KEY, eq_name TEXT, line_code TEXT, status TEXT, last_maint_date TEXT);
    CREATE TABLE work_orders (wo_no TEXT PRIMARY KEY, item_code TEXT, plan_qty INTEGER, done_qty INTEGER, status TEXT, plan_start TEXT, plan_end TEXT, line_code TEXT);
    CREATE TABLE work_reports (report_id INTEGER PRIMARY KEY AUTOINCREMENT, wo_no TEXT, op_no INTEGER, employee_no TEXT, qty_ok INTEGER, qty_scrap INTEGER, report_time TEXT, shift TEXT);
    CREATE TABLE inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, item_code TEXT, warehouse TEXT, location TEXT, qty_book INTEGER, qty_actual INTEGER);
    CREATE TABLE sales_orders (order_no TEXT PRIMARY KEY, customer TEXT, item_code TEXT, qty INTEGER, due_date TEXT);
  `)

  const ins = db.prepare.bind(db)

  // ---- 物料：24 种，埋脏数据 ----
  const items = [
    ["STL-Q235-10", "Q235钢板", "10mm×1500×6000", "张", "原材料"],
    ["STL-Q235-10 ", "Q235钢板 ", "10mm×1500×6000", "张", "原材料"], // 尾部空格 = 同物两条
    ["BRG-6201", "深沟球轴承", "6201-2RS", "个", "外购件"],
    ["BRG6201", "深沟球轴承", "6201-2RS", "PCS", "外购件"], // 一物两码 + 单位不统一
    ["MTR-750W", "三相异步电机", "750W 4P", "台", "外购件"],
    ["MTR-750W-B", "三相异步电机", "750W 4P", "pcs", "外购件"], // 单位大小写混乱
    ["ALU-6061-5", "6061铝板", "5mm×1000×2000", "张", "原材料"],
    ["SCR-M8-30", "内六角螺栓", "M8×30 8.8级", "盒", "辅料"],
    ["SCR-M8-30-S", "内六角螺栓", "M8×30 8.8级", "盒", "标准件"], // 分类口径不一致
    ["WRE-2.5", "动力电缆", "RVV 3×2.5", "米", "辅料"],
    ["PLC-S7-1200", "PLC模块", "S7-1200 CPU1214C", "块", "电气件"],
    ["SEN-PR-M12", "接近开关", "M12 PNP常开", "只", "电气件"],
    ["OIL-HM46", "抗磨液压油", "HM46 200L", "桶", "辅料"],
    ["GRB-CNC-01", "主轴减速机", "CNC配 1:10", "台", "外购件"],
    ["PNL-CTRL-A", "控制柜面板", "定制 800×600", "件", "半成品"],
    ["FRM-BASE-11", "机架底座", "焊接件 1200×800", "件", "半成品"],
    ["SHF-45-600", "传动轴", "45#钢 Φ45×600", "根", "半成品"],
    ["IMP-HOUS-3", "泵体壳体", "HT200 铸件", "件", "半成品"],
    ["PMP-AO-25", "气动隔膜泵", "AO-25 铝合金", "台", "成品"],
    ["MIX-RX-500", "行星搅拌机", "RX-500 500L", "台", "成品"],
    ["CNV-BLT-6M", "皮带输送机", "6m 500宽", "台", "成品"],
    ["CAB-ELEC-G2", "电气控制柜", "G2 标准型", "台", "成品"],
    ["SKID-PKG-01", "撬装包装箱", "定制木箱", "个", "包装物"],
    ["FLT-HYD-10", "液压滤芯", "10μm 旋装式", "支", "备件"],
  ]
  const insItem = ins("INSERT INTO items VALUES (?,?,?,?,?)")
  for (const r of items) insItem.run(...r)

  // ---- BOM（成品→子件） ----
  const boms = [
    ["PMP-AO-25", "IMP-HOUS-3", 1, 0.02], ["PMP-AO-25", "BRG-6201", 2, 0.01],
    ["PMP-AO-25", "SCR-M8-30", 0.2, 0.05], ["PMP-AO-25", "FLT-HYD-10", 1, 0],
    ["MIX-RX-500", "MTR-750W", 2, 0], ["MIX-RX-500", "GRB-CNC-01", 1, 0],
    ["MIX-RX-500", "SHF-45-600", 2, 0.01], ["MIX-RX-500", "PLC-S7-1200", 1, 0],
    ["CNV-BLT-6M", "MTR-750W-B", 1, 0], ["CNV-BLT-6M", "BRG6201", 4, 0.02],
    ["CNV-BLT-6M", "STL-Q235-10", 2, 0.03], ["CAB-ELEC-G2", "PNL-CTRL-A", 1, 0],
    ["CAB-ELEC-G2", "PLC-S7-1200", 1, 0], ["CAB-ELEC-G2", "SEN-PR-M12", 6, 0.02],
    ["CAB-ELEC-G2", "WRE-2.5", 30, 0.08], ["IMP-HOUS-3", "ALU-6061-5", 0, 0],
    ["FRM-BASE-11", "STL-Q235-10", 1, 0.03], ["PNL-CTRL-A", "ALU-6061-5", 1, 0.02],
  ]
  const insBom = ins("INSERT INTO bom (parent_code,child_code,qty_per,loss_rate) VALUES (?,?,?,?)")
  for (const r of boms) insBom.run(...r)

  // ---- 员工 18 人 ----
  const teams = ["金工一班", "金工二班", "装配班", "电气班"]
  const roles = ["操作工", "班组长", "质检员", "维修工"]
  const surnames = "赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨".split("")
  const insEmp = ins("INSERT INTO employees VALUES (?,?,?,?)")
  const empNos = []
  for (let i = 1; i <= 18; i++) {
    const no = "E" + String(1000 + i)
    empNos.push(no)
    insEmp.run(no, surnames[i % surnames.length] + (i % 3 === 0 ? "建军" : i % 3 === 1 ? "志强" : "秀英"), pick(teams), pick(roles))
  }

  // ---- 设备 10 台 ----
  const insEq = ins("INSERT INTO equipment VALUES (?,?,?,?,?)")
  const eqs = [
    ["CNC-01", "数控车床", "L1", "运行", "2026-09-12"], ["CNC-02", "数控车床", "L1", "运行", "2026-08-02"],
    ["CNC-03", "加工中心", "L1", "维修中", "2026-10-18"], ["LASER-01", "激光切割机", "L2", "运行", "2026-09-30"],
    ["PRESS-01", "液压冲床", "L2", "运行", "2026-07-15"], ["WELD-01", "焊接机器人", "L3", "运行", "2026-10-01"],
    ["WELD-02", "焊接机器人", "L3", "停用", "2026-05-20"], ["ASSM-01", "装配台", "L4", "运行", "2026-10-10"],
    ["ASSM-02", "装配台", "L4", "运行", "2026-10-10"], ["TEST-01", "测试台", "L4", "运行", "2026-09-25"],
  ]
  for (const r of eqs) insEq.run(...r)

  // ---- 工单 32 张（状态口径故意埋混乱：Completed/已完成/完成 三种写法） ----
  const prodCodes = ["PMP-AO-25", "MIX-RX-500", "CNV-BLT-6M", "CAB-ELEC-G2", "IMP-HOUS-3", "FRM-BASE-11", "SHF-45-600", "PNL-CTRL-A"]
  const lines = ["L1", "L2", "L3", "L4"]
  const statusSet = ["Released", "InProgress", "Completed", "已完成", "完成", "Closed"]
  const insWo = ins("INSERT INTO work_orders VALUES (?,?,?,?,?,?,?,?)")
  const woNos = []
  for (let i = 1; i <= 32; i++) {
    const no = "WO2026" + String(1000 + i)
    woNos.push(no)
    const planQty = int(5, 120)
    const st = i <= 24 ? statusSet[i % 6] : pick(statusSet)
    const done = st === "Released" ? 0 : st === "InProgress" ? int(0, planQty - 1) : planQty - (rnd() < 0.3 ? int(1, 3) : 0)
    const m = int(8, 10)
    const d = int(1, 28)
    insWo.run(no, pick(prodCodes), planQty, done, st, `2026-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, `2026-${String(m).padStart(2, "0")}-${String(Math.min(28, d + int(3, 10))).padStart(2, "0")}`, pick(lines))
  }

  // ---- 报工 90 条（含跨工单乱报、报废超常） ----
  const insWr = ins("INSERT INTO work_reports (wo_no,op_no,employee_no,qty_ok,qty_scrap,report_time,shift) VALUES (?,?,?,?,?,?,?)")
  for (let i = 0; i < 90; i++) {
    const wo = pick(woNos.slice(0, 24))
    const ok = int(1, 20)
    const scrap = rnd() < 0.12 ? int(3, 8) : rnd() < 0.4 ? int(0, 2) : 0
    const day = int(1, 28)
    const hour = int(6, 22)
    insWr.run(wo, int(10, 40), pick(empNos), ok, scrap, `2026-10-${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(int(0, 59)).padStart(2, "0")}:00`, hour >= 8 && hour < 20 ? "白班" : "夜班")
  }

  // ---- 库存（账实不符埋点） ----
  const insInv = ins("INSERT INTO inventory (item_code,warehouse,location,qty_book,qty_actual) VALUES (?,?,?,?,?)")
  const whs = [["原料仓", "A"], ["半成品仓", "B"], ["成品仓", "C"]]
  let loc = 1
  for (const it of items) {
    if (it[4] === "包装物") continue
    const [wh, zone] = pick(whs)
    const book = int(0, 400)
    const actual = rnd() < 0.25 ? book + pick([-int(1, 8), int(1, 5)]) : book
    insInv.run(it[0], wh, `${zone}-${String(loc++).padStart(2, "0")}-01`, book, actual)
  }

  // ---- 销售订单 16 张 ----
  const insSo = ins("INSERT INTO sales_orders VALUES (?,?,?,?,?)")
  const customers = ["华东机械厂", "南方泵业", "中原重工", "沿海食品设备", "西北矿业装备"]
  for (let i = 1; i <= 16; i++) {
    insSo.run("SO2026" + String(200 + i), pick(customers), pick(["PMP-AO-25", "MIX-RX-500", "CNV-BLT-6M", "CAB-ELEC-G2"]), int(2, 40), `2026-1${int(0, 2)}-${String(int(1, 28)).padStart(2, "0")}`)
  }

  db.close()
  return dbPath
}

// 直接运行：node server/seed-practice-db.mjs [输出路径]
if (process.argv[1] && process.argv[1].endsWith("seed-practice-db.mjs")) {
  const target = process.argv[2] || "/workspace/pocketbase-bin/lab-data/practice.db"
  seedPracticeDb(target)
  console.log("seeded:", target)
}


/**
 * 把内置练习库导出成 MySQL / PostgreSQL 可执行的建表 + 插入语句。
 *
 * 模式 B（站点一次性 Docker 演练环境）里的数据库容器是空的，
 * 而数据库实操营的题目都跑在这套练习库的表上——所以容器就绪后要先把
 * 同一份确定性数据灌进去，题目脚本才能原样跑通、判分口径才对得上。
 *
 * @param {"mysql"|"postgres"} dialect
 * @returns {{ ddl: string[], inserts: string[] }}
 */
export function exportPracticeSql(dialect) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mes-practice-"))
  const dbPath = path.join(tmpDir, "practice.db")
  try {
    seedPracticeDb(dbPath)
    const db = new DatabaseSync(dbPath)
    const tables = db
      .prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
    const ddl = []
    const inserts = []
    for (const t of tables) {
      ddl.push(translateDdl(t.sql, dialect))
      const cols = db.prepare(`PRAGMA table_info(${t.name})`).all().map((c) => c.name)
      const rows = db.prepare(`SELECT * FROM ${t.name}`).all()
      for (const row of rows) {
        const values = cols.map((c) => sqlLiteral(row[c], dialect))
        inserts.push(`INSERT INTO ${t.name} (${cols.join(", ")}) VALUES (${values.join(", ")});`)
      }
      db.exec("SELECT 1")
    }
    db.close()
    return { ddl, inserts }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

/** SQLite 的建表语句转成目标方言 */
function translateDdl(sql, dialect) {
  let s = String(sql).trim()
  s = s.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, dialect === "postgres" ? "SERIAL PRIMARY KEY" : "INT AUTO_INCREMENT PRIMARY KEY")
  s = s.replace(/REAL/gi, dialect === "postgres" ? "DOUBLE PRECISION" : "REAL")
  if (dialect === "postgres") return s
  // MySQL: TEXT 列不能直接做主键，需要换成带长度的 VARCHAR
  s = s.replace(/TEXT PRIMARY KEY/gi, "VARCHAR(191) PRIMARY KEY")
  s = s.replace(/\bTEXT\b/gi, "VARCHAR(255)")
  return s
}

/** 值转成 SQL 字面量（NULL / 数字 / 字符串） */
function sqlLiteral(v, dialect) {
  if (v === null || v === undefined) return "NULL"
  if (typeof v === "number" && Number.isFinite(v)) return String(v)
  if (typeof v === "bigint") return String(v)
  const s = String(v).replace(/'/g, "''")
  return `'${s}'`
}
