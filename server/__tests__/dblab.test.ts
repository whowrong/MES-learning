import { afterEach, describe, expect, it } from "vitest"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const executor = path.resolve("server/dblab.mjs")
const tempDirs: string[] = []
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dblab-test-"))
  tempDirs.push(dir)
  return dir
}
function invoke(dataDir: string, request: Record<string, unknown>) {
  const result = spawnSync(process.execPath, [executor, JSON.stringify({ ownerId: "owner-a", migrateLegacy: true, ...request })], {
    encoding: "utf8", timeout: 10000, env: { ...process.env, MES_LAB_DATA: dataDir },
  })
  if (result.error) throw result.error
  expect(result.status, result.stderr).toBe(0)
  return JSON.parse(result.stdout)
}
afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe("数据库连接账号隔离", () => {
  it("保存/列表只暴露当前账号的脱敏记录，另一账号不能执行或删除", () => {
    const dir = sandbox(), password = "private-db-password"
    const saved = invoke(dir, { action: "save", connection: {
      id: "db-a", label: "账号A数据库", type: "mysql", host: "db.example", username: "a", password,
    } })
    expect(saved.ok).toBe(true)
    expect(JSON.stringify(saved)).not.toContain(password)
    const file = path.join(dir, "db-connections.json")
    expect(fs.statSync(file).mode & 0o777).toBe(0o600)
    expect(fs.readFileSync(file, "utf8")).toContain(password)
    expect(invoke(dir, { action: "list" }).connections).toHaveLength(1)
    expect(JSON.stringify(invoke(dir, { action: "list", ownerId: "owner-b", migrateLegacy: false } )).toLowerCase()).not.toContain(password)
    expect(invoke(dir, { action: "list", ownerId: "owner-b", migrateLegacy: false }).connections).toHaveLength(0)
    expect(invoke(dir, { action: "test", ownerId: "owner-b", migrateLegacy: false, connectionId: "db-a" })).toMatchObject({ ok: false, error: "连接不存在或已删除" })
    expect(invoke(dir, { action: "delete", ownerId: "owner-b", migrateLegacy: false, id: "db-a" }).ok).toBe(true)
    expect(invoke(dir, { action: "list" }).connections).toHaveLength(1)
    expect(invoke(dir, { action: "list", ownerId: "", migrateLegacy: false })).toMatchObject({ ok: false, error: "MES account scope is required" })
  })

  it("历史未分账号记录仅在服务端确认唯一 MES 账号时迁移", () => {
    const dir = sandbox()
    fs.writeFileSync(path.join(dir, "db-connections.json"), JSON.stringify({ legacy: {
      id: "legacy", label: "旧数据库", type: "postgres", host: "db.example", username: "legacy-user", password: "old-secret",
    } }), { mode: 0o600 })
    expect(invoke(dir, { action: "list", ownerId: "owner-b", migrateLegacy: false }).connections).toHaveLength(0)
    const migrated = invoke(dir, { action: "list", ownerId: "owner-a", migrateLegacy: true })
    expect(migrated.connections).toMatchObject([{ id: "legacy", label: "旧数据库", hasSecret: true }])
    expect(JSON.stringify(migrated)).not.toContain("old-secret")
    expect(JSON.parse(fs.readFileSync(path.join(dir, "db-connections.json"), "utf8"))).toMatchObject({ version: 2, owners: { "owner-a": { legacy: { password: "old-secret" } } } })
    expect(invoke(dir, { action: "list", ownerId: "owner-b", migrateLegacy: false }).connections).toHaveLength(0)
  })
})
