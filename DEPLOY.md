# 独立部署指南(脱离 VibeX 平台自托管)

本应用由 VibeX 平台生成, 平台在部署时注入了一批私有能力(路径前缀、简写
API 钩子、lab 执行器路由、模型名单渲染)。仓库已做独立部署适配, 按本文
即可在一台普通 Linux 主机上完整自托管。

## 0. 前置要求

| 组件 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | ≥ 22.5 | 前端构建(Vite 8)与 server 执行器(node:sqlite)都需要 |
| pnpm | 任意近版本 | `corepack enable && corepack prepare pnpm@latest --activate` 亦可 |
| PocketBase | 0.40.x | 单文件二进制, 从 pocketbase.io 下载 |
| frpc(可选) | 0.71.x | 只有经 frp 网关对外时才需要 |

## 1. 构建前端(决定挂载前缀)

前端在运行时从「入口脚本地址」推导部署前缀(src/lib/pb.ts), 因此**构建
时的 `--base` 必须与最终挂载路径一致**:

```bash
pnpm install
# 挂在子路径 /mes 下:
npx tsc -b && npx vite build --base=/mes/
# 或根路径部署:
# npx tsc -b && npx vite build --base=/
```

产物在 `dist/`。PocketBase 地址自动取「<前缀>/__pb」, React Router 的
basename 自动取前缀; 原 VibeX 预览前缀(/app-preview/app-<hex>/、
/p/app-<hex>/)仍兼容。

## 2. PocketBase 目录布局

```
<部署目录>/
├── pocketbase            # 二进制
├── pb_data/              # 数据(SQLite), 首次启动自动生成
├── pb_hooks/             # 把 templates/pb_hooks/*.js 全部拷进来
└── pb_public/            # 把 dist/ 的内容拷进来(前端静态文件)
```

钩子清单(templates/pb_hooks/):

| 文件 | 作用 |
| --- | --- |
| `llm.pb.js` | /api/llm/* 文生文代理(依赖 RunningHub, 见第 5 节) |
| `aigc.pb.js` | /api/aigc/* 生图任务代理(同上) |
| `_rh_admin_sso.pb.js` | 平台管理员 SSO; 无平台环境变量时自动失效, 无影响 |
| `shorthand_crud.pb.js` | **独立部署新增**: 简写 API(见第 3 节), 自动建集合 |
| `lab_proxy.pb.js` | **独立部署新增**: dblab/sshlab 执行器路由(见第 4 节) |

启动与管理员:

```bash
./pocketbase superuser upsert <你的邮箱> <你的口令>   # 仅首次, 用于进 /_/ 后台
./pocketbase serve --http 127.0.0.1:8090 --dir ./pb_data --hooksDir ./pb_hooks --publicDir ./pb_public
```

## 3. 数据与简写 API

学习进度与文档不走 PocketBase 标准集合路由, 而走平台风格的简写 API:
`{PB}/api/<集合>[/<id>]`(GET 列表 / GET 单条 / POST / PATCH / DELETE)。
`shorthand_crud.pb.js` 在 PB 启动时自动创建以下集合(访问规则全关, 数据
只能经简写 API 读写, 与平台的安全模型一致), 无需手工建表:

| 集合 | 用途 | 字段 |
| --- | --- | --- |
| `player_progress` | 全部学习存档(单条记录) | chapter_status / gauges / review_queue / term_mastery / review_state / study_days / interview_history / factory_history / ops_history / db_history(均为 json)、last_route(text) |
| `deploy_docs` | 运维实操的部署文档 | title / content / commands / doc_type(均为 text) |

列表契约: `{page, perPage, totalItems, totalPages, items}`, 支持
`?page`、`?perPage`(上限 500)、`?sort`(默认 `-created`)与文本字段等值
过滤(如 `?doc_type=deploy`)。

**数据恢复**: 平台版的数据就在 `player_progress` 集合里; 若你手头有平台
导出的 pb_data 或该集合的备份, 覆盖/导入到 pb_data 即可。本仓库不携带
任何真实存档数据。

## 4. server/ 执行器(dblab / sshlab)

「数据库实操营」与「真实服务器模式」的前端调用 `/api/dblab/*`、
`/api/sshlab/*`; 它们**不是常驻服务**, 而是由 `lab_proxy.pb.js` 在每次
请求时经 PocketBase 的 `$os.cmd` 拉起仓库 `server/` 下的 Node 执行器:

| 执行器 | 作用 | 依赖 |
| --- | --- | --- |
| `server/dblab.mjs` | 内置 SQLite 练习库 + 外部 MySQL/PG/MSSQL 连接的保存/测试/执行 | Node 内置 node:sqlite; 外部库走 mysql2 / pg / mssql(已在 package.json dependencies) |
| `server/sshlab.mjs` | SSH 连接的保存/测试/远程命令执行/SFTP 上传 | ssh2(已在 dependencies) |
| `server/seed-practice-db.mjs` | 练习库种子(由 dblab 首次使用时自动引用) | — |
| `server/backfill-db-expect.mjs` | 练习期望结果回填工具(离线维护用, 运行时不调用) | — |

调用契约: `node <script> '<请求JSON>'` → stdout 输出单行 JSON(错误也
封装在 JSON 里, 恒 exit 0), 输出经 `server/asciiJson.mjs` 转义为纯
ASCII(规避 $os.cmd 字节解码问题)。`/api/sshlab/webhook` 由钩子直接
$http.send 转发, 不经执行器。

部署要点:

1. `server/` 必须能向上找到应用的 `node_modules`(即部署在应用根目录内,
   且已 `pnpm install`), 否则 ssh2 等驱动加载失败。
2. 钩子环境变量: `MES_SERVER_DIR` = server/ 的绝对路径(默认
   `/workspace/pocketbase-bin/server`, 按你的布局改); `MES_LAB_NODE` =
   node 路径(默认 `node`)。以环境变量方式传给 pocketbase 进程即可。
3. 执行器把连接凭据与练习库写在 `LAB_DATA`(server/*.mjs 内常量, 默认
   `/workspace/pocketbase-bin/lab-data`), 凭据文件权限 600、接口输出
   脱敏; 部署时保证该目录存在且可写, 或改这两个文件顶部的 LAB_DATA
   常量为你的路径(这是部署配置, 不是业务逻辑)。
4. ⚠️ 安全: dblab/sshlab 本质是「任意 SQL / 任意 SSH 命令」执行面,
   只应放在有访问门禁的部署里(见第 6 节 Basic Auth), 不要裸奔公网。

## 5. 已知未覆盖的平台专有路由

以下能力由 VibeX/RunningHub 平台提供, 独立部署**不包含**, 前端均已做
失败降级(不崩溃, 对应功能不可用):

| 路由族 | 用途 | 独立部署状态 |
| --- | --- | --- |
| `/api/llm/*`、`/api/aigc/*` | AI 导师对话、AI 生图(经 llm.runninghub.cn) | 钩子可加载, 但模型名单在平台部署时注入; 仓库内为独立部署默认值 `[]`(无可用模型), 且调用需要 RunningHub 账号会话 |
| `/api/aigc/{model}/*`、`/api/aigc/ai-app/*` | 按模型名的生图变体路由 | 模板钩子未注册, 平台专有 |
| `/api/media/persist`、`/api/files/media_assets/*` | 媒体转存与素材文件服务 | 平台专有; 生图结果转存不可用 |
| `/uc/getUserInfo`、`/uc/logout` | RunningHub 账号信息/登出 | 独立部署以匿名身份运行(rhLogin 失败即匿名) |
| `/api/sandbox/me`、`/api/sandbox/app-info`、`/api/sandbox-token/revoke` | 平台沙箱身份与令牌 | 同上, 降级匿名 |

## 6. 子路径对外(边缘代理 + frp, 可选)

`deploy/` 提供通用样例(全部零敏感值, 占位符自行替换):

- `deploy/edge-proxy.mjs` — 零依赖 Node 代理: 剥前缀、`__pb` 映射到
  PocketBase、X-Pb-Auth 还原、WebSocket 透传; 可选 Basic Auth 大门
  (`BASIC_AUTH_USER` / `BASIC_AUTH_PASS` 环境变量, 适合私人使用)。
- `deploy/frpc.toml.sample` — frp 客户端样例(serverAddr / token /
  domain 全是占位符), 把边缘代理按域名 + `/mes` 路径挂到网关。
- `deploy/watchdog.sh.sample` — 无 systemd 环境下保活
  pocketbase / edge-proxy / frpc 的看门狗(PID 文件 + cmdline 双校验)。

参考启动顺序: pocketbase(8090) → edge-proxy(18090, APP_PREFIX 与
构建 --base 一致) → frpc → watchdog。
