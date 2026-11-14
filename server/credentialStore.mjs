// Shared encrypted-at-rest persistence for MES server/database connection profiles.
// The encryption key must be supplied by the service's secret/credential manager;
// it is never written beside the data file or returned by any executor.
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const FORMAT = "mes-credential-store"
const VERSION = 1

function readKey() {
  let encoded = process.env.MES_LAB_ENCRYPTION_KEY || ""
  if (!encoded && process.env.CREDENTIALS_DIRECTORY) {
    const credentialPath = path.join(process.env.CREDENTIALS_DIRECTORY, "MES_LAB_ENCRYPTION_KEY")
    try { encoded = fs.readFileSync(credentialPath, "utf8").trim() }
    catch (error) {
      if (error?.code !== "ENOENT") throw new Error("服务端加密凭据不可读取")
    }
  }
  if (!encoded) return null
  if (!/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw new Error("服务端加密密钥格式无效")
  const key = Buffer.from(encoded, "base64")
  if (key.length !== 32 || key.toString("base64") !== encoded) throw new Error("服务端加密密钥格式无效")
  return key
}

function isEnvelope(value) {
  return value && typeof value === "object" && !Array.isArray(value) && value.format === FORMAT
}

function encrypt(value, context, key) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  cipher.setAAD(Buffer.from(`${FORMAT}:${context}`, "utf8"))
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
  return {
    format: FORMAT,
    version: VERSION,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  }
}

function decrypt(envelope, context, key) {
  if (envelope.version !== VERSION || envelope.algorithm !== "aes-256-gcm") throw new Error("凭证文件加密格式不受支持")
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"))
    decipher.setAAD(Buffer.from(`${FORMAT}:${context}`, "utf8"))
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8")
    return JSON.parse(plaintext)
  } catch {
    throw new Error("凭证文件无法解密：请确认服务端密钥正确且文件未损坏")
  }
}

function writeEncrypted(file, value, context, key) {
  const dir = path.dirname(file)
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const temporary = `${file}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`
  let fd
  try {
    fd = fs.openSync(temporary, "wx", 0o600)
    fs.writeFileSync(fd, JSON.stringify(encrypt(value, context, key), null, 2), "utf8")
    fs.fsyncSync(fd)
    fs.closeSync(fd)
    fd = undefined
    fs.renameSync(temporary, file)
    fs.chmodSync(file, 0o600)
    try {
      const dirFd = fs.openSync(dir, "r")
      try { fs.fsyncSync(dirFd) } finally { fs.closeSync(dirFd) }
    } catch { /* Directory fsync is not available on every supported platform. */ }
  } catch (error) {
    if (fd !== undefined) try { fs.closeSync(fd) } catch {}
    try { fs.unlinkSync(temporary) } catch {}
    throw error
  }
}

/**
 * Read a JSON credential store. Existing plaintext files remain readable so a
 * key can be introduced without losing data; when a key is available, the first
 * read atomically encrypts the legacy file in place. Encrypted files fail closed
 * if the key is missing/wrong and are never mistaken for an empty store.
 */
export function readCredentialStore(file, context) {
  let text
  try { text = fs.readFileSync(file, "utf8") }
  catch (error) {
    if (error?.code === "ENOENT") return {}
    throw error
  }
  let value
  try { value = JSON.parse(text) }
  catch { throw new Error("凭证文件格式错误；为避免覆盖数据，已停止读取") }
  const key = readKey()
  if (isEnvelope(value)) {
    if (!key) throw new Error("此凭证文件已加密，但服务端加密密钥未配置")
    return decrypt(value, context, key)
  }
  if (key) writeEncrypted(file, value, context, key)
  return value
}

/** Writes always require a service-managed key; plaintext credential writes are forbidden. */
export function writeCredentialStore(file, value, context) {
  const key = readKey()
  if (!key) throw new Error("未配置服务端加密密钥；为避免明文保存，连接档案未更改")
  writeEncrypted(file, value, context, key)
}

// Exported for focused unit tests only; production callers never receive keys.
export function _credentialStoreFormatForTest() { return FORMAT }
