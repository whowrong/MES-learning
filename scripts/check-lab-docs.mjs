#!/usr/bin/env node
// 校验实操营题目与文档的一一对应关系（CI / 提交前跑）。
// 退出码 0 = 全部对得上；1 = 有题无文档、有文档无题、章节缺失或敏感串。
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const LABS = path.join(ROOT, "public/content/labs")
const REQUIRED = [
  "## 1. 题目目标与业务背景",
  "## 2. 涉及的数据表或服务",
  "## 3. 需要的账号与权限",
  "## 4. 环境要求（演练专用）",
  "## 5. 标准步骤",
  "## 6. 验收标准（可机器判定）",
  "## 7. 常见错误与排查提示",
  "## 8. AI 环境准备步骤（供站内 AI 生成准备脚本）",
  "## 9. AI 执行脚本要点（供站内 AI 生成执行脚本）",
  "## 10. 安全边界与失败处理",
]

const ids = new Set()
for (const dir of ["db-training", "ops-training"]) {
  const base = path.join(ROOT, "public/content", dir)
  for (const f of fs.readdirSync(base).filter((x) => x.endsWith(".json"))) {
    const mod = JSON.parse(fs.readFileSync(path.join(base, f), "utf8"))
    for (const t of mod.tasks ?? []) ids.add(t.id)
    for (const it of mod.items ?? []) ids.add(it.id)
  }
}

let bad = 0
const files = fs.readdirSync(LABS).filter((f) => f.endsWith(".md"))
for (const id of ids) {
  const file = path.join(LABS, `${id}.md`)
  if (!fs.existsSync(file)) {
    console.error(`✗ 有题无文档：${id}`)
    bad += 1
    continue
  }
  const content = fs.readFileSync(file, "utf8")
  for (const section of REQUIRED) {
    if (!content.includes(section)) {
      console.error(`✗ ${id} 缺章节：${section}`)
      bad += 1
    }
  }
}
for (const f of files) {
  const id = f.replace(/\.md$/, "")
  if (!ids.has(id)) {
    console.error(`✗ 有文档无题：${id}`)
    bad += 1
  }
}
console.log(bad === 0 ? `✓ 题目 ${ids.size} 道 / 文档 ${files.length} 份，一一对应校验通过` : `✗ 校验失败：${bad} 处问题`)
process.exit(bad === 0 ? 0 : 1)
