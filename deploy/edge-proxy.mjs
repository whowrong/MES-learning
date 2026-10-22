// deploy/edge-proxy.mjs — 零依赖边缘代理样例(仅用 Node 内置模块)
//
// 用途: 把应用挂在任意子路径前缀下(如 https://<域名>/mes/), 前端只认
// 「<前缀>/__pb」一个 PocketBase 入口, 本代理负责:
//   1. 剥掉路径前缀后转发给本机 PocketBase;
//   2. 「<前缀>/__pb/*」映射到 PocketBase 根路径(PB 本体直接提供 /api 与静态文件);
//   3. 前端在子路径下无法直达 PB 的 /api/files 缩略图等接口时通过 __pb 透传;
//   4. 把请求头 X-Pb-Auth 还原为 Authorization(PocketBase JS SDK 在部分
//      代理场景下会改用 X-Pb-Auth 携带令牌);
//   5. WebSocket 升级透传(PocketBase realtime);
//   6. 可选 Basic Auth 大门(口令只从环境变量读, 绝不写进代码)。
//
// 环境变量:
//   PORT             监听端口(默认 18090)
//   PB_TARGET        PocketBase 地址(默认 http://127.0.0.1:8090)
//   APP_PREFIX       子路径前缀(默认 /mes; 根路径部署填空或 /)
//   BASIC_AUTH_USER  可选: 设置后启用 Basic Auth
//   BASIC_AUTH_PASS  可选: 与 BASIC_AUTH_USER 配套(从环境变量注入)
//
// 启动: APP_PREFIX=/mes node deploy/edge-proxy.mjs
import http from "node:http";
import net from "node:net";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 18090);
const TARGET = new URL(process.env.PB_TARGET || "http://127.0.0.1:8090");
let PREFIX = process.env.APP_PREFIX ?? "/mes";
if (PREFIX === "/") PREFIX = "";
if (PREFIX && !PREFIX.startsWith("/")) PREFIX = "/" + PREFIX;
if (PREFIX.endsWith("/")) PREFIX = PREFIX.slice(0, -1);

const AUTH_USER = process.env.BASIC_AUTH_USER || "";
const AUTH_PASS = process.env.BASIC_AUTH_PASS || "";

function checkAuth(req) {
  if (!AUTH_USER) return true;
  const h = req.headers["authorization"] || "";
  if (!h.startsWith("Basic ")) return false;
  const decoded = Buffer.from(h.slice(6), "base64").toString("utf8");
  const idx = decoded.indexOf(":");
  if (idx < 0) return false;
  return decoded.slice(0, idx) === AUTH_USER && decoded.slice(idx + 1) === AUTH_PASS;
}

function unauthorized(res) {
  res.writeHead(401, { "WWW-Authenticate": 'Basic realm="mes"' });
  res.end("unauthorized");
}

// 把带前缀的请求路径映射为 PocketBase 路径(不带前缀则返回 null → 404)
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
  if (!checkAuth(req)) return unauthorized(res);
  const mapped = mapPath(req.url || "/");
  if (!mapped) { res.writeHead(404); return res.end("not found"); }
  if (mapped.redirect) { res.writeHead(302, { Location: mapped.redirect }); return res.end(); }

  const headers = { ...req.headers, host: TARGET.host };
  if (headers["x-pb-auth"] && !headers["authorization"]) {
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
  if (!checkAuth(req)) { socket.destroy(); return; }
  const mapped = mapPath(req.url || "/");
  if (!mapped || mapped.redirect) { socket.destroy(); return; }
  const upstream = net.connect(Number(TARGET.port), TARGET.hostname, () => {
    const headers = { ...req.headers, host: TARGET.host };
    if (headers["x-pb-auth"] && !headers["authorization"]) headers["authorization"] = headers["x-pb-auth"];
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
  console.log(`[edge-proxy] :${PORT} prefix="${PREFIX || "/"}" -> ${TARGET.origin} basicAuth=${AUTH_USER ? "on" : "off"}`);
});
