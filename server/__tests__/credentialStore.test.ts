import { afterEach, describe, expect, it } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { readCredentialStore, writeCredentialStore } from "../credentialStore.mjs"

const originalKey = process.env.MES_LAB_ENCRYPTION_KEY
const originalCredentialsDirectory = process.env.CREDENTIALS_DIRECTORY
const key = Buffer.alloc(32, 19).toString("base64")
const tempDirs: string[] = []
function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mes-credential-store-"))
  tempDirs.push(dir)
  return dir
}
function clearKeyEnvironment() {
  delete process.env.MES_LAB_ENCRYPTION_KEY
  delete process.env.CREDENTIALS_DIRECTORY
}
afterEach(() => {
  if (originalKey === undefined) delete process.env.MES_LAB_ENCRYPTION_KEY
  else process.env.MES_LAB_ENCRYPTION_KEY = originalKey
  if (originalCredentialsDirectory === undefined) delete process.env.CREDENTIALS_DIRECTORY
  else process.env.CREDENTIALS_DIRECTORY = originalCredentialsDirectory
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe("MES credential store encryption", () => {
  it("encrypts new writes and decrypts only with the same key and context", () => {
    clearKeyEnvironment()
    process.env.MES_LAB_ENCRYPTION_KEY = key
    const dir = sandbox(), file = path.join(dir, "connections.json")
    const data = { owner: { id: "db-1", password: "never-on-disk" } }
    writeCredentialStore(file, data, "db-connections")
    const raw = fs.readFileSync(file, "utf8")
    expect(raw).not.toContain("never-on-disk")
    expect(fs.statSync(file).mode & 0o777).toBe(0o600)
    expect(readCredentialStore(file, "db-connections")).toEqual(data)
    expect(() => readCredentialStore(file, "server-connections")).toThrow(/无法解密/)
    process.env.MES_LAB_ENCRYPTION_KEY = Buffer.alloc(32, 20).toString("base64")
    expect(() => readCredentialStore(file, "db-connections")).toThrow(/无法解密/)
  })

  it("encrypts legacy plaintext atomically on first keyed read without losing profiles", () => {
    clearKeyEnvironment()
    const dir = sandbox(), file = path.join(dir, "connections.json")
    const data = { version: 2, owners: { "owner-a": { db: { password: "legacy-secret" } } } }
    fs.writeFileSync(file, JSON.stringify(data), { mode: 0o600 })
    expect(readCredentialStore(file, "db-connections")).toEqual(data)
    expect(fs.readFileSync(file, "utf8")).toContain("legacy-secret") // No key: retain backwards-compatible reads.
    process.env.MES_LAB_ENCRYPTION_KEY = key
    expect(readCredentialStore(file, "db-connections")).toEqual(data)
    const encrypted = fs.readFileSync(file, "utf8")
    expect(encrypted).not.toContain("legacy-secret")
    expect(JSON.parse(encrypted)).toMatchObject({ format: "mes-credential-store", version: 1, algorithm: "aes-256-gcm" })
    expect(fs.statSync(file).mode & 0o777).toBe(0o600)
  })

  it("refuses new plaintext writes without a key and refuses encrypted files without a key", () => {
    clearKeyEnvironment()
    const dir = sandbox(), file = path.join(dir, "connections.json")
    expect(() => writeCredentialStore(file, { a: 1 }, "db-connections")).toThrow(/未配置服务端加密密钥/)
    expect(fs.existsSync(file)).toBe(false)
    process.env.MES_LAB_ENCRYPTION_KEY = key
    writeCredentialStore(file, { a: 1 }, "db-connections")
    clearKeyEnvironment()
    expect(() => readCredentialStore(file, "db-connections")).toThrow(/加密密钥未配置/)
  })

  it("loads a systemd credential by its mounted directory without exporting the key", () => {
    clearKeyEnvironment()
    const dir = sandbox(), credentials = path.join(dir, "credentials"), file = path.join(dir, "connections.json")
    fs.mkdirSync(credentials, { mode: 0o700 })
    fs.writeFileSync(path.join(credentials, "MES_LAB_ENCRYPTION_KEY"), key, { mode: 0o400 })
    writeCredentialStoreWithEnv(file, { safe: true }, credentials)
    expect(readCredentialStoreWithEnv(file, "db-connections", credentials)).toEqual({ safe: true })
  })
})

function writeCredentialStoreWithEnv(file: string, value: unknown, credentialsDir: string) {
  process.env.CREDENTIALS_DIRECTORY = credentialsDir
  writeCredentialStore(file, value, "db-connections")
}
function readCredentialStoreWithEnv(file: string, context: string, credentialsDir: string) {
  process.env.CREDENTIALS_DIRECTORY = credentialsDir
  return readCredentialStore(file, context)
}
