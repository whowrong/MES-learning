#!/usr/bin/env node
// 生成实操营题目文档：public/content/labs/<题目id>.md
//
// 目的：每一道练习题目都有一份独立文档，同时服务两类读者——
//   人：讲清这道题在练什么、环境要求、步骤、验收标准、常见错法；
//   站内 AI：按文档里的「环境准备步骤」与「执行脚本要点」生成准备/执行脚本。
//
// 数据来源：题目 JSON（public/content/db-training/*.json、public/content/ops-training/*.json）
//          + 人工补充项（public/content/labs/meta.json）
// 用法：node scripts/build-lab-docs.mjs   （生成后 git diff 可看文档是否与题目同步）
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const CONTENT = path.join(ROOT, "public/content")
const OUT_DIR = path.join(CONTENT, "labs")
const META_FILE = path.join(OUT_DIR, "meta.json")

export const DESTRUCTIVE_NOTICE =
  "本站演练会执行删除、重建、清库、杀进程、改防火墙、重启服务等破坏性操作。请只填**可破坏、演练专用**的数据库与服务器；生产环境、重要数据环境请勿填入。建议用一次性实例，或随时能从快照重建的环境。"

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"))
}

function loadMeta() {
  return readJson(META_FILE)
}

/** 收集全部题目：数据库实操营 tasks + 运维实操营 items */
export function collectQuestions() {
  const list = []
  for (const file of fs.readdirSync(path.join(CONTENT, "db-training")).filter((f) => f.endsWith(".json"))) {
    const mod = readJson(path.join(CONTENT, "db-training", file))
    if (!Array.isArray(mod.tasks)) continue
    for (const t of mod.tasks) {
      list.push({
        id: t.id,
        kind: "db",
        group: mod.group,
        module: `数据库实操营 · ${mod.groupName}`,
        title: t.title,
        raw: t,
      })
    }
  }
  for (const file of fs.readdirSync(path.join(CONTENT, "ops-training")).filter((f) => f.endsWith(".json"))) {
    const mod = readJson(path.join(CONTENT, "ops-training", file))
    if (!Array.isArray(mod.items)) continue
    for (const it of mod.items) {
      list.push({
        id: it.id,
        kind: it.kind === "terminal" ? "ops-terminal" : it.kind === "choice" ? "ops-choice" : "ops-order",
        group: it.kind,
        module: `运维实操营 · ${mod.domainName}`,
        title: it.title,
        raw: it,
      })
    }
  }
  return list
}

const SQL_TABLE_RE = /\b(?:from|join|into|update)\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi

export function extractTables(sqls) {
  const set = new Set()
  for (const sql of sqls) {
    if (!sql) continue
    let m
    SQL_TABLE_RE.lastIndex = 0
    while ((m = SQL_TABLE_RE.exec(sql))) {
      const name = m[1].toLowerCase()
      if (["select", "where", "set", "values", "dual", "on"].includes(name)) continue
      set.add(name)
    }
  }
  return [...set]
}

export function sqlVerbs(sqls) {
  const verbs = new Set()
  for (const sql of sqls) {
    if (!sql) continue
    const s = sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ")
    for (const v of ["select", "insert", "update", "delete", "create", "drop", "alter", "truncate"]) {
      if (new RegExp(`\\b${v}\\b`, "i").test(s)) verbs.add(v.toUpperCase())
    }
  }
  return [...verbs]
}

export function permissionText(verbs) {
  const write = verbs.some((v) => ["INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER", "TRUNCATE"].includes(v))
  const read = verbs.includes("SELECT")
  if (write && read) return "需要目标表的 SELECT 与写权限（INSERT/UPDATE/DELETE）。建议用演练账号授权到库级，不要用 DBA 账号。"
  if (write) return "需要目标表的写权限（UPDATE/DELETE 等）。建议用演练账号授权到表级，不要用 DBA 账号。"
  if (read) return "只需要 SELECT 权限（只读账号即可作答）。"
  return "按题目实际 SQL 授予最小权限即可。"
}

function listOr(items, fallback) {
  return items && items.length ? items : fallback
}

function bullets(items) {
  return items.map((i) => `- ${i}`).join("\n")
}

/** 把 SQL 压成一行，便于在文档里展示 */
function sqlOneline(sql) {
  return String(sql || "").replace(/\s+/g, " ").trim()
}

export function renderLabDoc(q, meta) {
  const m = meta.questions[q.id] || {}
  const def = meta.defaults || {}
  const lines = []
  const push = (s = "") => lines.push(s)

  push(`# ${q.title}`)
  push()
  push(`- 题目编号：\`${q.id}\``)
  push(`- 所属模块：${q.module}`)
  push(`- 题目类型：${meta.kindLabel[q.kind] || q.kind}`)
  if (q.raw.difficulty) push(`- 难度 / 建议时长：${q.raw.difficulty} / ${q.raw.minutes} 分钟`)
  push(`- 文档路径：\`public/content/labs/${q.id}.md\`（站内地址 \`/content/labs/${q.id}.md\`）`)
  push()
  push("> 本文同时服务两类读者：人（讲清这道题在练什么、环境要求、步骤、验收、常见错法）与站内 AI（据此生成准备与执行脚本）。AI 生成的脚本一律先预览、再由用户确认执行。")
  push()
  push("> ⚠️ " + DESTRUCTIVE_NOTICE)
  push()

  // 1 目标与背景
  push("## 1. 题目目标与业务背景")
  push()
  if (q.kind === "db") {
    push(`**目标**：${q.raw.goal}`)
    push()
    push(`**业务背景**：${q.raw.scene}`)
  } else if (q.kind === "ops-terminal") {
    push(`**目标**：${q.raw.ticket.objective}`)
    push()
    push(`**背景**：${q.raw.ticket.background}`)
    push()
    push(`**现象**：${q.raw.ticket.symptom}`)
  } else if (q.kind === "ops-choice") {
    push(`**目标**：掌握${q.raw.title}相关的场景判断与处置原则。`)
    push()
    push(`**背景**：${q.raw.intro}`)
  } else {
    push(`**目标**：把${q.raw.title}的标准流程顺序记牢，能在真实变更里按序执行。`)
    push()
    push(`**背景**：${q.raw.intro}`)
  }
  push()

  // 2 表与服务
  push("## 2. 涉及的数据表或服务")
  push()
  if (q.kind === "db") {
    const tables = listOr(m.tables, extractTables([q.raw.check?.sql, q.raw.answerSql, q.raw.starterSql]))
    push(`- 涉及表：${tables.length ? tables.map((t) => `\`${t}\``).join("、") : "（内置练习库的全部相关表）"}`)
    push("- 练习库结构：内置练习库共 8 张表（items / bom / employees / equipment / work_orders / work_reports / inventory / sales_orders），合计约 231 行；真实连库时按第 4 节的空间与数据量建议预置同量级数据。")
    if (m.services) push(`- 相关服务：${m.services.join("、")}`)
  } else {
    const services = listOr(m.services, [])
    push(services.length ? bullets(services) : "- 本题为概念/流程类题目，不直接操作具体服务；演练环境规格见第 4 节。")
  }
  push()

  // 3 账号与权限
  push("## 3. 需要的账号与权限")
  push()
  if (q.kind === "db") {
    const verbs = listOr(m.verbs, sqlVerbs([q.raw.check?.sql, q.raw.answerSql]))
    push(`- ${m.permissions || permissionText(verbs)}`)
    push("- 连接信息只保存在本站服务端（页面与仓库都不落明文密码），列表回显一律脱敏。")
  } else {
    push(`- ${m.permissions || "需要 sudo 权限（或等价的管理员权限），可读写演练目录、日志目录与服务配置。"}`)
    push("- SSH 私钥 / 口令只保存在本站服务端，不进仓库、不进文档。")
  }
  push()

  // 4 环境要求
  push("## 4. 环境要求（演练专用）")
  push()
  push("### 4.1 规格基线")
  push()
  if (q.kind === "db") {
    push(`- 数据库版本：${m.db_version || def.db_version}`)
    push(`- 最小表空间 / 数据量：${m.min_space || def.db_min_space}`)
  } else {
    push(`- 演练服务器最低配置：${m.server_min || def.ops_server_min}`)
    push(`- 演练服务器推荐配置：${m.server_rec || def.ops_server_rec}`)
    push(`- 系统版本：${m.os || def.ops_os}`)
  }
  push()
  push("> 规格出处：以下数值对齐已验证过的目标机 instabox dev 实测规格（4 vCPU / 7.8 GiB 内存、根分区 16 GB + 数据盘 20 GB、Debian GNU/Linux 13，内核 6.18，Docker 29.8 可用），最低配置按其一半左右给出，保证题目脚本与路径在演练机上跑得通。")
  push()
  push("### 4.2 额外要求")
  push()
  push(bullets(listOr(m.env_extra, ["无额外要求：按题目用到的服务预置即可。"])))
  push()
  push("### 4.3 破坏性提示")
  push()
  push("> ⚠️ " + DESTRUCTIVE_NOTICE)
  push()

  // 5 标准步骤
  push("## 5. 标准步骤")
  push()
  if (q.kind === "db") {
    push("```sql")
    push(sqlOneline(q.raw.answerSql))
    push("```")
    push()
    push(`- 思路提示：${q.raw.hint}`)
    push(`- 讲解：${q.raw.explanation}`)
  } else if (q.kind === "ops-terminal") {
    push("| # | 目标 | 参考动作 |")
    push("| --- | --- | --- |")
    q.raw.steps.forEach((s, i) => {
      push(`| s${i + 1} | ${s.objective} | ${s.hint} |`)
    })
    push()
    push("每一步的判定命令见第 6 节的验收正则。")
  } else if (q.kind === "ops-choice") {
    push(q.raw.questions.map((qq) => `- ${qq.prompt}`).join("\n"))
  } else {
    push(q.raw.steps.map((s, i) => `${i + 1}. ${s.title ?? s.label ?? s.text ?? JSON.stringify(s)}`).join("\n"))
  }
  push()

  // 6 验收标准
  push("## 6. 验收标准（可机器判定）")
  push()
  if (q.kind === "db") {
    if (q.raw.check?.mode === "result") {
      push("判分方式：执行下面的校验 SQL，结果必须与期望值完全一致（列名与行序都算）。")
      push()
      push("```sql")
      push(sqlOneline(q.raw.check.sql))
      push("```")
      push()
      push(`- 期望结果：\`${JSON.stringify(q.raw.check.expect)}\``)
    } else {
      push("判分方式：按状态判定——执行你的 SQL 后重新跑校验 SQL，取状态类字段与期望值比对。")
      push()
      push("```sql")
      push(sqlOneline(q.raw.check?.sql || ""))
      push("```")
      push()
      push(`- 期望结果：\`${JSON.stringify(q.raw.check?.expect)}\``)
    }
  } else if (q.kind === "ops-terminal") {
    push("判分方式：终端实操逐条比对命令正则（任一条命中即通过该步），最终按通过步数给出评级。")
    push()
    push("| # | 步骤目标 | 命中的命令正则 |")
    push("| --- | --- | --- |")
    q.raw.steps.forEach((s, i) => {
      push(`| s${i + 1} | ${s.objective} | ${(s.accept || []).map((a) => `\`${a}\``).join(" 或 ")} |`)
    })
  } else if (q.kind === "ops-choice") {
    push("判分方式：场景决策题按选项判定，答错不通过；用于自测与复盘，不涉及真实命令执行。")
    push()
    push(q.raw.questions.map((qq) => `- ${qq.prompt}`).join("\n"))
  } else {
    push("判分方式：流程排序题必须完全正确才算通过（顺序题不做部分分）。")
    push()
    push(q.raw.steps.map((s, i) => `${i + 1}. ${s.title ?? s.label ?? s.text ?? JSON.stringify(s)}`).join("\n"))
  }
  push()

  // 7 常见错误
  push("## 7. 常见错误与排查提示")
  push()
  const mistakes = []
  if (q.kind === "db") {
    mistakes.push(`常见错法：${q.raw.hint}`)
    mistakes.push(`为什么：${q.raw.explanation}`)
  } else if (q.kind === "ops-terminal") {
    q.raw.steps.forEach((s) => {
      if (s.hint) mistakes.push(`${s.objective}：${s.hint}`)
      if (s.explain) mistakes.push(`要点：${s.explain}`)
    })
  } else {
    mistakes.push(q.raw.intro)
  }
  if (m.mistakes) mistakes.push(...m.mistakes)
  push(bullets(mistakes))
  push()

  // 8 AI 环境准备
  push("## 8. AI 环境准备步骤（供站内 AI 生成准备脚本）")
  push()
  push("AI 应当按下面的顺序在**用户填写的演练环境**上生成准备脚本；每条命令都必须先预览、由用户确认后再执行，命中站内危险命令清单的一律二次确认。")
  push()
  push(bullets(listOr(m.prep, q.kind === "db" ? [
    "确认连接可达：先跑一条只读查询（如 `SELECT 1`）确认账号、库名、网络都通。",
    "确认目标表存在且结构一致：跑 `SHOW COLUMNS` / `\\d` 之类只读命令核对字段名与类型。",
    "预置脏数据：按本题的场景补齐需要的脏数据行（脏值、多写法状态值、尾部空格等），并记录补了多少行以便回滚。",
    "记录基线：把关键表的行数与关键汇总值（本题校验 SQL 的期望值）先查一遍存下来，作为回滚与验收基准。",
  ] : [
    "确认系统与版本：记录内核版本、发行版、CPU/内存/磁盘规格，确认满足第 4 节的最低配置。",
    "预置故障现场：按本题现象造出可复现的故障（占满的磁盘、挂掉的进程、错误的权限或配置），并保留造故障前的基线快照。",
    "确认依赖服务：确认题目用到的服务单元存在、端口可查、配置文件路径与题目描述一致。",
    "记录基线：造故障前先记录服务状态、关键文件大小与配置内容，便于回滚。",
  ])))
  push()

  // 9 AI 执行脚本要点
  push("## 9. AI 执行脚本要点（供站内 AI 生成执行脚本）")
  push()
  const exec = listOr(m.exec, q.kind === "db" ? [
    `先跑只读校验：\`${sqlOneline(q.raw.check?.sql)}\``,
    "再跑用户的作答 SQL，并把结果与校验 SQL 的期望值比对；不一致要指出差在哪一行、差多少。",
    "涉及写操作（UPDATE/DELETE）时，先用 SELECT 预览受影响的行数，确认行数与预期一致再提交。",
  ] : [
    "按第 5 节的标准步骤顺序生成命令序列，每条命令都带一条用于验收的正则判定。",
    "任何会删除、重建、清库、杀进程、改防火墙、重启服务的命令，都要显式标注后果说明并要求用户二次确认。",
    "每执行完一步立刻跑对应的验收正则，只有命中才继续下一步；未命中就停下并说明原因，不要继续往下跑。",
  ])
  push(bullets(exec))
  push()

  // 10 安全边界
  push("## 10. 安全边界与失败处理")
  push()
  push("- 只在用户自己提供的演练环境上执行；不连接任何生产实例，也不改动本站服务端配置。")
  push("- 生成的脚本一律先给出预览，用户确认后才执行；危险命令走站内既有拦截清单与二次确认。")
  push("- 失败处理：上游模型不可用 → 明确提示「AI 暂时不可用」，并保留手工执行入口；文档缺失 → 明确提示「该题文档缺失」；命令执行失败 → 原样回显报错行并停止该步；环境不符（例如题目要求 MySQL 却连的是 PostgreSQL）→ 在执行前就提示不匹配，不静默继续。")
  push("- 本题涉及的判分一律以第 6 节的机器判据为准，不采信模型自述的「已完成」。")
  push()

  return lines.join("\n") + "\n"
}

export function buildAll() {
  const meta = loadMeta()
  const questions = collectQuestions()
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const written = []
  for (const q of questions) {
    const doc = renderLabDoc(q, meta)
    fs.writeFileSync(path.join(OUT_DIR, `${q.id}.md`), doc, "utf8")
    written.push(q.id)
  }
  return written
}

if (process.argv[1] && process.argv[1].endsWith("build-lab-docs.mjs")) {
  const written = buildAll()
  console.log(`已生成 ${written.length} 份题目文档 → public/content/labs/`)
}
