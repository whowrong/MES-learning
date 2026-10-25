import PocketBase, { LocalAuthStore } from "pocketbase"

import { getAuthHeaders } from "./auth"

// ---------------------------------------------------------------------------
// 部署前缀推导（平台内外通用）。
//
// 本 app 有三种部署形态, PB 代理与 Router basename 都挂在同一个「部署前缀」下:
//   1. VibeX 平台: /app-preview/app-<32hex>/ 或 /p/app-<32hex>/
//   2. 独立部署子路径: 任意前缀, 如 /mes/（构建时以 --base=/mes/ 打包）
//   3. 独立部署根路径 / 本地 dev: 无前缀
//
// 推导优先级:
//   a. 部署时显式注入的 window.__MES_BASE__（如 "/mes"; 显式传 "" 表示根部署）
//   b. VibeX 平台前缀正则（保持平台部署行为不变）
//   c. 入口脚本 URL: Vite 产物入口形如 <prefix>/assets/index-<hash>.js,
//      dev 下形如 <prefix>/src/main.tsx —— 取 assets/ 或 src/main 之前的部分
//   d. 兜底 ""（根路径）
// ---------------------------------------------------------------------------

// VibeX 把每个 app 部署在子路径下 (/app-preview/app-<32hex>/ 或 /p/app-<32hex>/)。
// 这个正则提取该前缀; 非平台部署时返回 null。
function matchVibexPrefix(): string | null {
  if (typeof window === "undefined") return null
  const m = window.location.pathname.match(/^\/(?:app-preview|p)\/app-[0-9a-f]{32}(?=\/|$)/)
  return m ? m[0] : null
}

// 从部署前缀里取出 appId (app-<32hex>); 非平台部署时返回 null。
function matchVibexAppId(): string | null {
  const prefix = matchVibexPrefix()
  const m = prefix?.match(/app-[0-9a-f]{32}/)
  return m ? m[0] : null
}

// 部署时显式注入的前缀（独立部署可在 index.html 里先于主脚本设置
// window.__MES_BASE__ = "/mes"）。未注入返回 null; 注入空串表示根部署。
function matchInjectedBase(): string | null {
  if (typeof window === "undefined") return null
  const v = (window as unknown as { __MES_BASE__?: unknown }).__MES_BASE__
  if (typeof v !== "string") return null
  const t = v.trim()
  if (!t || t === "/") return ""
  return (t.startsWith("/") ? t : `/${t}`).replace(/\/+$/, "")
}

// 从入口 <script src> 推导前缀: 构建产物 /<prefix>/assets/index-*.js,
// dev 服务器 /<prefix>/src/main.tsx。找不到返回 null。
function matchScriptPrefix(): string | null {
  if (typeof document === "undefined") return null
  const scripts = document.querySelectorAll("script[src]")
  for (const el of Array.from(scripts)) {
    const src = el.getAttribute("src") || ""
    const m = src.match(/^(.*)\/assets\/[^/]+$/) || src.match(/^(.*)\/src\/main\.[tj]sx?$/)
    if (m) return m[1] || ""
  }
  return null
}

let cachedPrefix: string | null = null

/** 当前部署前缀: "" = 根部署, 否则形如 "/mes" 或 "/app-preview/app-<32hex>"（无尾斜杠）。 */
export function getDeployPrefix(): string {
  if (cachedPrefix !== null) return cachedPrefix
  cachedPrefix = matchInjectedBase() ?? matchVibexPrefix() ?? matchScriptPrefix() ?? ""
  return cachedPrefix
}

// 浏览器侧 PB 代理地址: 部署前缀 + /__pb（边缘代理负责把 __pb 映射到 PB 根）。
export function getPocketBaseUrl(): string {
  return `${getDeployPrefix()}/__pb`
}

// React Router 的 basename: 子路径部署时返回部署前缀, 根部署返回 "/"。
// <BrowserRouter basename={getBasename()}> 之后, 站内 <Link to="/x"> / navigate("/x")
// 会自动拼上前缀, 不会再掉到域名根。
export function getBasename(): string {
  return getDeployPrefix() || "/"
}

// 登录态(PocketBase authStore)按 app 隔离存 localStorage。同源下多个 app
// (平台预览域多个 app-<hex>, 或独立部署多个子路径) —— 若都用 SDK 默认键
// "pocketbase_auth" 会互相读到对方的会话 (表现为"新建的自建登录应用一打开
// 就已登录, 且用户名是另一个应用注册的")。
// 键优先带 appId; 独立部署带部署前缀的清洗形态; 根部署/dev 退回单一键。
const prefixKey = getDeployPrefix()
  .replace(/[^a-zA-Z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
const AUTH_STORE_KEY = `pb_auth_${matchVibexAppId() ?? (prefixKey || "local")}`

export const pb = new PocketBase(getPocketBaseUrl(), new LocalAuthStore(AUTH_STORE_KEY))

// 线上网关(VcAuthFilter)会把请求头里的 Authorization 一律当 RH 令牌校验——app
// 自己的 PocketBase token 走 Authorization 会被误判成非法 RH 令牌, 整个请求被
// 网关 401 (TOKEN_INVALID) 拒掉, 根本到不了后端。因此凡是经 control 代理的部署
// 形态 (app-preview / 发布 / 沙箱域), PB token 一律改走 X-Pb-Auth 自定义头,
// 由 control 在转发给 PocketBase 之前还原成 Authorization, 对 PB 侧无感。
// 本地直连 PB (localhost / 裸 IP, 中间没有 control) 时保持 Authorization 原样。
export const PB_USER_AUTH_HEADER = "X-Pb-Auth"

export function isDirectPbHost(): boolean {
  if (typeof window === "undefined") return false
  const host = window.location.hostname
  return host === "localhost" || host === "[::1]" || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
}

// 裸 fetch (aigc.ts / llm.ts 等) 统一用这个拿 PB 登录头; 未登录返回空对象。
export function pbAuthHeader(token?: string | null): Record<string, string> {
  if (!token) return {}
  return isDirectPbHost() ? { Authorization: token } : { [PB_USER_AUTH_HEADER]: token }
}

/** Fetch an app-owned PocketBase custom route with the current native auth token. */
export function pbFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const auth = pbAuthHeader(pb.authStore.token)
  for (const [name, value] of Object.entries(auth)) headers.set(name, value)
  return fetch(input, { ...init, headers, credentials: init.credentials ?? "include" })
}

// B1 沙箱域(*.apps.vibex.cn)上访问者身份靠 X-Vibex-Scoped-Token 承载
// (老域 getAuthHeaders() 返回空对象, 零影响)。挂在 SDK 层, 让所有
// pb.collection(...) 请求自动携带, 业务代码不用感知。
// 同时把 SDK 自动附加的 PB Authorization 改名为 X-Pb-Auth (原因见上)。
pb.beforeSend = (url, options) => {
  const headers: Record<string, string> = { ...((options.headers as Record<string, string>) || {}) }
  const token = pb.authStore.token
  if (token && !isDirectPbHost() && headers["Authorization"] === token) {
    delete headers["Authorization"]
    headers[PB_USER_AUTH_HEADER] = token
  }
  options.headers = { ...headers, ...getAuthHeaders() }
  return { url, options }
}

pb.authStore.onChange(() => {
  // hook for UI updates; 业务代码按需订阅
}, true)
