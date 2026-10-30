---
title: today-dev 开发说明（实习准备营新增 + 存档修复 + 部署脚本）
summary: today-dev 以 wabi-dev 为基线新增「实习准备营」模块（方向1 工业软件实施与交付、方向4 产线现场信息化、通用底座），扩充术语库 33 条、数据库实操营 4 题、面试题库 8 题；修复 PocketBase 存档在老集合缺字段时整次写入失败、读取回落默认值的成因（补齐字段 + 写入端逐字段容错，已用真实 PocketBase 0.40.6 实测老记录逐字节不变）。新增学习进度数据保护一节：备份覆盖存档数据本体、部署前后做进度不变量逐条校验、失败自动回滚且不触碰存档数据。本轮按 Muse 交接文档逐条对齐（内容格式文档、README 数字、回填脚本多语句修正）。自测：类型检查、构建与 625 条用例通过。部署挂起：47.122.104.160 是刘先生的代理服务器、非部署目标，现网两台 QwenPaw，目标待确认；推送 today-dev 因缺 GitHub 写凭据未成功。
---

# today-dev 开发说明

## 一、这次做了什么（一句话）

在 wabi-dev 基线上新建 today-dev 分支，新增「实习准备营」学习模块（方向1 / 方向4 / 通用底座），
扩充既有模块（术语库、数据库实操营、面试题库），定位并修复「存档写不进 / 读不出」中「集合缺字段」这一支的成因，
并补齐可重复执行的部署与备份保留脚本。

本轮（第二轮）按 Muse 转交的《MES 信息文档》逐条对齐了实现：补写内容格式文档里的实习准备营格式与
K9~K11 知识点映射、修正 README 的规模数字、修正数据库回填脚本多语句执行的问题、把「存档读不出」的
根因论证与只读排查清单写清楚。

**部署已按 Muse 意见挂起**（现网是两台 QwenPaw，47.122.104.160 不是现网，目标待刘先生确认）；
**推送 today-dev 已获授权，但本环境没有可用 GitHub 凭据且出口被拦，尚未推上去**；
main、wabi-dev 未动，未打 tag。

## 二、分支与基线

| 项 | 值 |
| --- | --- |
| 仓库 | github.com/whowrong/MES-learning |
| 基线 | `wabi-dev`（bed9246 «修正 SQL 排行题并列结果判分»） |
| 新分支 | `today-dev`（本地提交，未设置 upstream；推送授权已到位，但环境缺凭据未推成功） |
| 站点形态 | 子路径部署 `https://mes.nya.je/mes/`，构建必须 `--base=/mes/` |
| 现网形态 | 两台 QwenPaw（AgentScope）互为备份，经香港网关对外；**生产机器与生产数据由喵喵运维，today 不动生产环境**（据 Muse《MES 信息文档》第 3 节） |
| 入口门禁 | 现网入口有 Basic Auth（账号 `monika`，**口令需向刘先生本人索取**） |

`main`（b5c8335）全程未被读取合并，也未修改。wabi-dev 上的演示版专用账号认证改动原样保留在
today-dev 里，没有回流到 main。

## 三、新增模块：实习准备营（/career-prep）

### 3.1 内容规模

| 赛道 | 文件 | 知识点卡片 | 题目 | 顺序题 |
| --- | --- | --- | --- | --- |
| 方向1 · 工业软件实施与交付 | `public/content/career-prep/direction1.json` | 8 | 16 | 1 |
| 方向4 · 产线现场信息化实施 | `public/content/career-prep/direction4.json` | 6 | 12 | 1 |
| 通用底座 | `public/content/career-prep/base.json` | 7 | 12 | 1 |
| 合计 | — | 21 | 40 | 3 |

### 3.2 覆盖的知识清单（对照任务书）

**方向1（工业软件厂商实施 / 交付）**
ERP / MES / WMS 的职责边界与衔接方式（用业务粒度切分，而不是按新旧或部门）；
生产订单从下单到发货的全流程（销售订单 → 生产订单 → 排产 → 领料 → 报工 → 检验 → 入库 → 发货）；
主数据难点（物料、BOM、工艺路线、客户与供应商；一物两码、单位不统一、口径混乱）；
车间扫码报工的落点；实施方法论九步（需求调研 → 蓝图 → 配置开发 → 数据迁移 → 清洗 → 用户培训 →
上线 → 验收 → 运维）每一步的产出物与常见坑；点表类数据迁移与清洗（字段对齐、去重、校验、
上线前对账）；基础网络与数据库安全常识。

**方向4（产线现场信息化）**
Modbus / S7 / OPC UA / Profinet / EtherNet-IP 的适用场景与差异（讲清「选型看什么」，
不讲电气接线）；工业网关与边缘采集的配置概念（点位映射、标签语义化、采样与变化触发、
断网续传）；PLC 与电气认知（IO 点表、梯形图大致逻辑、程序下载与联调流程）；
视觉与传感器认知；驻场交付沟通与需求分级。

> 内容红线：方向4 只做认知层。不含梯形图编程、电气接线、伺服与传感器原理、非标设备整机调试，
> 一律用工厂词汇与工艺语义替代物理机电内容。

**通用底座**
SQL（多表 join、索引与慢查询、视图与存储过程、事务）；Linux 排障；带错误处理的脚本；
文档与培训三件套（操作手册、需求调研记录、上线验收单、培训 PPT）。

### 3.3 实现方式（与既有模块同构）

- 内容全部落在 `public/content/career-prep/*.json`，**运行时加载，加题加卡不改代码**；
  加载器 `src/content/careerPrep.ts` 带结构校验（题型、答案必须落在选项里、参考答案长度、
  加分点非空、步骤 id 唯一），内容写错会在加载时报错，而不是渲染到一半崩。
- 组卷 / 判定 / 计分 / 错题术语抽取是纯逻辑：`src/game/careerPrep.ts`。
  - 单选、多选按集合相等判定（少选、多选、顺序不同都算错）；
  - 判断题复用同一套比较逻辑；
  - 顺序题必须完全正确才得分，判定会报出每一步「正确位置 / 实际位置」；
  - 计分：客观题与顺序题等权，满分 100，四档评级 S/A/B/C 与既有训练营一致；
  - 答错题关联的术语自动进「复习队列」，随 `player_progress` 存档。
- 页面与组件：`src/pages/CareerPrep/`（页面 + `useCareerPrep` 状态机）、
  `src/components/career/`（赛道选择 / 赛道卡片 / 答题 / 排序 / 结果）。
- 接线：首页「模块入口」新增实习准备营卡片（显示已练场次），`src/App.tsx` 增加 `/career-prep` 路由。

## 四、既有模块的扩充与修复

### 4.1 扩充

1. **术语库**：`public/content/terms.json` 新增 33 条（K9/K10/K11 段），总计 70 条。
   新增术语被三条赛道的内容与面试题引用，引用关系由 `career-quality.test.ts` 校验。
2. **数据库实操营**：新增 4 题，全部走真实判分（结果比对，不是字符串匹配）：
   - `db-c5` 一物两码归并（state 模式：改引用 → 删重复主数据 → 验干净）；
   - `db-q5` 工单状态口径体检（英文状态与中文状态混用的真实数据）；
   - `db-j5` 工单 × 物料 × 报工 三表关联汇总；
   - `db-r5` 按产线的不良率排名，不良率并列时用次级排序键保证结果可复现。
   每题的 `check.expect` 都是**在内置练习库上真实执行 `check.sql` 得到的行**，
   并用 `answerSql` 跑同一份库比对一致后才落盘。
3. **面试题库**：实习题库 +4（系统边界、主数据治理、工业网关采集、查清一件事的讲述），
   校招题库 +4（上线故障处理顺序、慢查询定位、印象最深的项目、连夜导数据的第一动作），
   题目 id 全库唯一（由 `interview-quality.test.ts` 强制）。

### 4.2 修复：存档「写不进 / 读不出」

Muse《MES 信息文档》第 5 节记载：2026-10-28 刘先生报过一次「网站内存档读不出来」；喵喵查实生产机内全绿
（进程 / 磁盘 / 数据库健康，存档在 10-27 仍有写入），**根因未最终定位**，文档点名要重点看
`src/lib/pb.ts` 与 `shorthand_crud.pb.js`。本轮按这条线索把简写 API 与前端读取路径都过了一遍，
下面是改动前后的行为差异、兼容性论证，以及**这条修复覆盖不到的部分**。

**改动前（bed9246 的钩子）**

- `onBootstrap` 建集合时是 `if (existing) continue` —— 集合一旦存在就**再也不看字段结构**，
  早期版本建的集合缺的字段永远补不上；
- `POST` / `PATCH` 直接 `rec.set(field, value)`：集合缺这个字段时 `rec.set` 抛错，
  整个请求 400（`shorthand_create_error` / `shorthand_update_error`）→ **一次写失败，整份存档写不进去**；
- 读取侧 `recObj` 对每个字段单独 try/catch，集合缺字段时该字段读成 `null` →
  前端 `normalizeRecord` 把缺的字段回落成默认值（章节进度回落成「全未通关」）→ **看起来就是「存档读不出来」**；
- 列表默认按 `-created` 排序，前端取 `items[0]`。

**改动后（today-dev 的钩子）**

- `onBootstrap` 遇到已存在的集合时走**只加不删**的字段补齐：缺哪个字段就
  `existing.fields.add(new Field(def))` 再 `$app.save(existing)`，**只改集合结构、不写任何一条记录**；
- `POST` / `PATCH` 改为**逐字段容错**：集合缺字段时跳过该字段并在响应体回报 `skipped_fields`，
  不再让整次写入失败；
- 读取侧的字段清单补上 `career_history`；
- 列表默认按 `-updated` 排序（最近玩过的那条排最前），避免新建的空记录排在最前、让刘先生看到一片空白进度。

**向后兼容性：补字段会不会把历史记录重置成默认值**

不会 —— 这一点是实测的，不是推断：

- PocketBase 加字段只改表结构，已有行的新字段为空值，**不会把老字段刷成默认值**；
- 用真实 PocketBase 0.40.6 复现「老实例」：只含老字段的 `player_progress` 集合 + 一条真实结构的进度记录 →
  装上本次钩子并重启 → 老记录的 6 个进度字段**逐字节一致**、`created` / `updated` 未变、
  新增字段为空值（不是默认值）；再只 PATCH 新字段（`career_history`）→ 老字段仍逐字节一致；
- 部署侧另有 `deploy/progress-guard.mjs`：部署前后只读快照 `player_progress` 逐条比对，
  任何一条记录被改动或消失即判失败并自动回滚（第七节）。

**这条修复覆盖不到的部分（如实说明）**

- 它治的是「集合字段缺失 → 写整次失败 / 读回落默认值」这一支症状。喵喵记载的生产现象
  （机内全绿、10-27 仍有写入）与「集合缺字段」并不完全吻合：如果集合缺字段，前端每次 PATCH 都带全量字段，
  写入本该持续失败。所以**根因仍未最终定位**，本次修复不能被认定为唯一根因；
- 另一条尚未排除的可能在读取路径：`src/lib/pb.ts` 的 `pbFetch` 在非直连域名（现网经香港网关穿透，
  hostname 不是裸 IP）时把 PocketBase token 放进 `X-Pb-Auth` 头而不是 `Authorization`；
  若网关不把这个头还原成 Authorization，`requireMesUser` 会直接 401，前端 `useHome` 走 catch 分支
  展示空进度并提示「存档读取失败」。这条只能到生产机上只读验证，不能靠本地推断；
- 仓库里 `/debug` 页（`src/pages/Debug/useDebug.ts`）本来就有「存档读取 / 存档写入（幂等回写 study_days）」
  体检。本轮给它加了一项**只读**的「存档字段完整性」检查：直接看简写 API 返回的记录里 12 个存档字段
  有没有读成 `null`，缺哪个字段一目了然，不用碰生产数据。

**只读排查清单（将来在生产机上做，全程不写数据）**

1. `node deploy/progress-guard.mjs snapshot --data-dir <pb_data> --out /tmp/before.json`
   —— 看 `player_progress` 有几条记录、各字段实际值（只读）；
2. 用 app 账号登录后打开 `/debug` 页跑一次体检，看「存档读取」的返回码：
   401 = 鉴权没打通（指向上面 `X-Pb-Auth` 那条），200 = 鉴权正常；
3. 看「存档字段完整性」是否报缺字段：缺 = 集合结构漂移（本次修复能治，重启 PocketBase 即补齐）；
   字段齐全但前端仍是空进度 = 不是字段问题，要往鉴权 / 网关方向查；
4. 把生产 `player_progress` 集合的字段清单与钩子 DEFS
   （`templates/pb_hooks/shorthand_crud.pb.js` 顶部）对一遍，缺字段由钩子补齐即可，不写记录。

**未在生产验证**：生产实例的集合结构与重启时机需要登服务器确认（见第七节；本轮部署已挂起）。

## 五、自测结果（本地实测）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `npx tsc -b` | 通过，无错误 |
| 单元/内容测试 | `npx vitest run` | 22 个测试文件、625 条用例全部通过 |
| 生产构建 | `npx vite build --base=/mes/` | 通过，产物 `dist/`，`dist/index.html` 引用 `/mes/assets/index-*.js` |
| 部署脚本 | 本地假站点（静态服务 + 401 的 `/__pb/api/`） | 备份 → 部署 → 验证 → **失败自动回滚** 均按预期执行，退出码正确 |
| 备份保留策略 | 本地造 5 份策略内备份 + 2 份非策略历史备份 | 只保留 3 份、逐次删最旧；无 marker 的历史备份原样保留 |

新增测试：`src/game/__tests__/careerPrep.test.ts`（15 条）、`src/content/__tests__/career-quality.test.ts`（10 条）。

**2026-10-30 复跑（HEAD = `684bcaf`，即本轮 VACUUM 修复 + 文档更新两次提交之后）**：`npx tsc -b` 通过；
`npx vitest run` 22 个测试文件、625 条用例全部通过；
`VITE_MES_SELF_HOSTED_AUTH=true npx vite build --base=/mes/` 通过，产物入口 `/mes/assets/index-fK4qGjST.js`
——与目标机当前正在对外服务的构建产物哈希完全一致，说明线上前端与仓库当前源码同源
（本轮两次提交只动了部署脚本与说明文档，不影响前端产物）。

## 六、部署与备份保留策略

> **部署已挂起（2026-10-29，按 Muse 审核意见 + 刘先生澄清）**
>
> 现网 MES 生产实际跑在**两台 QwenPaw** 上（由喵喵运维、经香港网关对外），不是公网 SSH 部署。
> 而 **47.122.104.160（阿里云杭州，Tailscale 节点 aliyun 100.92.168.11）是刘先生自用的代理服务器**，
> 用途是「GitHub 连不上时走代理出网」（刘先生 2026-10-29 澄清）：
>
> - 它**不是 MES 生产机，也不是预演机**，**不得当作部署目标**，不得在上面落地站点、nginx 配置、
>   备份目录或任何项目文件；
> - 在刘先生说明现网两台 QwenPaw 各自的接入方式、以及他希望更新的目标环境之前：
>   **不执行任何生产部署；不连接、不改动 47.122.104.160；不在其上落地任何文件**；
> - 需要访问 GitHub 等外网时，可以把这台机器**仅作为代理出口**使用（凭据只在运行时用，不落盘、
>   不入库、不写进文档）；
> - 本节脚本照旧保留在分支里，作为**可执行的现成工具**，只做到「脚本就绪 + 自测通过 + 文档写清用法」；
> - 将来真要部署时，认证方式按新规矩走：由本任务**现生成一次性临时 SSH 密钥对**
>   （工具已就绪：`deploy/make-ephemeral-key.sh`），只把公钥交给刘先生去目标机追加，用完撤销；
>   **不接受、不索取、不使用任何既有私钥文件**，私钥不外放。
>
> 本轮已做的自测都在本地假站点与本地 PocketBase 上完成，**没有连接生产、没有写入任何生产数据**。

### 6.1 脚本

| 脚本 | 作用 |
| --- | --- |
| `deploy/mes-deploy.sh` | 备份现网（源码 + nginx 配置 + 存档数据本体）→ 部署产物 → 校验站点与进度不变量 → 失败自动回滚；另有 `--rollback <备份目录>` 手动回滚模式 |
| `deploy/backup-retention.sh` | 备份保留策略：总数超过 KEEP 份时删除最早一份；删除前逐份核对是否含存档数据快照 |
| `deploy/progress-guard.mjs` | 学习进度不变量校验工具：只读快照 `player_progress` 并逐条比对，不经 API、不需要超级用户口令、不产生任何写操作 |
| `deploy/make-ephemeral-key.sh` | 生成/撤销**一次性临时 SSH 密钥对**：只输出公钥，私钥留在本机不外放，用完 `--revoke` 删除 |

**备份内容**：`mes-backup-YYYYmmdd-HHMMSS/` 目录下包含
- `app/`：项目目录快照（前端产物 + 钩子 + 执行器）；
- `nginx/`：nginx 配置副本（含 sites-available 单独副本，便于比对 `/qq/` 等 location 未被改动）；
- `data/`：**存档数据本体** —— 用 SQLite 的 `VACUUM INTO` 生成的 `data.db` 一致性快照
  （可以在 PocketBase 运行中安全执行，不会拿到半写状态），以及 auxiliary.db 等辅助文件；
- `progress-before.json` / `progress-after.json`：部署前后的进度逐条快照（校验用）；
- `MANIFEST.txt`（时间戳、各路径来源）与 `.policy-marker`（标记本策略产出）。

**保留策略判定口径**（用户要求「项目与配置同一判定」「不动历史备份」「删除前必须逐份核对含存档数据」）：
- 只统计目录名形如 `mes-backup-*` **且**含 `.policy-marker` 的备份；
- 项目备份与 nginx 配置备份在同一个目录、共用同一前缀与同一保留数，因此不会出现只清一半；
- 超出上限时按目录名时间戳升序，从最旧开始找第一份「含存档数据快照（`data/data.db`）且可安全删除」的备份删掉，
  直到磁盘上的本策略备份回到上限内；
- **不含存档数据快照的备份一律不删**（宁可多留，也不误删仅有的存档数据副本）；
- **绝不删除当前生产正在使用的数据目录**本身或其内部文件；脚本还会自我保护：
  若备份根目录落在生产数据目录内，直接拒绝执行；
- 不符合命名或没有 marker 的历史备份**一律不动**；
- 支持 `DRY_RUN=1` 演练；脚本可重复执行（幂等）。

**部署脚本流程**（每一步都有日志）：
1. 备份：项目目录 + nginx 配置 + **存档数据本体（`VACUUM INTO` 一致性快照）** → 时间戳目录，并写 marker；
2. 进度基线：只读快照 `player_progress` 全部记录的关键字段（进度、已完成题目、复习队列、
   术语掌握度、学习天数、各模块答题历史、账号无关的存档标识）→ `progress-before.json`；
3. 部署：前端产物同步到 `pb_public`，钩子同步到 `pb_hooks`，执行器同步到 `server` 目录；
   **整个部署过程不写 `player_progress` 集合的任何一行**，也不做任何 DROP/TRUNCATE；
4. 保留策略：调用 `backup-retention.sh`（KEEP 默认 3）；
5. 校验站点：首页 HTTP 200 → 入口脚本可加载 → 关键内容 JSON（levels / terms / career-prep）可取 →
   `/__pb/api/player_progress` 返回 401（说明路由活着、需要登录，属预期）；
6. 校验进度不变量：再次只读快照 → 与基线逐条比对，任何一条记录的字段被改动或消失即判定部署失败；
7. 任一校验失败 → **自动回滚**：还原前端产物 / 钩子 / 执行器 / nginx 配置副本，
   还原存档数据（配置了 `POCKETBASE_STOP_CMD` / `POCKETBASE_START_CMD` 时停服覆盖 `data.db`；
   未配置时不擅自停服，把还原文件放到 `data.db.rollback-<时间戳>` 并给出人工步骤），
   最后以非零码退出，不带故障上线。

**不触碰的东西**：脚本不启用 Tailscale SSH，不改动 `/qq/` 讨论站，不重启 nginx 之外的无关服务，
不改生产数据与存档数据；nginx 配置只做备份副本，不自动改写。

### 6.2 上线时需要刘先生确认/提供的事项（当前缺口）

**先说清定位**（刘先生 2026-10-29 澄清）：**47.122.104.160 是他自用的代理服务器**，用途是
「GitHub 连不上时走代理出网」，**不是 MES 生产机、不是预演机、不得作为部署目标**。
现网是两台 QwenPaw（喵喵运维）。所以「部署目标」这一项现在是**待刘先生指定**，而不是「部署到 aliyun」：
可能是「在 QwenPaw 机内由智能体执行更新」，也可能是「刘先生 / 喵喵在机内手动执行脚本」，
也可能是另指一台机器 —— 这三种做法对应的参数与复核项不同，见 6.3。

**其次需要这些信息（都是「要问刘先生本人」的项，本轮不猜、不代填）**：

1. **部署执行方式与认证**（将来执行时）：
   - 由本任务现生成一次性临时 SSH 密钥对 → 只把**公钥**给刘先生，请他在目标机 `~/.ssh/authorized_keys` 追加 →
     部署完 `--revoke` 撤销并请他删掉那一行；
   - 或由刘先生 / 喵喵在机器内直接执行 `deploy/mes-deploy.sh` 并回传输出。
   - 明确不接受、不索取、不使用任何既有私钥文件。
2. **现网入口 Basic Auth 门禁口令**（账号是 `monika`，**口令必须向刘先生本人索取**）——
   用于部署后验证 `/mes/` 首页与资源是否正常；本仓库、脚本、文档里都不写口令。
3. **生产 PocketBase 的启停命令**（例如 `systemctl stop pocketbase`）→ 填进 `POCKETBASE_STOP_CMD` /
   `POCKETBASE_START_CMD`，回滚才能自动还原存档数据；留空则回滚只给人工步骤。
4. **服务器上的真实目录与 nginx 站点配置**（`DEPLOY.md` 是权威，需要现场核实），
   尤其是 PocketBase 数据目录（`DATA_DIR`）—— 进度不变量校验与数据备份都指向它。

本机侧的已知缺口（与部署目标无关，属于推送/访问通道）：

- **沙箱出口到 `github.com` / `api.github.com` 一律 403**（代理 MITM 拦截），
  本地克隆只能走 `ghfast.top` / `gh-proxy.com` 镜像；这直接影响推送（见第十一节）。
- 本环境**没有可用的 GitHub 凭据**：`GH_TOKEN` 无效、无凭据助手（credential.helper 未配置）、
  `~/.ssh` 下没有私钥。按规矩不向刘先生索取私钥，只缺「GitHub 推送凭据」这一项。

将来真在目标机执行时，命令形态如下（占位路径需按现场实际替换）：

```bash
# 在服务器上执行（产物与脚本需先上传到服务器）
BACKUP_ROOT=/var/backups/mes KEEP=3 APP_DIR=<mes 项目目录> \
PB_PUBLIC_DIR=<mes 项目目录>/pb_public PB_HOOKS_DIR=<mes 项目目录>/pb_hooks \
SERVER_DIR=<mes 项目目录>/server NGINX_CONF_DIR=/etc/nginx \
DATA_DIR=<mes 项目目录>/pb_data \
SITE_URL=https://mes.nya.je SITE_PREFIX=/mes \
POCKETBASE_STOP_CMD="systemctl stop pocketbase" POCKETBASE_START_CMD="systemctl start pocketbase" \
bash deploy/mes-deploy.sh --dist <上传后的 dist 目录> --hooks templates/pb_hooks --server server
```

保留策略也可以挂成计划任务（每天一次即可，脚本幂等）：

```cron
30 4 * * * BACKUP_ROOT=/var/backups/mes KEEP=3 DATA_DIR=<mes 项目目录>/pb_data /opt/mes/deploy/backup-retention.sh >> /var/log/mes-backup-retention.log 2>&1
```

### 6.3 目标环境确定后，脚本必须复核的项（QwenPaw 生产环境适配清单）

脚本本身不绑定任何机器：路径、地址、端口全走环境变量，**换目标环境通常只改参数、不改脚本**。
但目标环境一旦从「假站点」变成「QwenPaw 机内生产环境」，下面每一项都要在部署前逐条核实：

| # | 复核项 | 为什么必须先确认 | 落到哪个参数 / 动作 |
| --- | --- | --- | --- |
| 1 | **nginx 站点配置在哪、由谁管** | 现网由喵喵运维，nginx 可能不在 `/etc/nginx`，也可能由网关统一托管；本脚本只备份不自动改写，位置错了就备份不到 | `NGINX_CONF_DIR`；确认后只做备份副本比对，不动 `/qq/` 等既有 location |
| 2 | **PocketBase 在哪、怎么起停** | 两台 QwenPaw 互为备份，可能是 systemd、可能是容器、可能是机内脚本拉起；没有停服能力就无法在回滚时安全还原 `data.db` | `POCKETBASE_STOP_CMD` / `POCKETBASE_START_CMD` / `POCKETBASE_RESTART_CMD`（留空则回滚只给人工步骤） |
| 3 | **项目与产物落位** | `pb_public`（前端产物）、`pb_hooks`（钩子）、`server`（执行器）三处的真实路径 | `PB_PUBLIC_DIR` / `PB_HOOKS_DIR` / `SERVER_DIR` / `APP_DIR` |
| 4 | **路径前缀与构建 base 是否仍一致** | 现网挂在 `/mes`；构建必须 `--base=/mes/`，且 `src/lib/pb.ts` 会在运行时从入口脚本地址推导前缀，两者不一致就白屏 / 接口 404 | 构建用 `npx vite build --base=/mes/`；部署后校验首页与入口脚本 |
| 5 | **存档数据存放形态** | `player_progress` 在哪个 PocketBase 实例的哪个数据目录、两台机器的存档是否同步、备份要落在哪台 | `DATA_DIR`（进度不变量校验与数据备份都指向它）；两台都要更新时需确认顺序与停机窗口 |
| 6 | **备份目录位置与磁盘容量** | 备份含 `data.db` 一致性快照与项目快照，体积比纯代码备份大；生产盘空间要留够 | `BACKUP_ROOT`；保留策略仍按 `KEEP=3` 执行 |
| 7 | **执行方式与权限** | 现网由智能体在机内操作，可能是「机内 agent 执行脚本」而非 SSH；也可能由刘先生 / 喵喵手动执行 | 两种都支持：SSH 走一次性临时密钥；机内执行则上传 `dist/`、钩子与脚本后直接跑 `deploy/mes-deploy.sh` |
| 8 | **机器上的依赖** | 脚本用到 `bash`、`tar`、`curl`、`node`（需带 `node:sqlite`，Node ≥ 22.5） | 部署前在目标机跑一遍 `node -e "require('node:sqlite')"` 与 `bash -n deploy/mes-deploy.sh` |
| 9 | **Basic Auth 门禁** | 现网入口有 Basic Auth（账号 `monika`），部署后验证要口令 | 向刘先生本人索取口令，不入库、不入文档 |
| 10 | **回滚窗口** | 回滚要还原 `data.db` 并重启 PocketBase，需要一个可接受的停服窗口 | 提前与喵喵/刘先生约定窗口与通知方式 |

> 在这些项确认之前，脚本只保持「就绪 + 自测通过 + 用法写清」的状态，**不执行任何部署**。

## 七、学习进度数据保护

本节按刘先生的要求单列：进度是他在用的真实数据，部署前后必须原样保留。

### 7.1 进度数据存放位置与形态

| 项 | 位置 / 形态 |
| --- | --- |
| 存档本体 | 生产 PocketBase 的数据目录（部署参数 `DATA_DIR`，通常是项目目录下的 `pb_data`），核心是 SQLite 文件 `data.db`，另有 `auxiliary.db` 等辅助文件 |
| 进度集合 | `player_progress`：一条记录 = 一份存档。字段：`chapter_status`（各章节完成情况与得分）、`gauges`（能力值）、`review_queue`（复习队列）、`term_mastery`（术语掌握度）、`review_state`、`study_days`（学习天数）、`interview_history` / `factory_history` / `ops_history` / `db_history` / `career_history`（各模块答题历史）、`last_route`，以及系统字段 `created` / `updated` |
| 账号 | `mes_users` 集合里的唯一私有账号（由 `MES_APP_LOGIN_EMAIL` / `MES_APP_LOGIN_PASSWORD` 在首次启动时创建）；登录态 token 存在浏览器 localStorage，按 app 与部署前缀隔离，不随部署迁移 |
| 不由本次部署触碰 | `_superusers` / `users` 等 PocketBase 自身表、nginx 配置里的 `/qq/` 讨论站配置、mihomo-cx 与 scrcpy-mcp 桥 |

### 7.2 备份与回滚如何覆盖它

- **备份**：`mes-backup-<时间戳>/data/data.db` 是用 SQLite `VACUUM INTO` 生成的一致性快照
  （PocketBase 运行中执行也安全，不会拿到半写状态），另有 `auxiliary.db` 与
  `progress-before.json`（部署前的逐条进度基线）。
- **回滚**：`deploy/mes-deploy.sh --rollback <备份目录>` 可把项目、nginx 配置与存档数据一并还原；
  配置 `POCKETBASE_STOP_CMD` / `POCKETBASE_START_CMD` 时会停服 → 覆盖 `data.db` → 清掉残留的
  `-wal` / `-shm` → 启动；未配置时不擅自停服，改为把还原文件放到
  `data.db.rollback-<时间戳>` 并打印人工还原命令（宁可多一步人工，也不在线上写坏正在使用的库）。
- **保留策略**：备份必须含 `data/data.db` 才可能被删除；没有存档数据快照的备份一律保留；
  生产数据目录本身以及落在它内部的路径都被脚本自我保护，绝不删除。

### 7.3 增量兼容策略（只加不删）

1. **补字段是纯结构升级**：钩子发现 `player_progress` 已存在但缺少新字段时，只把字段加进集合结构
   并保存，**不写任何一条记录**；老记录上的新字段保持空值，不会被写入默认值覆盖历史进度
   （已用真实 PocketBase 0.40.6 实测，见 7.4①）。
2. **写入端逐字段容错**：某个字段缺失时跳过该字段并在响应里回报 `skipped_fields`，
   而不是让整次存档写入失败。
3. **不做破坏性操作**：部署流程不 DROP / TRUNCATE 任何集合、不清空表、不重置任何进度字段；
   集合已存在时同样要做兼容性检查（补字段），而不是跳过。
4. **读取顺序防呆**：存档列表默认按 `updated` 倒序（最近玩过的那条排最前），
   避免新建的空记录排在最前、让刘先生看到一片空白的进度。

### 7.4 进度不变量的验证方法与实际结果

**方法**：`deploy/progress-guard.mjs` 只读打开 `data.db`（不经 API、不需要超级用户口令、不产生任何写操作），
把 `player_progress` 每条记录的 12 个关键字段做快照与哈希；部署前后各快照一次并逐条比对，
差异会精确到「哪条记录的哪个字段 从什么值变成什么值」，比对不通过即以非零码判失败。

**本地等价验证的实际结果**（用真实 PocketBase 0.40.6 搭出「老实例」复现，含一条真实结构的进度记录）：

| 验证项 | 结果 |
| --- | --- |
| ① 老实例集合缺字段 → 装上本次钩子并重启 | 钩子自动补齐字段；老记录的 `chapter_status` / `gauges` / `review_queue` / `term_mastery` / `study_days` / `last_route` **逐字节一致**；新增字段为空值；`created` / `updated` 未变 |
| ② 只 PATCH 新字段（`career_history`） | 写入成功，老字段仍逐字节一致（`skipped_fields` 为空） |
| ③ 人为篡改基线（清空 `chapter_status` / `study_days`） | 比对立刻报出字段级差异并以退出码 1 判失败 → 部署流程据此自动回滚 |
| ④ 部署脚本演练（备份 → 部署 → 校验 → 回滚） | 备份内含 `data/data.db` 与 `progress-before.json`；进度不变量校验通过；故意让站点校验失败时自动回滚，**线上数据目录未被清空**、存档记录原样保留；随后 `--rollback` 手动回滚并配置停服命令后，`data.db` 被还原成备份版本，进度回到原值 |
| ⑤ 保留策略演练 | 5 份策略内备份（含 1 份故意不放存档数据快照）+ 2 份非策略历史备份 → 最终保留 3 份策略备份、逐次删最旧、**无存档数据快照的那份被跳过保留**、2 份历史备份原样未动 |

**生产上的执行方式与结果**：待拿到服务器凭据后按同一套流程执行（备份 → 部署 → 站点校验 →
进度不变量校验 → 失败即回滚），实际结果会回填到本节；在拿到凭据之前，生产上的进度未被本轮任何操作触碰
（本次全部工作都在本地开发环境完成，没有连接生产、没有写入任何生产数据）。

### 7.5 已知风险与遗留项

- 生产实例的 PocketBase 版本与 `player_progress` 集合结构需现场核对；本次等价验证用的是
  PocketBase 0.40.6，与 `DEPLOY.md` 要求的 0.40.x 一致，但生产实例若为更早的小版本，字段补齐的行为需再确认一次。
- 钩子补字段需要 PocketBase 加载新钩子才生效：部署脚本的 `POCKETBASE_RESTART_CMD` 可选执行，
  且脚本保证「先备份（含存档数据）→ 再部署 → 再重启 → 重启后立刻复核进度不变量」，符合要求。
- `POCKETBASE_STOP_CMD` / `POCKETBASE_START_CMD` 需要按服务器上 PocketBase 的实际启停方式填写
  （systemd？脚本？），否则回滚时不会自动覆盖数据库，只会给出人工还原步骤。
- 前端在存档列表返回 0 条时会新建一条默认存档（既有行为，不在本次改动范围）。这本身不会破坏老数据，
  但若集合被意外清空会产生新记录；本次通过不变量校验把这类情况变成「可发现」：比对结果里的
  `added` 字段会列出新增记录，部署流程会打印出来供人工确认。
- 验证老存档在前端正常载入，需要用刘先生的账号登录后实际看一眼（只读浏览即可，不写入）。
  这一项同样要等生产凭据到位后完成。
- 本轮没有在生产数据上做任何破坏性测试；如后续需要写入验证，只用独立的测试账号/测试记录，
  验证后立即清理，不与刘先生的真实进度混在一起。

## 八、未能核对与未完成的部分（如实说明）

1. **生产部署未执行（按 Muse 意见 + 刘先生澄清主动挂起）**：现网是两台 QwenPaw（喵喵运维）；
   **47.122.104.160 是刘先生自用的代理服务器（非生产机、非预演机、非部署目标）**，本轮
   **没有连接也没有改动它**，没有在其上落地任何文件。部署目标待刘先生指定（见 6.2 / 6.3）。
   脚本本身在本地假站点 + 本地 PocketBase 环境跑通了备份 / 部署 / 校验 / 回滚全流程，
   但没有在真实目标环境上验证过目录结构、nginx 配置路径与 PocketBase 进程管理方式。
2. **「存档读不出来」的根因仍未最终定位**：Muse 文档记载喵喵查实生产机内全绿、10-27 仍有写入，
   根因未定位。本次修复的是「集合缺字段 → 写整次失败 / 读回落默认值」这一支；
   鉴权头（`X-Pb-Auth` vs `Authorization`）那条尚未排除，需要在生产机上只读验证（清单见 4.2）。
3. **存档修复与进度保护未在生产验证**：钩子改动需要 PocketBase 加载新钩子（重启）才会补齐老集合的
   缺失字段；验证方式：重启后用 `progress-guard.mjs snapshot` 看 `player_progress` 集合是否已含
   `career_history` 字段，再比对部署前后逐条快照一致，最后用刘先生账号登录前端确认看到的是原进度。
4. **today-dev 未推送成功**：推送授权已到位（仅 `today-dev` 一支），但本环境缺 GitHub 推送凭据，
   且出口到 `github.com` / `api.github.com` 被代理拦截（403）。具体缺什么、怎么补，见第十一节。
   main、wabi-dev 全程未动，未打 tag。
5. **Muse 文档里提到的「门禁口令」需要向刘先生本人索取**：现网 Basic Auth 账号是 `monika`，
   口令文档里明确写了不外发、需本人提供；本轮未猜测、未写入任何文件。

## 九、后续步骤（按刘先生的确认推进）

1. **先定部署目标与接入方式**（47.122.104.160 只是代理出口，不是部署目标）：请刘先生说明
   现网两台 QwenPaw 各自如何接入与操作（谁执行、怎么执行）、希望更新的目标环境是哪台或哪种形态；
   拿到后按 6.3 的清单逐条复核再动手。
2. **再补齐执行要素**：Basic Auth 门禁口令（monika）、生产 PocketBase 启停命令、服务器真实目录与
   nginx 配置（`DEPLOY.md` 为权威）。
3. **按现场方式执行部署**：本任务现生成一次性临时 SSH 密钥对（只用公钥、用完撤销），
   或由刘先生 / 喵喵在机内执行 `deploy/mes-deploy.sh` 并回传输出；
   执行时务必带上 `DATA_DIR`（进度不变量校验与数据备份都指向它）。
4. **验证**：备份目录含 `data/data.db` 与 `progress-before.json` → 校验 `/mes/` 首页、入口脚本、
   `/mes/career-prep`、数据库实操营判分链路（跑一题 `db-c5` 或 `db-r5`）→
   `progress-after.json` 与基线逐条一致 → 用刘先生账号登录前端确认看到的是原进度；
   异常按脚本回滚（回滚可一并还原存档数据）。
5. **推送**：拿到 GitHub 推送凭据后只推 `origin/today-dev`（不推 main、不推 wabi-dev、不打 tag、
   不 force push）；推送前再跑一次 `npx tsc -b`、`npx vitest run`、`npx vite build --base=/mes/`。
6. **存档读不出的根因**：按 4.2 的只读排查清单在生产机上定位，确认后同步给刘先生与喵喵。

## 十、与 Muse 交接文档的逐条对齐结果

对照的是 Muse 转交的《MES 信息文档》（2026-10-29，直接提供原件，不再需要 Koofr 应用密码）。
「一致」= 今天的实现本来就符合；「已修正」= 原来不一致、按文档改了。

| 文档条目 | 文档要求 | 今天的实现 | 对齐结果 |
| --- | --- | --- | --- |
| §1 技术栈 | React 19 + TS + Vite + Tailwind v3 + shadcn/ui；后端 PocketBase；执行器 Node（mysql2/pg/mssql/ssh2/node:sqlite） | 一致；today-dev 未引入新依赖 | 一致 |
| §1 内容规模 | 以 main@b5c8335 的 README 为准 | README 数字已过期（写 34 张术语卡 / 320 题 / 595 测试，实际基线 37 张术语卡）。本轮按 today-dev 实测数字更新：术语 70、面试 93 题、厂型 33 题、关卡 202 题、实习准备营 40 题、数据库 20 任务、测试 625 | 已修正（README） |
| §1 内容格式规范 | 新增/修改题目先读 `docs/content-format.md`（红线扫描规则也在里面） | 已读并据此核对：面试题库走 `interview-quality.test.ts`、数据库实操营走 `db-quality.test.ts`（本次新增 4 题的 `check.expect` 由 `server/backfill-db-expect.mjs` 对真实练习库算出） | 一致（并修了一个工具 bug，见下） |
| §2 基线确认 | 开工前必须向刘先生确认以哪条分支为基线；不擅自合 wabi-dev，不把演示版改动带进 main | 基线 `wabi-dev`@bed9246（刘先生已确认）；未合并 main，未改 main，未带演示版改动进 main | 一致 |
| §3 现网形态 | 生产跑在两台 QwenPaw，由喵喵运维，today 不要动生产环境，只改代码 | 本轮**没有连接也没有改动任何生产机器**；原「47.122.104.160 生产部署」的前提已作废，部署挂起 | 已修正（本轮认知与文档一致） |
| §3 部署细节 | 以仓库 `DEPLOY.md` 为权威 | 脚本按 `DEPLOY.md` 的目录布局写（pb_public / pb_hooks / server），并额外新增 `DATA_DIR` 以便备份存档数据本体 | 一致（补充，未改 DEPLOY.md） |
| §3 门禁 | Basic Auth 账号 monika，密码向刘先生索取 | 未猜测、未写入任何文件；已在 6.2 / 八 / 九 三处列为「需刘先生本人提供」 | 一致（待刘先生提供） |
| §4 构建硬规矩 | 子路径必须 `npx vite build --base=/mes/`；`vite.config.ts` 不要整体重写，`rhSourcePlugin()` 必须留在 plugins 第 0 位，改动只做局部 Edit | `vite.config.ts` 相对基线**零改动**（`git diff bed9246..HEAD -- vite.config.ts` 为空）；构建用 `--base=/mes/`，产物入口 `/mes/assets/index-<hash>.js`；未碰 `rhSourcePlugin` | 一致（已在第十一节单列，供 Muse 审） |
| §4 本地后端 | PocketBase 0.40.x + `templates/pb_hooks/*.js` 全部拷进 `pb_hooks/` + `dist/` 内容放进 `pb_public/` | 一致；本次本地验证用的正是 PocketBase 0.40.6，钩子全量拷入 `pb_hooks/`，产物放 `pb_public/` | 一致 |
| §5 红线一 | 仓库不携带任何真实存档数据 / 真实账号 | today-dev 里没有生产 `pb_data`、没有真实存档、没有账号口令；备份快照一律落在服务器侧且不进仓库；全仓 grep 确认未落盘用户给的代理串 | 一致 |
| §5 红线二 | 学习存档只有一条记录，在 `player_progress`，经简写 API 读写 | 简写 API 的读写路径保持不变；本次只加「只加不删」的字段补齐与逐字段容错 | 一致 |
| §5 未结案问题 | 「存档读不出来」根因未定位；重点看 `src/lib/pb.ts` 与 `shorthand_crud.pb.js`，把发现同步给刘先生 | 已逐条看过 `src/lib/pb.ts`（含 `X-Pb-Auth` 头与 `isDirectPbHost` 的判定）与 `shorthand_crud.pb.js`；本次修复治的是「集合缺字段」这一支；鉴权那条尚未排除，已写进 4.2 的只读排查清单 | 部分对齐（根因仍未最终定位，已如实标注） |
| §6 协作流程 | 建议开自己的分支；改动清单 + 构建/测试结果交刘先生确认；**刘先生确认后才推 main** | 分支是 `today-dev`；本说明文档即改动清单；测试结果见第五节；推送只涉及 `today-dev`，不推 main | 一致 |
| §6 红线三 | 不提交真实密码/密钥/生产 IP/基础设施细节/生产数据；需要配置值用占位符或环境变量 | 部署脚本全部用环境变量，无凭据；一次性临时密钥工具只输出公钥；本说明中出现的机器信息仅限任务书已提供且不新增秘密 | 一致（但见下方「需注意」） |
| §7 路线图 | 第五章质量与库存、第六章上线陪产、自由沙盘、登录注册 + 精简后台 | 本轮**未做**（不在本次任务范围）；README 路线图保持原样 | 一致（未做，非不一致） |

**对齐中实际做的修正（本轮新增改动）**

1. `docs/content-format.md`：新增「知识点映射表（knowledge_id）」一节（K0~K11，含本次新增的 K9 实施与交付 /
   K10 产线现场信息化 / K11 通用底座，说明编号只增不改）；新增「实习准备营（public/content/career-prep/）」
   一节（文件结构、字段说明、红线清单与把关测试），让新模块的内容格式进规范，而不是只存在于代码里。
2. `README.md`：把过期的规模数字更新为实测值（术语 34→70、面试 85→93 题、数据库 16→20 任务、
   测试 595→625、题库 320→368），并补「实习准备营」玩法条目。
3. `server/backfill-db-expect.mjs`：修了工具的一个真 bug —— `node:sqlite` 的 `prepare()` 只执行多语句 SQL 的
   **第一条**，导致多语句参考答案（如 clean 组「改引用 → 删主数据 → 验干净」）在 state 模式下被误判为
   「正确答案下断言不成立」。改用 `exec()` 执行 DDL/DML、结果模式改为「执行 answerSql 后重跑 check.sql 比对」。
   修完后脚本对全部 20 个任务输出 `problems: []`、4 个 state 任务全部 verified，且 4 个新增任务的
   `check.expect` 与脚本输出逐字节一致（内容文件零改动）。
4. `src/pages/Debug/useDebug.ts`：新增**只读**的「存档字段完整性」体检项（12 个存档字段有没有读成 null），
   用于在生产机上区分「集合字段缺失」与「鉴权/网关问题」两类根因。
5. `deploy/make-ephemeral-key.sh`：新增一次性临时 SSH 密钥对工具（只出公钥、私钥本机留存、`--revoke` 撤销），
   对应「将来部署的认证方式由本任务现生成、用完撤销、不使用既有私钥」这条新规矩。

**需要刘先生留意的两点**

- 文档 §6 红线三提到「不提交生产 IP / 基础设施细节」。本分支的说明文档里出现了任务书已提供的机器信息
  （47.122.104.160、Tailscale 节点名、现网是两台 QwenPaw）—— 这些是刘先生自己提供的背景信息，
  但仓库是公开仓库。按刘先生 2026-10-29 的指示，第 6 节按原样写明
  「47.122.104.160 为代理服务器、非部署目标」；**若之后要脱敏**，改动点集中在第 6 节与第二节表格，
  把具体 IP / 节点名换成「代理出口（IP 见任务书）」即可，其余逻辑不变。
- 文档里提到的「门禁口令」：本仓库的实现**不需要**任何门禁口令（现网 Basic Auth 是入口层的，
  与前端代码无关）；只有将来做生产验证时需要它来访问站点，需要向刘先生本人索取。

## 十一、供 Muse 审阅的 diff 摘要

**审阅范围**：`today-dev` 相对 `wabi-dev`@bed9246 的全部改动（Muse 文档要求的「完整 diff」
另附为补丁文件 `today-dev-vs-wabi-dev.diff`，随本说明一起交付）。

**提交序列**（`git log --oneline bed9246..today-dev`）：

| 提交 | 内容 |
| --- | --- |
| `cf5a12b` | 新增实习准备营（方向1 / 方向4 / 通用底座）；扩充术语库 33 条、数据库实操营 4 题、面试题库 8 题；修复存档写入链路 |
| `31bf7ed` | 补充 today-dev 开发说明 |
| `33a7d9c` | 学习进度数据保护（存档数据备份 + 进度不变量校验 + 增量兼容） |
| `9f0e579` | 与 Muse 文档逐条对齐（内容格式文档、README、回填脚本修正、/debug 只读体检项、一次性临时密钥工具、本说明的两节新增） |
| `HEAD`（本轮） | 部署目标表述改正：47.122.104.160 = 代理服务器、非部署目标；新增 6.3「目标环境确定后脚本必须复核的项」；补充代理出口用法 |
| `09ba071` | 修复 `deploy/mes-deploy.sh` 的存档一致性快照：`VACUUM INTO` 目标路径从双引号改成单引号（SQLite 把双引号当标识符，导致每次都退回复制数据文件） |
| `HEAD`（本轮） | 第十一节改为推送后现状；新增第十二节「instabox 部署实录」 |
| `5d25a7f` | 记录本轮在当前 HEAD 的自测复跑结果与前端产物一致性 |
| `6200a27` | **本轮（第二轮）**：`deploy/edge-proxy.mjs` 令牌来源改为「`x-pb-auth` 优先、`authorization` 回落」；说明文档补 12.3（裸 IP 入口会 401、推荐走域名）与 12.8（本轮改动、复测与入口哈希变化的解释）；第十一节改为「推送待凭据」现状 |

**重点一：简写 CRUD 钩子的存档修复**（`templates/pb_hooks/shorthand_crud.pb.js`）

| 位置 | 改动前 | 改动后 |
| --- | --- | --- |
| `onBootstrap` 集合已存在 | `if (existing) continue`（不再看字段结构） | 只加不删地补齐缺失字段并 `$app.save(existing)`；**不写任何一条记录** |
| `POST` / `PATCH` 写字段 | `rec.set(field, value)` 直接写，字段缺失就抛错 → 整次 400 | 逐字段 try/catch，缺字段跳过并在响应体回报 `skipped_fields` |
| 读取字段清单 | 10 个字段 | 11 个字段（补 `career_history`） |
| 列表默认排序 | `-created` | `-updated`（避免新建空记录排在最前） |

**向后兼容性论证**：补字段只改表结构，已有行的新字段为空值、不会把老字段刷成默认值；
用真实 PocketBase 0.40.6 复现老实例（只含老字段的集合 + 一条进度记录）实测：补齐后老记录 6 个进度字段
逐字节一致、`created`/`updated` 未变、新字段为空值；再只 PATCH 新字段，老字段仍逐字节一致。
完整论证与只读排查清单见第 4.2 节。

**推送状态与还缺什么**（2026-10-30 上午已推送完成，本节为推送后的现状）

- **已推送**：`today-dev` 已推到 `origin`，远端 `today-dev` = `d7b62ad`，与本地 HEAD 逐位一致。
  本轮改走 HTTPS，用的是刘先生当场给出的仓库 PAT（有 repo 写权限）：推送时它只作为本地
  `credential.helper` 凭据文件（600 权限）使用，推送结束后即删除；
  **PAT 不写入仓库任何文件、文档、bundle、diff、git 历史或日志**，本文档与交付物中也不出现。
- **本次推送的提交范围**（相对上一轮远端 `4aa4e1d` 领先的 4 个提交，fast-forward）：

  | 提交 | 内容 |
  | --- | --- |
  | `09ba071` | VACUUM INTO 目标路径改单引号（存档一致性快照修复） |
  | `684bcaf` | 第十一节改为推送后现状；新增第十二节「instabox 部署实录」 |
  | `5d25a7f` | 记录本轮在当前 HEAD 的自测复跑结果与前端产物一致性 |
  | `d7b62ad` | edge-proxy 令牌来源改为 `x-pb-auth` 优先、`authorization` 回落；补 12.3 / 12.8 文档 |

- **远端核对（推送后，在目标机直连 GitHub 只读复核）**：
  - 分支：`today-dev` = `d7b62ad81c3f660d2ab916d29712ec5304319ff3`（= 本地 HEAD，逐位一致）、
    `main` = `b5c8335`（未动）、`wabi-dev` = `bed9246`（未动），远端仍恰 3 支；
  - tag：仍是基线那 12 个 v1.x（`v1.7.0`–`v1.14.2`），名称与对象 SHA 与本地 `refs/tags`
    **逐条一致**，无新增、无缺失、无删除；
  - 本次是 fast-forward（`4aa4e1d..d7b62ad`）：**没有 force push，没有删除任何远端引用**，
    没有推 `main` / `wabi-dev`，没有打新 tag。
- **并行任务的提交**：「实施路线收尾模块建设与 AI 接入」那条线在本轮推送时**尚未**在本地
  `today-dev` 产生提交，因此本次推送只包含上表这 4 个提交；那条线完成后的提交再单独推一次 `today-dev`。
- **本节所在的这次文档提交**（把第十一节改成已推送现状）在推送 `d7b62ad` 之后紧接着推送，
  因此远端 `today-dev` 的最终状态 = 本节所在的提交；随附交付物按该最终树生成。
- **GitHub 上那条 Deploy key**：仍然没有对应私钥（不可用，也没有泄露风险）；本轮改走 HTTPS 后
  更不需要它，删留仍由刘先生定，本轮不擅自处理。
- 随附交付物（按最终树重新生成）：
  - `today-dev.bundle`（含 `today-dev` 分支全量状态，克隆后即可推送）；
  - `today-dev-vs-4aa4e1d.diff`（相对 `4aa4e1d` 的本轮改动：VACUUM 修复、文档更新、自测记录、edge-proxy 修复）；
  - `today-dev-vs-wabi-dev.diff`（相对 `wabi-dev`@bed9246 的全量 diff）。

**重点二：构建相关**

- `vite.config.ts` **零改动**（`git diff bed9246..today-dev -- vite.config.ts` 输出为空），
  `rhSourcePlugin()` 仍在 plugins 第 0 位；
- 构建命令一律 `npx vite build --base=/mes/`，产物入口为 `/mes/assets/index-<hash>.js`
  （实测 `dist/index.html` 引用形如 `/mes/assets/index-<hash>.js`）；
- 前端运行时前缀仍由 `src/lib/pb.ts` 从入口脚本地址推导（未改），PocketBase 地址自动取 `<前缀>/__pb`；
- 新增内容目录 `public/content/career-prep/`（4 个 JSON），路由 `/career-prep`（`src/App.tsx` 新增一条，
  页面走懒加载）。

**其余改动分组**

| 组 | 文件 |
| --- | --- |
| 新模块代码 | `src/content/careerPrep.ts`、`src/game/careerPrep.ts`、`src/pages/CareerPrep/*`、`src/components/career/*` |
| 新模块内容 | `public/content/career-prep/{index,direction1,direction4,base}.json` |
| 既有模块扩充 | `public/content/terms.json`（+33 条）、`public/content/db-training/{query,join,clean,report}.json`（+4 题）、`public/content/interview/{campus,intern}.json`（+8 题） |
| 既有模块修复 | `templates/pb_hooks/shorthand_crud.pb.js`、`src/content/chapters.ts`、`src/pages/Home/*`、`src/components/home/ModuleEntries.tsx`、`src/App.tsx`、`src/pages/Debug/useDebug.ts` |
| 测试 | `src/game/__tests__/careerPrep.test.ts`、`src/content/__tests__/career-quality.test.ts` |
| 部署与工具 | `deploy/mes-deploy.sh`、`deploy/backup-retention.sh`、`deploy/progress-guard.mjs`、`deploy/make-ephemeral-key.sh`、`server/backfill-db-expect.mjs` |
| 文档 | `README.md`、`docs/content-format.md`、`today-dev-开发说明.md` |

**建议的审阅命令**：

```bash
git fetch origin wabi-dev
git diff bed9246..today-dev -- templates/pb_hooks/shorthand_crud.pb.js   # 重点一
git diff bed9246..today-dev -- vite.config.ts                            # 重点二（应为空）
git diff bed9246..today-dev --stat                                        # 全量概览
```

## 十二、instabox 部署实录（2026-10-30）

本节记录本轮在目标机（Instabox 机器 `dev`）上的实际落地形态与实测结果，供后续维护与复盘。
**本节不含任何凭据**：Basic Auth 口令、应用账号口令、SSH token 均不写入文档，只保存在目标机的
`/data/mes/secrets/`（600 权限）里。

### 12.1 目录布局与 DATA_DIR

| 路径 | 用途 |
| --- | --- |
| `/data/mes/src/repo` | 只读克隆的 `today-dev` 源码（`4aa4e1d`），构建与部署脚本的来源 |
| `/data/mes/app` | 运行目录：`pocketbase` 二进制、`pb_hooks/`、`pb_public/`（前端产物）、`server/`、`pb_data/`、`lab-data/`、`edge-proxy.mjs` |
| `/data/mes/app/pb_data` | **DATA_DIR**：PocketBase 数据目录（`data.db` + `auxiliary.db*`），进度存档即在此库内 |
| `/data/mes/app/lab-data` | 数据库实操营练习库（`practice.db`）与连接凭据文件 |
| `/data/mes/backups` | 备份根目录（`mes-backup-<时间戳>/`，保留 3 份） |
| `/data/mes/secrets` | 凭据文件（`mes.env`、`credentials.txt`，均 600） |
| `/data/mes/nginx` | Basic Auth 口令文件、自签证书、已部署站点配置副本 |

`node_modules` 放在 `/data/mes/node_modules`（仓库根级），`server/` 运行时由 Node 向上解析依赖，
这样 `mes-deploy.sh` 打包 `APP_DIR` 时不会把 600M 依赖卷进每份备份。

### 12.2 端口拓扑

```
外网（平台发布端口 8080）
        │  https://<机器>.instabox.tech/mes/
        ▼
   nginx 0.0.0.0:80 / 443 / 8080     ← 对外唯一入口：Basic Auth 门禁 + /mes 前缀 + 代理
        │  proxy_pass http://127.0.0.1:8091
        ▼
   edge-proxy 127.0.0.1:8091          ← 剥掉 /mes 前缀；/mes/__pb/* 映射到 PB 根；X-Pb-Auth → Authorization
        │
        ▼
   PocketBase 127.0.0.1:8090          ← 只绑回环，不对外暴露
```

应用端口（8090 / 8091）只监听回环地址，外网不可达；对外只有 nginx 的 80/443/8080 三个端口，
且都要先过 Basic Auth。平台已发布的 8080 端口正好落到 nginx 的 8080（实测外网未认证请求返回
401 门禁页，证明命中的是 nginx 而不是应用本体）。

### 12.3 Basic Auth 与令牌传递（一个必须注意的坑）

- 口令文件：`/data/mes/nginx/.htpasswd`，属主 `root:www-data`、权限 `640`
  （必须是 www-data 组可读，600 会让 nginx worker 读不到而返回 500）。
- **坑**：nginx 的 `auth_basic` 会把客户端的 `Authorization` 头原样转发给上游，
  于是 Basic 凭据会占住 `Authorization`；而 `deploy/edge-proxy.mjs` 只在「上游没有 Authorization」
  时才用 `X-Pb-Auth` 还原 PocketBase 令牌 → 令牌被 Basic 凭据挤掉，站点登录后的接口全部 401。
  **解法（在 nginx 侧做，不需要改仓库）**：把发给上游的 `Authorization` 改写成 `X-Pb-Auth` 的值。

  ```nginx
  map $http_x_pb_auth $mes_pb_authorization {
      default $http_x_pb_auth;
      ''      '';
  }
  # location / 内
  proxy_set_header Authorization $mes_pb_authorization;
  ```

  站前端的 `src/lib/pb.ts` 已有配套逻辑：非「localhost / 裸 IP」的部署形态一律把 PB 令牌放进
  `X-Pb-Auth`（见该文件 `PB_USER_AUTH_HEADER` 与 `pb.beforeSend`），所以域名形态下这条链路是通的。

- **本轮补上的第二层保险（仓库变更）**：`deploy/edge-proxy.mjs` 原本是「上游没有 `Authorization`
  时才用 `X-Pb-Auth` 还原令牌」，也就是 `authorization` 优先。现已改为
  **「`x-pb-auth` 优先于 `authorization`」**：请求带 `X-Pb-Auth` 时直接用它覆盖 `Authorization`；
  没有该头时才回落到请求自带的 `authorization`。普通请求与 upgrade/SSE 两条路径都已改。
  这样以后换任何前置 Basic Auth 网关，即使对方像 nginx 一样把 Basic 凭据写进 `Authorization`，
  只要令牌走 `X-Pb-Auth` 就不会被挤掉。nginx 上那段 map 改写本轮**保留不动**，作为双保险。

- **入口选择：走域名，不要走裸 IP（重要）**：`src/lib/pb.ts` 的 `isDirectPbHost()` 把
  `localhost`、`[::1]` 和裸 IPv4 判为「直连 PB」形态，这时前端把 PB 令牌放进 **`Authorization`** 头。
  而裸 IP 入口上的 `auth_basic` 门禁用的也是同一个 `Authorization` 头：前端 JS 设置的请求头会覆盖
  浏览器自动附带的 Basic 凭据，nginx 收到的不是 `Basic ...` 而是 PB 令牌，于是 `auth_basic` 校验失败
  → **裸 IP 访问时前端会用 `Authorization` 传令牌、与 Basic Auth 争同一个头，站内登录会 401**。
  这不是账号密码错了，是两个用途撞了同一个头。
  **域名入口下则正常**：前端改走 `X-Pb-Auth`，Basic 凭据与 PB 令牌各走各的头，nginx 再用上面那段 map
  把发给上游的 `Authorization` 改写成 `X-Pb-Auth` 的值，PocketBase 收到的就是纯令牌。
  → 结论：**推荐路径是域名入口**；裸 IP 只在排查时临时使用，不要用于日常登录使用。

### 12.4 /workspace 软链的用途

`server/dblab.mjs` / `server/sshlab.mjs` 把练习库目录写死在 `/workspace/pocketbase-bin/lab-data`
（部署机没有 /workspace 目录时会落到临时盘）。因此建了软链
`/workspace/pocketbase-bin → /data/mes/app`：软链由 root 的一次性单元 `mes-app-prepare.service` 负责重建，
练习库与连接凭据因此真正落在 `/data` 持久盘上，重启不丢。

### 12.5 systemd 单元

| 单元 | 作用 | 关键设置 |
| --- | --- | --- |
| `mes-app-prepare.service` | root 一次性准备：建 `/workspace`、重建软链、把应用目录属主改回 `user` | `Type=oneshot`、`RemainAfterExit=yes` |
| `mes-pocketbase.service` | 跑 PocketBase | `User=user`、`EnvironmentFile=/data/mes/secrets/mes.env`、`Restart=always`、`RestartSec=3` |
| `mes-edge-proxy.service` | 跑边缘代理 | `Environment=PORT=8091 / APP_PREFIX=/mes / PB_TARGET=http://127.0.0.1:8090`、`Restart=always` |

四个单元（三个 + nginx）全部 `enabled` 且 `active`。**依赖关系注意**：`edge-proxy` 对 PocketBase
只用 `Wants=`（软依赖）而不是 `Requires=`，否则 PocketBase 一重启，edge-proxy 会被连带停掉且不会
自动回来（实测踩过：改回 Wants 后，单独重启 PocketBase 不再影响 edge-proxy）。

### 12.6 平台约束与可用性判断

Instabox 免费档的硬约束：闲置 30 分钟自动暂停（关不掉）、单次运行上限 480 分钟、进程不跨运行周期恢复。
因此这台机器做不到「永不掉线」——平台暂停期间外网 URL 一定不通。本轮能做的都做了：

- 三个 MES 单元 `enabled` + `Restart=always`：机器一恢复（保活拉起或 8 小时上限到点重启），
  nginx、PocketBase、edge-proxy 自己起来并对外服务；
- 数据全部在 `/data` 持久盘，平台停机不丢；
- 实测 `kill -9` 两个进程后，systemd 在 6 秒内重新拉起，站点与存档立即恢复正常。

### 12.7 本轮实测结论

| 项目 | 结果 |
| --- | --- |
| 外网未认证 `/mes/`、`/mes/career-prep` | 401（门禁生效） |
| 外网认证后 `/mes/`、`/mes/career-prep`、入口脚本 | 200 |
| 外网根路径 `/` | 302 跳 `/mes/` |
| 站内登录（应用账号） | 成功，取到令牌；带令牌读 `player_progress` 200、带令牌打 `dblab` 200、无令牌 401 |
| db-c5 判分 | 校验查询返回 `[[0, 0]]`，与期望一致 |
| db-r5 判分 | 返回 L2 27/165/0.1636、L1 8/60/0.1333、L4 37/497/0.0744、L3 16/299/0.0535，与期望逐值一致 |
| progress-guard 不变量 | 部署前 1 条 → 部署后 1 条，12 个受监控字段逐条一致（`changed/missing/added` 全空） |
| 备份快照 | 修复后日志出现「存档数据一致性快照完成」，备份 `data/` 下只剩单个 `data.db`（无 `-wal`/`-shm`），备份库记录数 1 且字段完整 |
| 进程被杀 | 6 秒内 systemd 拉起 |
| 磁盘 | `/data` 用 1.1–1.2 G / 20 G（约 6%） |
| 既有服务 | 机器上原有的 metabase（平台发布 3000）不受影响，外网 200 |
| 前端产物一致性 | 第一轮本地重建入口 `/mes/assets/index-fK4qGjST.js`，与当时线上在跑的前端哈希一致（线上前端 = 仓库当前源码）。**第二轮重建入口变为 `/mes/assets/index-VFvB5CNx.js`**（见 12.8：前端源码未变，是打包器版本差异） |

### 12.8 第二轮：令牌头优先级修复与复测（2026-10-30 上午）

- **改动**：`deploy/edge-proxy.mjs` 的令牌来源改为「`x-pb-auth` 优先、`authorization` 回落」，
  普通请求与 upgrade/SSE 两条路径都改了。原因与背景见 12.3；本轮按刘先生的授权直接执行，没有再等确认。
- **单元级验证**（独立脚本：起一个假上游，按三种入参组合观察上游实际收到的 `Authorization`）：

  | 入参 | 上游收到的 `Authorization` | 旧代码 | 新代码 |
  | --- | --- | --- | --- |
  | 仅 `x-pb-auth` | = `x-pb-auth` 的值 | PASS | PASS |
  | 仅 `authorization` | = `authorization` 的值（回落） | PASS | PASS |
  | 两者同时且冲突 | 期望 = `x-pb-auth` 的值 | **FAIL**（拿到 authorization） | **PASS** |

  这条用例能区分新旧行为，所以不是「改完看着像对了」。
- **部署**：目标机仓库切到 `6200a27`（4 个提交，工作区干净）→ `npx vite build --base=/mes/` 重建 →
  `deploy/mes-deploy.sh` 走「备份 → 部署 → 校验 → 失败自动回滚」（备份目录
  `/data/mes/backups/mes-backup-20261030-011807`）→ 运行时 `edge-proxy.mjs` 覆盖后重启 `mes-edge-proxy`。
  nginx 那段 `map` 改写**未动**，作为双保险保留。
- **复测**：30 项检查全部 PASS（脚本留在目标机 `/data/mes/verify_round2.sh`）。
  - nginx 门禁：未认证 `/mes/`、`/mes/career-prep` 均 401；Basic Auth 认证后两者均 200；根路径 302。
  - 站内链路：应用账号登录取到令牌；带令牌读 `player_progress` = 1 条记录；带令牌打 `dblab` = 200；
    不带令牌读 = 401。
  - **令牌头优先级实测（直连 8091）**：`authorization`（Basic 凭据）与 `x-pb-auth`（PB 令牌）同时存在
    → 200（这条正是修复前会失败的场景）；仅 `x-pb-auth` → 200；仅 `authorization` → 200；无令牌 → 401。
  - 判分：db-c5 校验查询 = `[[0, 0]]`；db-r5 四行 =
    `[["L2",27,165,0.1636],["L1",8,60,0.1333],["L4",37,497,0.0744],["L3",16,299,0.0535]]`，与期望逐值一致。
  - progress-guard：练习前后 12 个受监控字段逐条一致（`changed/missing/added` 全空），记录数 1 → 1。
  - systemd：四个单元（`mes-app-prepare`/`mes-pocketbase`/`mes-edge-proxy`/`nginx`）均 `active` + `enabled`；
    `kill -9` 两个进程后 6 秒内被 systemd 拉起，之后站点 200、站内登录可用、记录数仍 1。
  - 外网入口复测：未认证 401、认证后 200、根路径 302，线上入口脚本已是新构建 `index-VFvB5CNx.js`。
- **入口哈希从 `index-fK4qGjST.js` 变成 `index-VFvB5CNx.js`（前端源码没动）**：
  `git diff 4aa4e1d..6200a27 -- src public server templates vite.config.ts package.json pnpm-lock.yaml`
  输出为空；线上 `pb_public/content` 与仓库 `public/content` 逐文件一致；产物模块图文件集一致
  （46 个，文件名去掉哈希后完全相同），差异只在内容哈希 → 属于打包器版本差异（当前按 lock 里的
  vite 8.0.11 重建），不是功能改动。换句话说：线上前端仍等于仓库当前源码。
