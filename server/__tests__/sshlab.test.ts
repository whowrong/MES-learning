import { afterEach, describe, expect, it } from "vitest"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const executor = path.resolve("server/sshlab.mjs")
const tempDirs: string[] = []

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sshlab-test-"))
  tempDirs.push(dir)
  return dir
}
function invoke(dataDir: string, request: Record<string, unknown>) {
  const result = spawnSync(process.execPath, [executor, JSON.stringify({ ownerId: "owner-a", migrateLegacy: true, ...request })], {
    encoding: "utf8",
    timeout: 10000,
    env: { ...process.env, MES_LAB_DATA: dataDir },
  })
  if (result.error) throw result.error
  expect(result.status, result.stderr).toBe(0)
  return JSON.parse(result.stdout)
}
afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe("真实服务器连接类型", () => {
  it("老连接记录自动按通用直连 SSH 读取，不丢字段", () => {
    const dir = sandbox()
    fs.writeFileSync(path.join(dir, "server-connections.json"), JSON.stringify({ old: {
      id: "old", label: "旧连接", host: "example.test", username: "user", port: 22, password: "legacy-secret",
    } }), { mode: 0o600 })

    const result = invoke(dir, { action: "list" })
    expect(result.connections).toHaveLength(1)
    expect(result.connections[0]).toMatchObject({
      id: "old", label: "旧连接", host: "example.test", username: "user", connType: "ssh",
      platform: "generic", transport: "direct", canExec: true, canUpload: true,
    })
    expect(JSON.stringify(result)).not.toContain("legacy-secret")
    const stored = JSON.parse(fs.readFileSync(path.join(dir, "server-connections.json"), "utf8"))
    expect(stored).toMatchObject({ version: 2, owners: { "owner-a": { old: { password: "legacy-secret" } } } })
    expect(invoke(dir, { action: "list", ownerId: "owner-b", migrateLegacy: false }).connections).toHaveLength(0)
  })


  it("连接列表、执行和删除都按认证账号隔离；缺少服务端账号范围时拒绝", () => {
    const dir = sandbox()
    const saved = invoke(dir, { action: "save", connection: {
      id: "private-to-a", label: "A 的服务器", connType: "manual", platform: "generic",
      panelUrl: "https://example.test/terminal",
    } })
    expect(saved.ok).toBe(true)
    expect(invoke(dir, { action: "list", ownerId: "owner-b", migrateLegacy: false }).connections).toHaveLength(0)
    expect(invoke(dir, { action: "exec", ownerId: "owner-b", migrateLegacy: false, connectionId: "private-to-a", command: "whoami" })).toMatchObject({ ok: false, error: "服务器连接不存在或已删除" })
    expect(invoke(dir, { action: "delete", ownerId: "owner-b", migrateLegacy: false, id: "private-to-a" }).ok).toBe(true)
    expect(invoke(dir, { action: "list", ownerId: "owner-a" }).connections).toHaveLength(1)
    expect(invoke(dir, { action: "list", ownerId: "" })).toMatchObject({ ok: false, error: "MES account scope is required" })
  })

  it("Instabox API key 仅存服务端权限受限文件，不从保存或列表回传", () => {
    const dir = sandbox(), apiKey = "test-instabox-key-not-for-output"
    const saved = invoke(dir, { action: "save", connection: {
      id: "insta", label: "Instabox dev", connType: "api-cli", platform: "instabox",
      machine: "dev", apiKey,
    } })
    expect(saved.ok).toBe(true)
    expect(JSON.stringify(saved)).not.toContain(apiKey)
    const connectionFile = path.join(dir, "server-connections.json")
    expect(fs.statSync(connectionFile).mode & 0o777).toBe(0o600)
    expect(fs.readFileSync(connectionFile, "utf8")).toContain(apiKey)

    const listed = invoke(dir, { action: "list" })
    expect(JSON.stringify(listed)).not.toContain(apiKey)
    expect(listed.connections[0]).toMatchObject({ connType: "api-cli", platform: "instabox", machine: "dev", canExec: true, canUpload: true })
  })

  it("Instabox test and command execution use the key only in the CLI environment and redact its output", () => {
    const dir = sandbox(), apiKey = "test-instabox-key-never-returned"
    const cli = path.join(dir, "fake-instabox")
    fs.writeFileSync(cli, "#!/bin/sh\nif [ \"$6\" = \"fail\" ]; then echo \"$INSTABOX_API_KEY\" >&2; exit 7; fi\necho ok\necho \"$INSTABOX_API_KEY\"\necho \"$@\"\n", { mode: 0o700 })
    invoke(dir, { action: "save", connection: {
      id: "insta", label: "Instabox dev", connType: "api-cli", platform: "instabox",
      machine: "dev", cliPath: cli, apiKey,
    } })

    const tested = invoke(dir, { action: "test", connectionId: "insta" })
    expect(tested.ok).toBe(true)
    expect(tested.stdout).toContain("ok")
    expect(tested.stdout).toContain("[已隐藏]")
    expect(JSON.stringify(tested)).not.toContain(apiKey)

    const executed = invoke(dir, { action: "exec", connectionId: "insta", command: "hostname" })
    expect(executed.ok).toBe(true)
    expect(JSON.stringify(executed)).not.toContain(apiKey)

    const failed = invoke(dir, { action: "exec", connectionId: "insta", command: "fail" })
    expect(failed.ok).toBe(false)
    expect(JSON.stringify(failed)).not.toContain(apiKey)
  })

  it("manual mode returns MANUAL_ONLY and never executes or uploads", () => {
    const dir = sandbox()
    const saved = invoke(dir, { action: "save", connection: {
      id: "manual", label: "Cloady panel", connType: "manual", platform: "cloady",
      panelUrl: "https://panel.cloady.io/app/1",
    } })
    expect(saved.ok).toBe(true)
    for (const action of ["test", "exec", "upload"]) {
      const result = invoke(dir, { action, connectionId: "manual", command: "touch /tmp/should-not-run", remotePath: "/tmp/a", content: "x" })
      expect(result).toMatchObject({ ok: false, code: "MANUAL_ONLY", panelUrl: "https://panel.cloady.io/app/1" })
    }
  })

  it("拒绝非 Instabox API-CLI 平台组合及不受支持的连接方式", () => {
    const dir = sandbox()
    expect(invoke(dir, { action: "save", connection: {
      id: "wrong-platform", label: "no", connType: "api-cli", platform: "generic", machine: "dev", apiKey: "x-key",
    } })).toMatchObject({ ok: false })
    expect(invoke(dir, { action: "save", connection: {
      id: "bad-mode", label: "no", connType: "shell", platform: "generic",
    } })).toMatchObject({ ok: false })
  })
})
