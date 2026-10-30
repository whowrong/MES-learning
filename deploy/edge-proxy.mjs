// deploy/edge-proxy.mjs — 零依赖边缘代理样例(仅用 Node 内置模块)
//
// 用途: 把应用挂在任意子路径前缀下(如 https://<域名>/mes/), 前端只认
// 「<前缀>/__pb」一个 PocketBase 入口, 本代理负责:
//   1. 剥掉路径前缀后转发给本机 PocketBase;
//   2. 「<前缀>/__pb/*」映射到 PocketBase 根路径(PB 本体直接提供 /api 与静态文件);
//   3. 前端在子路径下无法直达 PB 的 /api/files 缩略图等接口时通过 __pb 透传;
//   4. 把请求头 X-Pb-Auth 还原为 Authorization(PocketBase JS SDK 在部分
//      代理场景下会改用 X-Pb-Auth 携带令牌); 两者同时存在时以 X-Pb-Auth 为准;
//   5. 透传通用 HTTP upgrade; PocketBase 0.40.x realtime 使用 SSE/EventSource, 非 WebSocket;
//
// 环境变量:
//   PORT             监听端口(默认 18090)
//   PB_TARGET        PocketBase 地址(默认 http://127.0.0.1:8090)
//   APP_PREFIX       子路径前缀(默认 /mes; 根路径部署填空或 /)
//
// 启动: APP_PREFIX=/mes node deploy/edge-proxy.mjs
import http from "node:http";
import net from "node:net";
import { URL } from "node:url";
import path from "node:path";

const PORT = Number(process.env.PORT || 18090);
const TARGET = new URL(process.env.PB_TARGET || "http://127.0.0.1:8090");
let PREFIX = process.env.APP_PREFIX ?? "/mes";
if (PREFIX === "/") PREFIX = "";
if (PREFIX && !PREFIX.startsWith("/")) PREFIX = "/" + PREFIX;
if (PREFIX.endsWith("/")) PREFIX = PREFIX.slice(0, -1);

// 把带前缀的请求路径映射为 PocketBase 路径(不带前缀则返回 null → 404)
function isPrivateAdminPath(pathnameOrUrl) {
  let pathname;
  try {
    pathname = new URL(pathnameOrUrl, "http://placeholder").pathname;
    // PocketBase and intermediary HTTP stacks may normalize percent escapes at
    // different layers. Decode repeatedly and fail closed if malformed/deeply
    // encoded paths remain, so %255f cannot become /_ after this proxy check.
    for (let i = 0; i < 8; i++) {
      const decoded = decodeURIComponent(pathname);
      if (decoded === pathname) break;
      pathname = decoded;
    }
    if (/%[0-9a-f]{2}/i.test(pathname)) return true;
  } catch (_) { return true; }
  // Canonicalize separators and dot segments before checking protected paths.
  pathname = path.posix.normalize(pathname.replace(/\\/g, "/"));
  return pathname === "/_" || pathname.startsWith("/_/") ||
    pathname === "/api/collections/_superusers" || pathname.startsWith("/api/collections/_superusers/") ||
    pathname === "/api/admins" || pathname.startsWith("/api/admins/") ||
    pathname === "/__rh_admin_sso" || pathname.startsWith("/__rh_admin_sso/");
}

function mapPath(rawUrl) {
  const u = new URL(rawUrl, "http://placeholder");
  let p = u.pathname;
  if (PREFIX) {
    if (p === PREFIX) return { redirect: PREFIX + "/" + u.search };
    if (!p.startsWith(PREFIX + "/")) return null;
    p = p.slice(PREFIX.length);
  }
  if (p === "/__pb" || p.startsWith("/__pb/")) p = p.slice("/__pb".length) || "/";
  return { path: p + u.search };
}

const server = http.createServer((req, res) => {
  const mapped = mapPath(req.url || "/");
  if (!mapped) { res.writeHead(404); return res.end("not found"); }
  if (mapped.redirect) { res.writeHead(302, { Location: mapped.redirect }); return res.end(); }
  // Keep PocketBase admin UI and superuser authentication off the public site.
  if (isPrivateAdminPath(mapped.path)) { res.writeHead(404); return res.end("not found"); }

  const headers = { ...req.headers, host: TARGET.host };
  // 令牌来源优先级: X-Pb-Auth 优先, Authorization 只作回落。
  // 前置 Basic Auth 网关与前端会争用同一个 Authorization 头, 显式用
  // X-Pb-Auth 传来的才是 PocketBase 令牌, 因此有该头时必须覆盖 authorization;
  // 没有该头时才沿用请求自带的 authorization。
  if (headers["x-pb-auth"]) {
    headers["authorization"] = headers["x-pb-auth"];
  }
  const upstream = http.request(
    { hostname: TARGET.hostname, port: TARGET.port, path: mapped.path, method: req.method, headers },
    (up) => { res.writeHead(up.statusCode || 502, up.headers); up.pipe(res); }
  );
  upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end("bad gateway"); });
  req.pipe(upstream);
});

server.on("upgrade", (req, socket, head) => {
  const mapped = mapPath(req.url || "/");
  if (!mapped || mapped.redirect || isPrivateAdminPath(mapped.path)) { socket.destroy(); return; }
  const upstream = net.connect(Number(TARGET.port), TARGET.hostname, () => {
    const headers = { ...req.headers, host: TARGET.host };
    // 与普通请求一致: X-Pb-Auth 优先, Authorization 只作回落。
    if (headers["x-pb-auth"]) headers["authorization"] = headers["x-pb-auth"];
    let raw = `${req.method} ${mapped.path} HTTP/1.1\r\n`;
    for (const [k, v] of Object.entries(headers)) raw += `${k}: ${v}\r\n`;
    raw += "\r\n";
    upstream.write(raw);
    if (head && head.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[edge-proxy] :${PORT} prefix="${PREFIX || "/"}" -> ${TARGET.origin} (PB token forwarding only)`);
});
