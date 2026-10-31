---
title: today-dev 开发说明（异步作业通道修 502 + 练习库表结构注入 + SQL Server 方言 + metabase 清理）
summary: 本轮把模式 B 服务器题必然 502 的老问题换成「提交作业→轮询取结果」的异步通道（外层平台网关 20 秒硬截断，加长站内超时无效），实测 lx-d5 在模式 B 下 12/12 步全过、最慢一步 78 秒且全程无 502；新增练习库 8 张表真实表结构注入数据库题提示词并加漂移测试，模型生成 SQL 的臆造列名归零；练习库导出补 SQL Server 方言与灌库分支（容器 E2E 因磁盘余量不足主动暂缓）；按授权删除 metabase（先备份卷内数据），根分区可用空间 2.6GB→5.1GB。单测 34 文件 723 用例全过，已推 today-dev。
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
| `6091d8b` | 第十一节改为已推送现状；追加上一轮推送记录 |
| `0e5a34b` | **本轮**：新增「上线陪产 · 交付闭环」模块（实施路线第 6 章）并接入 tokenrhythm.studio 文本大模型 |
| `ff2352e` | 部署校验清单补上 `content/delivery/index.json` |
| `cb9feb1` | PocketBase 路由看不到文件顶层函数 → 环境变量辅助函数移入路由处理器作用域 |
| `4dc4b8c` | `llm.pb.js` 自带 `requireMesUser`，不再依赖别的 hook 文件的加载顺序 |
| `cf503d1` | 存档读写白名单放行 `delivery_history` / `delivery_workspace` |
| `7827c95` | 文档第十三节：交付闭环模块 + AI 接入的部署与验证记录 |
| `0a06c0b` | **本轮**：站内登录标识改为自定义账号名，登录框不再强制邮箱格式 |
| `55491cf` | 修掉沙盘页未使用导入与登录入口测试选择器（`npx tsc -b` 由报错转干净） |
| `81f2268` | 为数据库/运维实操营 40 道题各生成一份独立文档（`public/content/labs/<id>.md`），题目 JSON 增加 `doc` 字段，一一对应校验脚本 |
| `f5d68f8` | 新增 7 道小型排障题与 1 道 10 阶段综合题，文档扩到 48 份 |
| `0501b86` | 打通「AI 读文档 → 生成环境准备/执行脚本 → 预览 → 执行 → 按既有 accept 正则判分」链路；连接表单加演练环境提示语 |
| `2209efb` | 修掉连接保存按钮重复属性、验收正则比对展开方式与危险命令判定遗漏 |
| `edf3b66` | 数据库题的 AI 脚本限定为纯 SQL、服务器题限定为单条 shell 命令 |
| `d95a34e` | 修掉实操通道的中文乱码与中文字面量比不上两个缺陷 |
| `e7fb218` | UTF-8 解码 helper 提到文件顶层 |
| `97b3965` | 每个路由处理器各带一份 UTF-8 解码 helper（PocketBase 路由作用域隔离） |
| `1c92570` | 步骤断言先剥掉 sudo / env / timeout 等命令包装再判定（模型给的命令常带 sudo 前缀，会被误判为不达标） |
| `a620868` | **本轮**：实操营的两种并列演练环境模式（我的远程环境 / 站点一次性 Docker 演练环境）+ 服务端 `server/labenv.mjs` + `pb_hooks` 的 `/api/labenv/*` 路由 |
| `37973f3` | 服务器题的 AI 脚本不再生成 ssh / scp 远端包装 |
| `db07fa9` | 模式 B 灌练习库数据加重试（MySQL 初始化临时实例会断连） |
| `af628cf` | 修掉 `labenv.mjs` 里未定义的 `step` 变量（模式 B 建容器必失败） |
| `08562a6` | 允许在确有需要时使用 sudo 前缀（模式 B 容器里非 root 账号要建目录） |
| `8559e73` | 模式 B 的 sshd 容器给演练账号免密 sudo |
| `a6ed608` | 免密 sudo 的写入挪到容器就绪之后（镜像初始化会重建 sudoers） |
| `b95a87f` | 模式 B 的 sshd 容器预建 `/data/archive` 并交接给演练账号 |
| `f5b184b` | 免密 sudo 同时写进 `/etc/sudoers`（镜像的 sudoers 未必 include `sudoers.d`） |
| `42e23c7` | 每份题目文档补「两种演练环境模式下的准备要求」一节（48 份全部重生成） |
| `fe1a46c` | 模式 B 的数据库容器就绪后灌入站内练习库数据（`exportPracticeSql`） |

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

**推送状态与还缺什么**（2026-10-30 中午已推送完成，本节为推送后的现状）

- **已推送**：`today-dev` 已推到 `origin`，远端 `today-dev` = `97b3965`，与推送时的本地 HEAD 逐位一致（推送参数与只读复核见 §15.8）。
  本轮仍走 HTTPS，用的是刘先生当场给出的仓库 PAT（有 repo 写权限）：推送时它只作为本地
  `credential.helper` 凭据文件（600 权限）使用，推送结束后即删除；
  **PAT 不写入仓库任何文件、文档、bundle、diff、git 历史或日志**，本文档与交付物中也不出现。
- **本轮推了两次**（第一次代码、第二次本节所在的文档提交）：

  | 次序 | 范围 | 说明 |
  | --- | --- | --- |
  | 第一次 | `6091d8b..0a06c0b` | 实施路线第 6 章模块 + AI 接入 + 登录标识改动，共 7 个提交（见上表） |
  | 第二次 | 本节所在的文档提交 | 推送后远端 `today-dev` 的最终状态 = 该提交 |

- **远端核对（推送后，在目标机直连 GitHub 只读复核）**：
  - 分支：`today-dev` = `0a06c0b20fe7be16223f0954030e6bfc9931f209`（= 推送时的本地 HEAD，逐位一致）、
    `main` = `b5c8335`（未动）、`wabi-dev` = `bed9246`（未动），远端仍恰 3 支；
  - tag：仍是基线那 12 个 v1.x（`v1.7.0`–`v1.14.2`），名称与对象 SHA 与本地 `refs/tags`
    **逐条一致**，无新增、无缺失、无删除；
  - 两次都是 fast-forward：**没有 force push，没有删除任何远端引用**，
    没有推 `main` / `wabi-dev`，没有打新 tag（推送参数：`--no-follow-tags --no-force` + 显式 refspec）。
- **「实施路线收尾模块建设与 AI 接入」那条线**：该线此前未推送的提交（`0e5a34b`…`7827c95`）
  已随本轮第一次推送一并进入远端 `today-dev`（旧稿里「尚未推送」的表述已过时）。
- **GitHub 上那条 Deploy key**：仍然没有对应私钥（不可用，也没有泄露风险）；本轮继续走 HTTPS，
  更不需要它，删留仍由刘先生定，本轮不擅自处理。
- 随附交付物（按最终树重新生成）：
  - `today-dev.bundle`（含 `today-dev` 分支全量状态，克隆后即可推送）；
  - `today-dev-vs-4aa4e1d.diff`（相对 `4aa4e1d` 的本轮改动：第 6 章模块 + AI 接入 + 登录标识 + 文档更新）；
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

## 十三、本轮：实施路线第 6 章「上线陪产」建成独立模块 + 接入 tokenrhythm.studio 文本大模型（2026-10-30 上午）

### 13.1 结论先说

- **「实施路线的最后一个模块」= 首页「实施路线图」第 6 章「上线陪产」**，源码里唯一一处 `施工中` 文案就在
  `src/components/home/ChapterMap.tsx` 的锁定徽章上（`CHAPTERS[5]`，`playable:false`）。本轮把它从占位改成了
  一个真正能进的模块：独立路由 `/delivery`，标题「上线陪产 · 交付闭环」。
- **「AI 部分是代码问题还是单纯没接入」——两个问题都有**：
  - *代码问题*：`templates/pb_hooks/llm.pb.js` 顶部 `var ALLOWED_MODELS = []` 是空清单，路由处理器内又被同名局部变量
    `var allowedModels = []` 遮蔽，且上游地址硬编码成 `https://llm.runninghub.cn`；结果就是 `/api/llm/models` 返回空、
    `/api/llm/chat` 直接 `model_not_allowed`。同时 `timeout` 写死 600s，超过 PocketBase `$http.send` 的 120s 上限。
  - *没接入*：站内 `src/pages`、`src/components` 里**没有任何一处** import 或调用 `src/lib/llm.ts` / `aigc.ts`
    （grep 调用点为空），唯一的 AI 触点是运维实操营的「真实服务器模式」webhook。等于上游通了也没人用。
- **形态选择**：没有在关卡引擎里做 `ch6.json`，而是新建独立模块路由。理由：本次要求的形态是
  「讲解卡 + 判分题 + 排序题 + 交付物工作区」，与「实习准备营」的 `cards/questions/orders` 范式 1:1 对应；
  关卡引擎（match/judge/quiz/fill/sort）既没有讲解卡也没有写作工作区，硬塞进去要改 868 行的 `useLevel.ts`，
  风险与收益不成比例。

### 13.2 新模块「上线陪产 · 交付闭环」

- 内容文件 `public/content/delivery/index.json`（内容与代码分离，加题不用改组件）：
  - **讲解卡 8 张**（写法层：怎么写、怎么交、怎么验、上线后怎么守，不重复站内已有的定义型叙述）；
  - **判分题 12 道**：单选 6 / 多选 4 / 判断 2，判定口径与「实习准备营」完全一致（多选少选算错）；
  - **流程排序题 2 道**：实施九步（9 步）与上线流程（7 步），必须完全一致才算对；
  - **交付物工作区规范**：四件交付物 —— 操作手册 / 需求调研记录 / 上线验收单 / 培训课件大纲，
    每件带「读者、要回答什么、建议结构、字数门槛、必备要素（含正则规则）、关联术语」。
- 代码：
  - `src/content/delivery.ts`：类型 + 加载器 + `validateDeliveryModule`（缺字段直接报错，不渲染到一半崩）；
  - `src/game/delivery.ts`：组卷与判定复用 `src/game/careerPrep.ts` 的 `judgeCareerQuestion` / `scoreCareerPaper` /
    `wrongCareerTermIds`；**新增站内独一份的能力**：`checkDeliverable` / `checkWorkspace` —— 按「必备要素」逐条查文本
    （版本号与生效日期、角色与适用范围、分步操作、截图占位、报错处理；调研时间与参与人、现场原话、需求分级、
    范围边界、客户确认；验收范围与版本、验收项与判定标准、遗留问题与责任人、回滚方案、签字栏；对象岗位与课时、
    分模块大纲、现场演练、考核方式、讲师与开课安排），而不是数字数。
  - `src/pages/Delivery/*`、`src/components/delivery/*`：讲解卡面板、交付物工作区面板（含 AI 评审）、结果面板；
    判分题与排序题直接复用 `CareerQuizCard` / `CareerOrderPanel`，保证两个模块判定与交互一致。
- 测试：新增 `src/game/__tests__/delivery.test.ts`（12 例）与 `src/content/__tests__/delivery-quality.test.ts`（12 例）；
  仓库全量 **649 例全绿**。内容红线测试当场抓出我写的一个正则笔误（字符类没闭合），已修。

### 13.3 首页与存档接线

- `ChapterDef` 增加可选 `route?: string`；第 6 章设 `route:"/delivery"`，`ChapterMap` 对带 route 的章节显示「可进入」，
  `useHome.openChapter` 遇 route 直接跳转，不再弹「施工中」。首页「常驻模块」新增「交付物工作区」入口卡片。
- 存档：`player_progress` 新增两个 json 字段 `delivery_history`（练习历史）、`delivery_workspace`（草稿）。
  `shorthand_crud.pb.js` 的集合定义**只加不删**地补上这两列（DB 里已确认列存在）。
- **`progress-guard` 的 12 个受监控字段保持不变**：如果把新字段塞进 `FIELD_ORDER`，首次部署时 DB 尚无该列，
  快照 SQL 会失败 → before 取到空集 → compare 静默通过，反而留下校验漏洞。新字段不进 `FIELD_ORDER`。

### 13.4 AI 接入（环境变量驱动的 OpenAI 兼容上游）

改造 `templates/pb_hooks/llm.pb.js`，**平台部署行为不变**（没配环境变量时仍走 RunningHub 渲染清单与专有请求头）：

| 环境变量 | 作用 |
| --- | --- |
| `MES_LLM_BASE` | 上游地址，如 `https://tokenrhythm.studio/v1`（以 `/v1` 结尾则拼 `{base}/chat/completions`，否则 `{base}/v1/chat/completions`） |
| `MES_LLM_API_KEY` | 上游密钥，**只从服务端环境读**，绝不接受浏览器带来的头 |
| `MES_LLM_MODELS` | 允许的模型名，逗号分隔（本轮：`mimo-v2.6-pro`） |
| `MES_LLM_MAX_TOKENS` / `MES_LLM_TIMEOUT_S` / `MES_LLM_SUPPORTS_TEMPERATURE` | 输出上限（8192）/ 超时（100s，钳到 ≤120）/ 是否透传 temperature |

- 非 RunningHub 上游时**不发** `x-rh-llm-app-code`、`X-LLM-Include-Billing` 这两个平台专有头；上游 401 映射成
  `llm_unauthorized`（502）而不是误报 `rh_login_required`（412）。
- 前端消费点：交付物工作区里的「AI 交付物评审」——写完一稿后点一下，`src/lib/llm.ts` 的 `listLlmModels()` 判断可用模型、
  `callLlmWithFallback()` 走站点自己的 `/api/llm/chat`，按「缺什么 / 哪里写得不好 / 可直接替换的句子 / 评分」四段输出。
  这是**站内第一个真实消费大模型的业务功能**（此前只有运维 webhook）。没有可用模型时前端明确显示「服务端未启用模型」，
  不静默降级。

### 13.5 密钥落点

- 新建 `/data/mes/secrets/llm.env`（`-rw------- user:user`，目录本身 `drwx------`），只放 `MES_LLM_*` 变量。
- `mes-pocketbase.service` 与 `mes-edge-proxy.service` 各加一行 `EnvironmentFile=-/data/mes/secrets/llm.env`
  （`-` 前缀表示文件缺失不阻断启动；原单元已备份为 `*.service.bak-20261030`）。
- 密钥值**不进仓库、不进本文档、不进 bundle / diff / 日志**；仓库里只有变量名与说明。
- **当前状态**：上游地址与模型名已按 `https://tokenrhythm.studio/v1` + `mimo-v2.6-pro` 配好，**密钥行仍为空**
  （`MES_LLM_API_KEY=`）。填入后 `sudo systemctl restart mes-pocketbase` 即生效；未填时后端明确返回
  `503 llm_not_configured`，前端显示「服务端未配置上游密钥」，不会假装能用。

### 13.6 部署与验证记录（目标机 instabox dev）

- 提交链：`6091d8b`（对齐目标机上比沙箱副本多的一个文档提交）→ `0e5a34b` 交付闭环模块 + AI 接入 →
  `ff2352e` 部署校验清单补 `content/delivery/index.json` → `cb9feb1`/`4dc4b8c` hook 作用域与自带鉴权修复 →
  `cf503d1` 存档白名单放行新字段。**未推送远端**（缺 GitHub 写凭据，且本轮明确不推 main / wabi-dev、不打 tag）。
- 部署：`git bundle` → 目标机 `git fetch` 快进到 `cf503d1` → `npx vite build --base=/mes/` →
  `deploy/mes-deploy.sh`（备份 → 部署 → 校验 → 失败自动回滚），备份目录 `/data/mes/backups/mes-backup-20261030-042710`。
- 部署脚本自带校验全部通过：首页 200、入口脚本 200、四个内容文件 200（含新增的 `content/delivery/index.json`）、
  `__pb/api/player_progress` 401（未登录属预期）；`progress-guard` 部署前后比对 **1 条记录、changed/missing/added 全空**。
- 公网入口基线不变：未认证 `/mes/` = 401、已认证 = 200、未认证 `/mes/delivery` = 401、已认证 = 200、内容文件 = 200、根路径 = 302。
- 新字段写路径实测：`PATCH delivery_workspace` → 200 且回读一致 → 再 PATCH 还原为 `{}`；受监控字段一字未动
  （`study_days`、`last_route` 等保持原值）。
- **AI 端到端实测（用本地同协议 mock 上游替换最后一跳，站点自身的链路全部真实跑通）**：
  站内登录取令牌 → `GET /mes/__pb/api/llm/models` = 200，返回 `["mimo-v2.6-pro"]`（`max_tokens=8192`、`timeout_s=100`）→
  `POST /mes/__pb/api/llm/chat` = 200，返回模型文本与 `usage`；mock 侧抓到的真实上游请求是
  `POST {base}/v1/chat/completions`、`Authorization: Bearer <env 里的密钥>`、`Content-Type: application/json`、
  **不带** `x-rh-llm-app-code` / `X-LLM-Include-Billing`，请求体 `{"model":"mimo-v2.6-pro","messages":[…],"max_tokens":8192,"stream":false}`。
  连跑两次 PocketBase 重启，结果一致。上游协议本身此前已对 `tokenrhythm.studio` 实测通过（`/v1/models` 25 个模型、
  `chat/completions` 用 `mimo-v2.6-pro` 返回 200 与「连通」）。

### 13.7 顺手修掉的两个既有缺陷（都是这轮被触发的）

1. **`llm.pb.js` 依赖别的 hook 文件的 `requireMesUser`**：PocketBase 加载多个 hook 文件的顺序不保证，
   顺序一变整个 `llm.pb.js` 加载失败（`ReferenceError: requireMesUser is not defined`），
   `/api/llm/*` 路由整体消失（GET 落到 SPA 回退返回 HTML、POST 返回 404）。
   现在 `llm.pb.js` 自带一份 `requireMesUser`，与 `aigc.pb.js` / `lab_proxy.pb.js` 同一套写法，不再依赖加载顺序。
2. **存档读写白名单没放行新字段**：`shorthand_crud.pb.js` 的 `JSON_FIELDS` 没包含 `delivery_history` /
   `delivery_workspace`，导致 PATCH 返回 200 但字段被丢弃（DB 列在、值写不进）。已把两个字段加进 4 处白名单。

### 13.8 本轮仍然待办（诚实项）

- ~~**密钥待填**~~ → **已完成**（第十四节 14.5）：密钥已写入 `/data/mes/secrets/llm.env`（600 `user:user`，
  目录 700），重启 PocketBase 后对真实上游 `mimo-v2.6-pro` 实测 HTTP 200（耗时 8.579s、usage total 68、
  回复要点正确、调用在 `llm_jobs` 落库）。
- **AIGC 仍不可用**：tokenrhythm 只提供 chat 模型，没有图像/视频生成；站内 AIGC 走 RunningHub 专有的
  media/upload 与 openapi/v2/query 接口，本轮不臆造凭据、不改其实现，只在 `/api/aigc/models` 的空清单里补了
  明确原因说明（前端据此提示，而不是静默返回空）。
- **第 5 章「质量与库存」仍是「施工中」**：它是实施路线图里的另一格（关卡引擎形态），不在本次「最后一个模块」的范围内。
- ~~**远端未推送**~~ → **已完成**（第十一节 / 第十四节 14.7）：`today-dev` 已推到 `origin`；
  推送用 PAT 只作 600 权限凭据文件、推完立即删除、复检无残留；`main` / `wabi-dev` / 12 个 tag 均未动。

## 十四、本轮：站内账号标识改为 monika + 上游密钥实测 + 推送 today-dev（2026-10-30 中午）

### 14.1 先定位账号载体（确认改的是哪个账号）

| 检查项 | 结果 |
| --- | --- |
| Linux 系统账号 | `getent passwd monika` 无此用户 → **不是系统账号** |
| nginx Basic Auth | `Basic Auth 账号: monika` 记在 `/data/mes/secrets/credentials.txt` 与 nginx 站点配置里 → 与站内应用账号**同名但互不相干，本轮未改** |
| 站内应用账号 | PocketBase 0.40.6 的 `mes_users` auth 集合，**全库唯一一条记录** `id=5aipu96dx5kooxu`（原 `email=monika@mes.local`） |

结论：站内登录标识就是 `mes_users` 那条记录的 `email`；公网入口的 Basic Auth 是另一套凭据，两者不共用。

### 14.2 为什么不能直接把 email 改成 "monika"，以及本轮实际做法

PocketBase 0.40.6 的 `email` 是**系统字段**，带邮箱格式校验：

- 直接 `setEmail("monika")` 保存报错：`email: must be a valid email address.`（记录未被改动）；
- 系统 email 字段也**不允许改类型**：实测把它替换成 text 字段后保存，PB 会还原回 email 类型。

PB 允许的可行形态是：新增一个 **text 类型的身份字段**并给它加 UNIQUE 约束。实测报错原文给出了这条规则——
`The field uname doesn't have a UNIQUE constraint.`（text 类型本身是被允许的，卡住的是唯一约束）。

本轮采用的做法（全部在目标机执行，**没有写进仓库**）：

1. 用 PocketBase 自带 JSVM（一次性 `pb_hooks` 钩子，用完即删）给 `mes_users` 增加 `username` text 字段 → PB 自己建列；
2. 停 PB，在 `_collections` 的 `indexes` 里补
   `CREATE UNIQUE INDEX idx_unique_username_<collectionId> ON mes_users (username)`，
   并把 `options.passwordAuth.identityFields` 由 `["email"]` 改为 `["username"]`；
3. 起 PB，用一次性钩子把记录 `username` 写成 `monika`，并按进程环境变量 `MES_APP_LOGIN_PASSWORD` 重设口令
   （口令不经过命令行、不进日志）；
4. 删除一次性钩子：运行时 `pb_hooks` 目录只剩 6 个正常文件（`aigc` / `lab_proxy` / `llm` / `mes_auth` /
   `_rh_admin_sso` / `shorthand_crud`）。

**遗留说明（需要知道）**：PB 要求 auth 记录保留一个合法邮箱，所以记录的 `email` 列仍是旧值 `monika@mes.local`；
它已不在身份字段里，**不能再用来登录**（实测 400）。`/data/mes/secrets/mes.env` 的 `MES_APP_LOGIN_EMAIL`
与 `credentials.txt` 的「应用登录账号」行已同步改为 `monika`（Basic Auth 两行原样未动）。

### 14.3 登录实测

| 场景 | 结果 |
| --- | --- |
| 身份 `monika` + 新口令 | **HTTP 200**，拿到 `mes_users` token（221 字符），后续所有受保护 API 均用此 token 实测通过 |
| 身份 `monika@mes.local` + 同一口令 | **HTTP 400** `Failed to authenticate.`（旧标识确实不能再登录） |
| 记录身份 | `id=5aipu96dx5kooxu` 未变；`mes_users` 仍 1 条记录，未新增、未删除 |

口令按刘先生的要求与现网一致（长度 11、末四位 1016）；口令明文不写入仓库、文档、bundle、diff 与本说明。

### 14.4 存档归属核对（不孤儿、不清库）

`player_progress` 表**没有用户归属列**：它是单条全局记录（`id=xd321ng6i70pydz`），前端凭 `mes_users` token
读写同一份存档。因此「改名后存档是否还挂在同一账号下」在这里等价于三件事——记录条数仍为 1、记录 id 未变、
受监控的 12 个字段逐条一致。本轮实测：

- 本轮两次部署的 `progress-guard` 前后比对**均通过**（`changed` / `missing` / `added` 全空）；
- `06:54:55` 与 `06:55:27` 两个部署备份与现场**逐字节一致**；
- 与 `04:27` 部署备份相比有 4 处差异（`db_history` / `factory_history` / `ops_history` / `last_route`），
  这 4 处来自上一轮**实操写路径测试**写入的测试值与随后的还原，发生在本轮开始之前；
  **本轮没有对 `player_progress` 做过任何写操作**（本轮只写过 `mes_users` 与 `llm_jobs`）；
- 未清库、未重建、未删除任何记录。

### 14.5 上游密钥写入与真实调用实测

- 密钥写入 `/data/mes/secrets/llm.env` 的 `MES_LLM_API_KEY=`：文件 **600 `user:user`**、目录 **700 `user:user`**；
  指纹为长度 49、末四位 `-TTU`、前缀 `sk_tr_`。**明文不出现在仓库、文档、bundle、diff、日志与回报**；
- `sudo systemctl restart mes-pocketbase` 后实测 `GET /mes/__pb/api/llm/models` → **200**，
  返回 `mimo-v2.6-pro`（`max_tokens=8192`、`timeout_s=100`、`supports_temperature=false`）；
- `POST /mes/__pb/api/llm/chat`（带 `request_id`，问题：「用一句话说明：上线验收单应该包含哪三项内容？」）：
  **HTTP 200，耗时 8.579s**，`model=mimo-v2.6-pro`、`status=success`；
  回复要点：「项目/功能信息、验收结果（测试情况及通过与否）、签字确认（开发/测试/产品签署）三项」；
  `usage` = `total_tokens 68`（`prompt_tokens` 22、`completion_tokens` 46、reasoning 0、cached 0）；
- 同一次调用在 `llm_jobs` 落库一条 `status=success` 的记录（含 `result_text`）；
- 前端消费点仍是交付物工作区的「AI 交付物评审」，走站点自身 `/api/llm/chat`。

### 14.6 顺带修掉的一个部署缺陷（构建开关漏了）

`DEPLOY.md` 写明：独立部署的构建命令必须带 `VITE_MES_SELF_HOSTED_AUTH=true`，否则不会包裹站内登录页。
现网此前（含上一轮）用 `npx vite build --base=/mes/` 构建，**登录组件被 tree-shake 掉，产物里根本没有登录框**
（实测部署后的 assets 里既没有新文案也没有旧文案）。这会让「登录标识改成 monika」在界面上无处可填。
本轮按 `DEPLOY.md` 重新构建并部署：入口由 `index-OJPjwTxx.js` 变为 `index-B3ErMs9G.js`，
产物内已含新的「账号」文案，登录框回到页面右上角，且输入框由 `type=email` 改为 `type=text`
（否则浏览器原生邮箱校验会拦下 `monika`），标签与报错文案同步改为「账号」。

### 14.7 推送与远端复核

- 第一次推送（代码）：`6091d8b..0a06c0b`，fast-forward，推送参数
  `git push --no-follow-tags --no-force origin refs/heads/today-dev:refs/heads/today-dev`；
- 第二次推送：本节所在的文档提交（推送后远端 `today-dev` 的最终状态 = 该提交）；
- 只读复核（目标机直连 GitHub）：`today-dev` 与推送时本地 HEAD 逐位一致，`main` 仍 `b5c8335`、
  `wabi-dev` 仍 `bed9246`，远端仍恰 3 支；tag 仍 12 个 v1.x（`v1.7.0`–`v1.14.2`），
  名称与对象 SHA 与本地 `refs/tags` **逐条一致**，无增无删；
- PAT 处理：只作为 600 权限的 `credential.helper` 凭据文件使用，推送结束立即删除；
  复检 `/tmp` `/root` `/home` `/data/mes` 无该 PAT 的任何残留片段，且无 `~/.git-credentials`、无残留 `credential.helper` 配置。

### 14.8 本轮的副作用与未推进项（诚实项）

- **一次性超管账号**：迁移集合 schema 需要超管权限，本轮临时建了一个 `ops_tmp_*@mes.local` 超管，
  用完删除；删除后 PB 发现超管表为空，按它自己的行为自动重建了默认安装账号
  `__pbinstaller@example.com`（与本轮开始前**同名同用途**，管理员入口仍是 PocketBase 安装 URL，见服务日志）。
  既有的 `ops_tmp_*` 已彻底删除，`_superusers` 表只剩 1 条。
- **登录页文案**：标签「邮箱」→「账号」，报错文案 →「账号或密码不正确，或账号尚未配置。」
- **AIGC 图像/视频生成**：tokenrhythm 只有 chat 模型，站内 AIGC 仍走 RunningHub 专有接口；
  本轮不臆造凭据，范围外未推进（`/api/aigc/models` 仍返回不可用原因说明）。
- **实施路线第 5 章「质量与库存」**：仍是「施工中」，本轮未推进。
- **两台 QwenPaw 现网、metabase 站点、nginx default 站点、nginx map 改写、Basic Auth 凭据**：本轮一律未动。
- **`MES_APP_LOGIN_PASSWORD` 的引导守卫**：口令长度 11 < 12 时，`mes_auth.pb.js` 的引导逻辑会跳过建号，
  所以新装环境仍需注意本轮设定的口令不满足引导口令长度要求（现有实例不受影响）。

---

## 十五、本轮：实操营「每题一文档 + AI 读文档生成脚本」链路（2026-10-30 下午）

### 15.1 题目与文档一一对应

- 范围：数据库实操营 20 题（`db-q1~q5`、`db-j1~j5`、`db-c1~c5`、`db-r1~r5`）+ 运维实操营 28 题（原 20 题 + 本轮新增 8 题）= **48 题 / 48 份文档**。
- 每题一份独立文档 `public/content/labs/<id>.md`，固定十个小节：目标与背景、表与服务、账号与权限、环境要求（含规格基线、附加要求、破坏性操作提醒）、标准步骤、**可机器判定的验收**（直接引用该题的检查 SQL 与期望值，或 accept 正则）、常见坑、AI 环境准备步骤、AI 执行脚本要点、安全边界与失败处理。
- 题目 JSON 增加 `doc` 字段（`{id, path, title}`）；`scripts/check-lab-docs.mjs` 做一一对应校验（缺文档、文档与题目错配、验收正则对不上即非零退出，当前输出「题目 48 道 / 文档 48 份，一一对应校验通过」）；`scripts/build-lab-docs.mjs` 负责由题目与 `public/content/labs/meta.json` 重新生成全部文档。

### 15.2 规格基线（实测，不猜）

在目标机上实测：4 vCPU AMD EPYC、7.8 GiB 内存（无 swap，可用约 5.5 GiB）、`/` 16 GB（45% 已用）、`/data` 20 GB（7% 已用）、Debian GNU/Linux 13 (trixie)、kernel 6.18.54、Docker 29.8.2 可用、未安装 MySQL 客户端与服务端（MySQL 演练一律走 Docker 一次性容器）。各题的「最小配置」按实测值约一半给出，「推荐配置」直接等于实测值；数据库题另给数据库版本与空间要求。

### 15.3 AI 生成脚本链路（单通道、复用站内 AI）

- 模型固定 `mimo-v2.6-pro`（`src/game/labScripts.ts` 的 `LAB_LLM_MODEL`），走站内已有 `/api/llm/chat`（即已接好的 tokenrhythm.studio OpenAI 兼容端点），**不新增第二条通道，浏览器不携带任何密钥**；密钥只在目标机 `MES_LLM_API_KEY` 环境变量里。
- `buildLabScriptPrompt`：提示词只含「题目标题 + 该题文档全文 + 连接信息（主机/端口/库名/用户名）」，**不含口令**（实测 4082 字符，扫描确认无口令/密钥）。
- `parseLabScriptResponse`：解析模型返回的 JSON 块；缺 `assert` 的步骤直接判失败。
- `detectLabDanger`：复用既有 `GLOBAL_DANGER` + 破坏性命令正则（`rm -rf`、`mkfs`、`dd if=`、`shutdown`/`reboot`、`kill -9`、`drop`/`truncate`/`delete from`、`chmod -R 777`、`iptables`、`firewall-cmd`、`systemctl stop|restart|disable`），命中即在预览里标红并要求二次确认。
- `matchLabAssert`：用题目既有的 `accept` 正则判分，与运维实操营原有判分口径一致。
- 执行复用既有通道：数据库题走 `dblabApi.exec`（并受既有只读护栏约束），服务器题走 `sshlabApi.exec`。
- 面板 `src/components/lab/LabScriptPanel.tsx` 挂在 `TerminalDrill`（运维）与 `TaskStage`（数据库）：填连接 → 生成 → **预览**（逐条列出命令、期望、断言正则、危险标记）→ 确认后逐条执行 → 判分。
- 失败模式全部显式化：上游不可用、文档缺失、解析失败、环境不匹配（文档要求 MySQL 而连接是 PostgreSQL 或反之）、执行报错，都有明确文案，不静默。

### 15.4 演练环境提示语

- `src/components/lab/DrillEnvironmentNotice.tsx`：连接表单顶部醒目中文提示——「请使用可丢弃的演练环境：删除/重建/清库/kill/改防火墙/重启服务都可能发生」；主机名含 prod / production / 生产 / 正式 / 线上 时额外红色告警并要求勾选确认，未勾选不能保存连接。
- 已接入数据库连接对话框（`ConnDialog`）与服务器连接对话框（`SrvConnDialog`）。

### 15.5 新增题目（8 道，均带文档、判分与安全边界）

`lx-d4` logrotate 重复配置、`lx-d5` inode 耗尽、`lx-d6` 证书过期、`lx-d7` cron 从未执行、`lx-d8` 权限不足导致服务起不来、`lx-d9` 零字节备份、`lx-d10` 连接池耗尽（7 道小排障）；`lx-d11` 一道 10 阶段综合题：资产盘点 → Docker 部署 MySQL(3307) → 离线应用与 systemd → nginx 反代 8099 → 监控/备份脚本与 cron → 故障取证 → 带备份修复 → 四层端到端验收 → 真实回滚演练 → 输出验收清单文件。

### 15.6 本轮同时修掉的缺陷

1. **窄屏登录入口遮挡顶栏按钮**：登录浮层原为 `fixed right-3 top-3`，与 `SiteHeader`（sticky `top-0 h-16`）同高、同 `z-50`，窄屏完全遮挡。改为窄屏 `top-16`（顶栏正下方）并收成 40×40 图标按钮，宽屏（≥sm）位置与外观不变。
2. **「自由沙盘」没有解锁判定**：此前只是写死的占位提示。新增 `src/game/sandbox.ts`（`SANDBOX_UNLOCK_CHAPTER_ID = 3`，只认第三章「建模与配置」通关 `chapter_status["3"] === "cleared"`，**不擅自放宽门槛**）、`src/content/sandbox.ts` + `public/content/sandbox/index.json`（4 物料 / 2 产品 / 3 工作中心 / 4 条提示）、`src/pages/Sandbox/*` 与 `/sandbox` 路由；库存与工单只活在页面状态，不写 `player_progress`。
3. 连接保存按钮重复 `disabled` 属性导致构建失败。
4. 危险命令判定遗漏 `systemctl stop|restart|disable` 等。
5. AI 给数据库题生成 mysql 命令行，经既有执行接口会报语法错：提示词按题型分别约束（数据库题 = 纯 SQL 单语句、查询类只读；服务器题 = 单条 shell 命令）。
6. **实操通道中文乱码**：`lab_proxy.pb.js` 的 `runLab` 用 `String.fromCharCode` 逐字节拼字符串（等于按 latin1 解码），库里/终端里的中文全部以乱码返回浏览器。改为按 UTF-8 解码；注意 PocketBase 每个路由处理器是独立 JSVM 作用域，helper 必须每个处理器各带一份（顶层那份在处理器里不可见）。
7. MySQL 连接未声明字符集：显式 `charset: "utf8mb4"`。

### 15.7 实测证据

- `npx tsc -b` 退出码 0；`npx vitest run` 29 个测试文件 **689 例全过**（上一轮 649 例无回归）。
- 构建 `VITE_MES_SELF_HOSTED_AUTH=true npx vite build --base=/mes/` 成功；`bash /data/mes/run_deploy.sh` 返回 DEPLOY_EXIT=0，部署校验「学习进度不变量」通过：部署前后 `player_progress` 均为 1 条，changed / missing / added 全空。
- 基线复核：未认证 `/mes/` 401、已认证 200；未认证 `/mes/delivery` 401、已认证 200；新增内容 `/mes/content/labs/db-q1.md`、`/mes/content/labs/lx-d11.md`、`/mes/content/sandbox/index.json` 均 200；`mes-pocketbase` / `mes-edge-proxy` / `nginx` 均 active；`player_progress` 仍 1 条且 id 不变。
- **数据库题真实链路 E2E**（一次性 MySQL 演练库，Docker 容器用完即删）：站内登录 → 取该题文档 → 用前端真实代码 `buildLabScriptPrompt` 生成提示词 → 站内 `/api/llm/chat` 出脚本 → 用前端真实代码 `parseLabScriptResponse` 解析（4 条准备 + 3 条执行）→ 注册一次性连接 → 逐条执行 → `matchLabAssert` 与题目判分口径：**7/7 步骤通过、判分 PASS（期望 16，实测 16）**；结束后删除连接登记、销毁容器，无残留。
  - 附带发现：平台网关对较长响应约 30s 就会断开，前端与本次测试同样在 25s 放弃等待、改用 `/api/llm/poll` 轮询取回结果，因此长脚本生成在生产链路上是通的。

### 15.8 本轮未完成（如实说明）

- **服务器题（1 道）的真实链路 E2E 未做**：需要在目标机上再起一台可丢弃的 SSH 演练机，本轮时间预算内未完成。代码路径与数据库题同构（`sshlabApi.exec` + 同一套 `accept` 正则判分），但**未实测**，不作为已验证结论。
- **手机端视口实测（360 / 390 / 412px）本轮未做**：窄屏修复有组件级测试覆盖，但没有窄视口截图级证据。
- 桌面端 640–1440px 宽度区间，登录浮层仍可能压住顶栏右侧按钮（既有状况，本轮未扩大改动范围）。

### 15.9 推送

- 推送参数：`git push --no-follow-tags --no-force origin refs/heads/today-dev:refs/heads/today-dev`，fast-forward。
- 第一次（代码）：`17e3ce9..97b3965`。
- 只读复核：远端 `today-dev` 与推送时的本地 HEAD 逐位一致；`main` 仍 `b5c8335`、`wabi-dev` 仍 `bed9246`；12 个 v1.x tag（v1.7.0–v1.14.2）名称与对象 SHA 逐条不变，无新增或删除。
- 凭据：PAT 只写目标机临时文件（权限 600），推送后立即删除；无 `~/.git-credentials`、无 credential.helper 残留。
- 本节文档对应的提交随后再推一次，最终远端 `today-dev` 哈希以交付的 `today-dev.bundle` 内 HEAD 为准。


## 十六、本轮：宽屏登录浮层修复 + 两种并列的演练环境模式（2026-10-30 晚）

### 16.1 登录浮层：窄屏与宽屏都不再压住顶栏按钮

**问题**：站内登录入口固定在 `right-3 top-3`，与 sticky 顶栏（`h-16`）同高。
手机窄屏下它直接盖住顶栏右上角的「术语卡库 / 自由沙盘」两个按钮，点不到；
上一轮按「桌面端布局不能变」只把窄屏挪到了顶栏下方，宽屏展开后仍然压住这两个按钮
（1280px 实测：浮层 `x=962..1268, y=12..314`，按钮 `x=940..1062 / 1070..1192, y=12..52`，命中测试落在浮层上）。

**修法**：登录浮层**所有宽度**一律锚到顶栏正下方（`top-16` = 64px，正好是 `h-16` 顶栏的高度），
窄屏收成 40×40 图标按钮、宽屏保留文字按钮；两种宽度都不再与顶栏同高。
这样不需要改顶栏自身的布局，也不用靠 z-index 硬压。

**实测（同源 iframe harness，测完即删，不进仓库也不留目标机）**：

| 视口宽度 | 顶栏「术语卡库」 | 顶栏「自由沙盘」 | 登录浮层 | 是否重叠 | 命中测试 |
| --- | --- | --- | --- | --- | --- |
| 360 | x=236 y=12 50×40 | x=294 y=12 50×40 | x=46 y=64 306×313 | 否（重叠 Y=0） | 命中自身 BUTTON |
| 390 | x=266 y=12 50×40 | x=324 y=12 50×40 | x=76 y=64 306×313 | 否（重叠 Y=0） | 命中自身 BUTTON |
| 412 | x=288 y=12 50×40 | x=346 y=12 50×40 | x=98 y=64 306×313 | 否（重叠 Y=0） | 命中自身 BUTTON |
| 640 | x=364 y=12 122×40 | x=494 y=12 122×40 | x=322 y=64 306×302 | 否（重叠 Y=0） | 命中自身 SPAN |
| 1024 | x=748 y=12 122×40 | x=878 y=12 122×40 | x=706 y=64 306×302 | 否（重叠 Y=0） | 命中自身 SPAN |
| 1280 | x=940 y=12 122×40 | x=1070 y=12 122×40 | x=962 y=64 306×302 | 否（重叠 Y=0） | 命中自身 SPAN |
| 1440 | x=1020 y=12 122×40 | x=1150 y=12 122×40 | x=1122 y=64 306×302 | 否（重叠 Y=0） | 命中自身 SPAN |

「命中自身」= 在按钮中心点做 `elementFromPoint` 得到的元素就是该按钮本身（不是浮层），即按钮可见可点。

### 16.2 两种并列的演练环境模式

实操面板上让用户明确二选一：

| | 模式 A：使用我的远程环境 | 模式 B：使用站点的一次性 Docker 演练环境 |
| --- | --- | --- |
| 执行目标 | 用户自己登记的数据库 / SSH 连接（用户自己的机器） | 站点在部署机上临时拉起的容器 |
| 谁准备环境 | 用户（填连接信息） | 站点（点一下「创建一次性演练环境」） |
| 数据是否保留 | 保留在自己的机器上，可长期复用为演练台 | 不保留：容器销毁即消失 |
| 适合 | 正式交付前的真实环境验证、需要真实账号权限的题 | 反复练习、破坏性操作、零准备随时开始 |
| 代价 | 环境、账号、权限要自己维护 | 环境是一次性的；容器里没有宿主机上的 systemd / nginx / 业务进程 |

两种模式**共用同一套**：题目文档、AI 脚本生成、预览与逐条确认、危险命令拦截与二次确认、
演练提示语、生产主机名告警、判分口径；**只有「命令打到哪里」这一层不同**。

模式 B 另外允许（可选，不强制）指定部署机上**已存在**的某个容器或端口：
填主机、端口、账号、口令后，站点直接把它当执行目标，既不创建也不销毁。

### 16.3 模式 B 的服务端实现

新增 `server/labenv.mjs`（随 `server/` 一起部署，由 PocketBase hook 调用）：

- **接口**：`/api/labenv/create`（建环境）、`/api/labenv/destroy`（销毁）、`/api/labenv/status`（列出并回收超时的）。
- **容器**：数据库题起一次性 MySQL 8.0 / PostgreSQL 16 / SQL Server 2022 容器，服务器题起一次性 sshd 容器
  （镜像 `linuxserver/openssh-server`，容器内 2222 端口映射到宿主机随机端口）。
- **端口**：数据库题从 14200-14249、服务器题从 14300-14349 里挑「当前能 bind 的」端口，
  并显式避开现网端口（22/80/443/1433/3306/5432/6379/8080/8090/8091/8099/3307/27017）；只发布在 127.0.0.1。
- **凭据**：口令现场随机生成，只在创建响应里回显给浏览器一次；**不落盘、不写日志、不进仓库与文档**。
  环境状态由容器名还原（`mes-lab-<envId>`），所以连接登记文件里没有一次性环境的凭据。
- **就绪探测**：以「容器内服务真的能连」为准（MySQL 看 `ready for connections`、PostgreSQL 用 `pg_isready`、
  SQL Server 看 `SQL Server is now ready`、sshd 看 `sshd is listening` 并从宿主机探端口）；
  灌完练习库数据还要再探一次端口；任一环节超时就把容器删掉并返回「可重试」。
- **数据**：数据库容器就绪后灌入站内同一份确定性练习库（`exportPracticeSql()` 把内置 SQLite 练习库
  导出成 MySQL / PostgreSQL 的建表与插入语句，231 行），否则数据库实操营的题目会直接报表不存在。
- **清理**：面板上「结束演练并销毁环境」按钮 + 离开页面时兜底销毁 + 服务端 2 小时 TTL 扫描
  （`create` / `destroy` / `status` 时顺带回收超时的容器）。
- **只动自己创建的容器**：所有操作都限定在 `mes-lab-` 前缀上，不碰现网服务、metabase、nginx。

### 16.4 题目文档补「两种模式的环境要求」

48 份题目文档（`public/content/labs/<id>.md`）全部新增**第 11 节「两种演练环境模式下的准备要求」**：

- 11.1 模式 A 需要用户具备什么账号与权限（数据库题：可登录账号 + 建表/写入/删除权限 + 可丢弃的练习库；
  服务器题：可 SSH 的演练机 + 能跑 systemctl/df/du/find 的账号 + sudo + 主机名别含 prod/生产/正式/线上）；
- 11.2 模式 B 站点预置什么（容器类型、端口段、干净环境还是预置脏数据）、最小与推荐组件配置；
  并写明限制（依赖 systemd / 数据库服务 / 业务进程的步骤请用模式 A）；
- 11.3 两种模式怎么选（反复练与破坏性操作用 B，正式交付前的真实验证用 A，两者可混用）。

规格数值出处与既有文档一致：最小配置按已验证的目标机 instabox dev 实测规格（4 vCPU AMD EPYC /
7.8 GiB 内存无 swap / 根分区 16 GB + 数据盘 20 GB / Debian GNU/Linux 13 / 内核 6.18 / Docker 29.8）
的一半左右给出。

### 16.5 新增与调整的测试

| 测试 | 位置 | 覆盖 |
| --- | --- | --- |
| 模式选择与切换逻辑 | `src/game/__tests__/labEnv.test.ts` | 两种模式并列、各自取舍文案、只有模式 B 需要站点建环境、模式 A/B 的前置条件文案、最小/推荐配置、端口段与现网端口不冲突 |
| 容器环境生命周期（创建/就绪/销毁） | `server/__tests__/labenv.test.ts` | 端口占用判定（bind 测试）、端口落在区间内且避开已占用端口、不挑中现网端口段 |
| 两种模式共用的判分口径 | `src/game/__tests__/labEnv.test.ts` | 同一套 `matchLabAssert` 对两种模式一致：输出命中即达标、命令片段（去包装后）兜底、都不命中即不达标 |
| 宽屏与窄屏布局回归 | `src/components/__tests__/MesAuthGate.test.tsx` | 浮层所有宽度都含 `top-16`、**不再出现 `sm:top-3`**、窄屏图标/宽屏文字、登录框仍是自由文本且标签仍是「账号」 |
| 判分去包装 | `src/game/__tests__/labScripts.test.ts` | `sudo` / `env` / `timeout` 前缀的命令按去包装后的命令判定 |

`npx tsc -b` 通过；`npx vitest run` 全量通过（31 个测试文件 / 704 例，基线 689 例无回归）。

### 16.6 四条真实链路 E2E（模式 A / 模式 B × 数据库题 / 服务器题）

口径与站内面板一致：站内登录 → 取该题文档 → 用前端真实的 `buildLabScriptPrompt` 生成提示词 →
`/api/llm/chat`（25 秒放弃后 `/api/llm/poll` 轮询）→ 前端真实的 `parseLabScriptResponse` →
逐条执行 → 用同一套 `matchLabAssert`（输出优先、命令片段兜底）判分 → 清理。

| 模式 | 题型 | 题号 | 步骤 | 题目口径判分 | 清理 |
| --- | --- | --- | --- | --- | --- |
| A 我的远程环境 | 数据库 | `db-c1` | 4/9 | **PASS**（`SELECT COUNT(*) FROM items WHERE unit IN ('PCS','pcs')` → `[[0]]` = 期望 `[[0]]`） | 连接登记删除 200；用户自己的 MySQL 容器已删 |
| A 我的远程环境 | 服务器 | `lx-d5` | **15/15** | 全部步骤命中验收正则 | 连接登记删除 200；用户自己的 sshd 容器已删 |
| B 站点一次性环境 | 数据库 | `db-c1` | 5/7 | **PASS**（同上 `[[0]]`） | `labenv/destroy` → `status=destroyed, existed=true`；容器残留数 0 |
| B 站点一次性环境 | 服务器 | `lx-d5` | 10/12 | 12 步中 10 步命中；2 步是「造满 inode」的重活撞上站内 120 秒执行上限（HTTP 502） | `labenv/destroy` → `status=destroyed, existed=true`；容器残留数 0 |

模式 B 的建环境实测：MySQL 容器端口 14222、灌入练习库 231 行、容器内 `SELECT COUNT(*) FROM items` → 24；
sshd 容器端口 14320–14341 段，容器就绪后由站点写入免密 sudo 并预建 `/data/archive` 交给演练账号。

**如实说明的两处未全绿**：

1. 数据库题里有 2 步是模型自己写错了 INSERT 的列名（练习库的 `items` 表列是 `item_code / item_name / unit`，
   模型写成了 `name`），SQL 报错被如实回显、该步判失败；题目口径的判分（站点权威判据）仍然 PASS。
2. 模式 B 服务器题里「造满 inode」的两步会连续创建数万个小文件，超出站内单步 120 秒的执行上限返回 502；
   这属于执行时长限制，不是命令写错——同样的脚本在模式 A（用户自己的机器、步骤更短）下 15/15 全过。

### 16.7 基线复核（部署后）

| 项 | 结果 |
| --- | --- |
| 未认证 `/mes/` | 401 |
| 已认证 `/mes/` | 200 |
| 未认证 / 已认证 `/mes/delivery` | 401 / 200 |
| `mes-pocketbase` / `mes-edge-proxy` / `nginx` | active / active / active |
| `player_progress` | 仍 1 条，受监控的 12 个字段逐条一致（部署脚本自带校验通过） |
| 部署 | 走既有 `deploy/mes-deploy.sh`：备份 → 部署 → 校验 → 失败自动回滚，本次 DEPLOY_EXIT=0 |
| 残留清理 | 一次性容器残留数 0；连接登记已删除；端口已释放；harness 与临时脚本用完即删 |

### 16.8 已知限制（如实）

- 模式 B 的容器里没有宿主机上的 systemd / 数据库服务 / 业务进程，依赖这些的题（`lx-d1`、`lx-d2` 等）
  在模式 B 里跑不通，文档第 11.2 节已逐题标明要用模式 A。
- 模式 B 的 SQL Server 容器镜像很大、拉取慢，本轮没有做端到端实测（代码路径与 MySQL/PostgreSQL 同源）；
  PostgreSQL 路径同样只做了代码实现，未单独跑 E2E。
- 站内单步执行有 120 秒上限，超时返回 502——造满 inode、批量导入这类重活需要拆成多步。
- 一次性环境的服务端 TTL 是 2 小时；用户如果直接关掉页面，靠前端的兜底销毁 + 服务端扫描回收。

## 十七、本轮：异步作业通道（修模式 B 的 502）+ 练习库表结构注入 + SQL Server 方言 + 清理 metabase（2026-10-31）

### 17.1 结论先说

1. **模式 B 服务器题的 502 是真的修好了**：根因不是站内超时设置，而是**外层平台网关会在单个 HTTP 请求约 20 秒时硬截断**。站内同步执行器再快也没用——重活步必然 502。本轮改成「提交作业 → 轮询取结果」的异步通道后，同一道 `lx-d5`（造满 inode，需要连续创建数万个小文件）在模式 B 下 **12/12 步全过，最慢一步 77.989 秒，全程无 502**。
2. **模型臆造列名的问题从根上堵住了**：把练习库真实表结构（8 张表、列名/类型/行数）做成常量并注入数据库题的提示词，同时加硬规则「只能使用表结构里列出的表名与列名」。两轮真实上游生成实测里，生成的 SQL **臆造列名 = 0**（上一轮有 2 步把 `items` 的列写成不存在的 `name`）。
3. **PostgreSQL 模式 B 端到端跑通了**：站点一次性起 `postgres:16-alpine` 容器，灌入练习库 231 行，题目口径判分 PASS（脏码计数 0 / 0）。
4. **SQL Server 只做完了代码路径，没做容器端到端**：删掉 metabase 后根分区可用空间 5.1 GB，而 mssql 2022 镜像解包约 2.7 GB、峰值约 4.3 GB，余量不足以安全跑完，按刘先生「空间不足就别搞太多」的口径**主动暂缓**，代码（方言转换 + `mssql` 驱动灌库）已写好并通过单测。
5. **metabase 已按授权删除**，卷内数据先备份再删；根分区可用空间从 2.6 GB 升到 5.1 GB。

### 17.2 502 的根因与为什么改成异步通道

站内执行器原本是同步的：前端发一个请求 → 站点起子进程跑命令 → 命令结束才回包。而**外层平台网关会在单个 HTTP 请求约 20 秒时硬截断**，回包超时对用户表现为 502。

上一轮的实测口径：站内同步执行器上限 120 秒，模式 B 的「造满 inode」两步连续创建数万个小文件，必然超过 20 秒 → 必然 502。**延长站内超时无效**（网关先断），所以本轮没有去调 `timeoutMs`，而是把执行改成异步：

| 环节 | 实现 |
| --- | --- |
| 服务端作业队列 | 新增 `server/labjobs.mjs`：`submit` 落载荷并立刻返回 `jobId`；`work` 子进程跑执行器；`poll` 返回 pending/done；`sweep` 清理过期作业 |
| 站内路由 | 新增 `templates/pb_hooks/lab_job.pb.js`：`POST /api/labjob/submit`、`POST /api/labjob/poll`，只允许普通 MES 应用账号调用 |
| 前端封装 | `src/lib/labApi.ts` 新增 `labJobApi.submit/poll` 与 `runLabJob(kind, payload, {timeoutMs, intervalMs})` |
| 面板接线 | `src/components/lab/LabScriptPanel.tsx` 的 `runSql / runSqlInline / runShell / runShellInline / createSiteEnv` 全部改走作业通道 |

安全边界（都做了实测，不是设计意图）：

- 作业目录 `0700`、结果文件 `0600`（单测断言过实际权限位）。
- **一次性环境口令不落盘**：载荷走 `command.env` 的 `MES_LAB_JOB_PAYLOAD`，执行器读完立即删掉载荷文件；作业目录里只剩 `result.json`（单测「执行完就不再留载荷文件」）。
- 作业 TTL 30 分钟，`sweep` 清扫过期目录（单测用改 mtime 的老目录验证）。
- 执行器请求改用 `@文件` 传参，数据库口令不进 argv。
- 子进程环境走白名单（`PATH`/`HOME`/可选 `MES_LAB_DATA`），不把应用密钥传给执行器。
- 单步硬上限：db 60 秒 / server 300 秒 / labenv 600 秒，超时 SIGKILL。

### 17.3 练习库表结构注入（治「臆造列名」）

- 新增 `src/game/practiceSchema.ts`：把练习库 8 张表（items / bom / employees / equipment / work_orders / work_reports / inventory / sales_orders）的**列名、类型、主键、行数**做成常量，并生成提示词片段。
- `src/game/labScripts.ts`：数据库题的提示词里插入「## 练习库真实表结构（必须严格照用，禁止臆造列名）」，并在硬规则里加一条「只能使用表结构里列出的表名与列名，一个字都不能改」；服务器题不注入这块内容。
- 新增 `server/__tests__/practiceSchema.test.ts`：**漂移测试**——解析 `server/seed-practice-db.mjs` 里的建表语句逐表逐列比对，再用 `PRAGMA table_info` 跟真实建出来的库再比一遍，最后把行数也比一遍。表结构一变而常量没跟上，测试直接红。

### 17.4 SQL Server 方言（本轮只做代码，没做容器 E2E）

`server/seed-practice-db.mjs` 的 `exportPracticeSql` 从只支持 mysql / postgres 扩到 **sqlserver**：

| SQLite 原型 | SQL Server |
| --- | --- |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `INT IDENTITY(1,1) PRIMARY KEY` |
| `REAL` | `FLOAT` |
| `TEXT PRIMARY KEY` | `NVARCHAR(191) PRIMARY KEY` |
| `TEXT` | `NVARCHAR(255)` |
| 保留字列名 `role` / `shift` | `[role]` / `[shift]` |
| 字符串字面量 | `N'...'`（Unicode） |

`server/labenv.mjs` 的 `seedDatabase()` 补了 sqlserver 分支（走 `mssql` 驱动灌库），SQL Server 的 sa 口令按复杂度要求补齐大小写+数字+符号。

**没做的部分（如实）**：sqlserver 容器端到端没跑——删 metabase 后根分区只剩 5.1 GB 可用，mssql 2022 解包约 2.7 GB、峰值约 4.3 GB，余量不足以保证不影响站点（根分区同时跑着 PocketBase / docker data-root）。按刘先生「空间不足就别搞太多、需要新服务器可以给」的口径**主动暂缓**，不是失败。

### 17.5 metabase 清理（已授权，一次性删除）

刘先生原话：「metabase 其实可以停了删了它，我当初就是想体验下数据成图的感觉」。

删除前的盘点与依赖复核（逐项确认没有别的服务依赖它）：

| 项 | 处置前的实际情况 |
| --- | --- |
| 容器 | `metabase`（镜像 `metabase/metabase:latest`，发布端口 3000，restart=unless-stopped，compose 项目在 `/data/home/metabase/compose.yml`） |
| 镜像 | 1.91 GB（容器层另占 746 MB） |
| 卷 | `metabase_metabase-data`（18 MB，内含 `metabase.db.mv.db` 17.7 MB） |
| nginx | 只有 `/etc/nginx/sites-enabled/metabase.conf` 引用 `metabase_backend`（127.0.0.1:3000）；`sites-available/default` 与 `00-mes.conf` 都没有 metabase / 3000 的引用 |
| 依赖复核 | `mes-pocketbase` / `mes-edge-proxy` / `nginx` 三个服务都不指向 metabase；删除后三者仍 active |

处置顺序（按「先保数据、再删东西」）：**先把卷内数据备份到 `/data/home/metabase-db-backup-2026-10-31/`（18 MB）→ 停容器 → 删容器 → 删卷 → 删镜像 → 删 nginx 站点并 `nginx -t && reload` → 删 `/data/home/metabase`**。

复核结果：没有 metabase 容器 / 镜像 / 卷残留，nginx 无残留引用，三个服务 active。

空间变化：根分区 `/dev/root` 16 GB 从「已用 13 GB、可用 2.6 GB（83%）」变为「已用 9.7 GB、可用 5.1 GB（66%）」。

**顺带发现（未擅自处理，留给刘先生决定）**：docker 里还有约 40 个 210 MB 级的 mysql 孤儿卷（约 4.6 GB），是历次 E2E 留下的、没有容器引用。清理它们可以再腾出约 4.6 GB，但本轮没有授权，**没有动**。

### 17.6 本轮实测结果

单测（目标机 `npx vitest run`）：**34 个文件 / 723 个用例全过**（上一轮基线 31 文件 / 704 用例；本轮新增 3 个文件、19 个用例）。`npx tsc -b` 无错误。

E2E（真实上游 `mimo-v2.6-pro` 生成 → 站内作业通道执行 → 判分）：

| 场景 | 步数 | 通过 | 题目口径判分 | 备注 |
| --- | --- | --- | --- | --- |
| 模式 A / 数据库题 `db-c1`（第 1 轮） | 12 | 11 | **PASS**（`COUNT(*) FROM items WHERE unit IN ('PCS','pcs')` → `[[0]]`） | 单步约 1.28 秒 |
| 模式 A / 数据库题 `db-c5`（第 3 轮） | 12 | 10 | **PASS**（脏码计数 `[[0,0]]`） | 臆造列名 **0**；未过 2 步是断言与输出格式不匹配（见 17.8） |
| 模式 B / 数据库题 `db-c5`（PostgreSQL 一次性容器） | 13 | 13 | **PASS**（`[["0","0"]]`） | 容器端口 14243，灌库 **231 行**；单步约 1.28 秒 |
| 模式 B / 数据库题 `db-c5`（PostgreSQL，第 2 轮） | 19 | 11 | **PASS** | 19 步里 8 步是「预置脏数据 / 归并引用」的写步，未过原因同上（断言不匹配），非执行失败 |
| 模式 A / 服务器题 `lx-d5` | 23 | 20 | 题目口径命中 3/6 | 未过 3 步是模型用了 `sudo` 而演练账号免密 sudo 未就位 |
| 模式 A / 服务器题 `lx-d5`（第 2 轮） | 13 | 11 | 题目口径命中 5/6 | 未过 2 步同样是 `sudo` 交互提示（`sudo: a terminal is required to read the password`） |
| **模式 B / 服务器题 `lx-d5`** | **12** | **12** | 题目口径命中 4/6 | **最慢一步 77.989 秒，全程无 502**；这就是异步通道要解决的问题 |

基线复核（部署后）：未认证 `/mes/` = 401、已认证 = 200；`/mes/delivery` 与 `/mes/content/labs/*.md` 同样是 401 / 200；`mes-pocketbase` / `mes-edge-proxy` / `nginx` 均 active；`player_progress` 仍 1 条、受监控 12 个字段逐条一致（部署脚本自带校验通过）；部署走既有 `deploy/mes-deploy.sh`，`DEPLOY_EXIT=0`。

部署过程里踩到并修掉的一个真实缺陷：第一次构建漏了 `--base=/mes/`，产物里的资源路径是 `/assets/...`，部署脚本的「入口脚本」校验 404 触发**自动回滚**（回滚机制按设计生效）。重新用 `VITE_MES_SELF_AUTH=true VITE_MES_SELF_HOSTED_AUTH=true npx vite build --base=/mes/` 构建后部署通过。

### 17.7 本轮的已知缺口（如实，不藏）

1. **「命令成功执行但步骤被判失败」的口径问题**：站内执行器的输出是中文（「执行成功，影响 5 行」；查询只回值不回列名），而模型给的验收正则多是英文（`Query OK`、`affected`、`dirty_items\|dirty_inventory`），两边对不上 → 步骤实际执行成功，界面却记「未命中验收正则」。本轮**没有**改判分口径（不想在收尾阶段动判分语义），建议下一轮二选一：执行器输出补标准标记（`Query OK` / `N rows affected` / 列名行），或判分时把「退出码 0 且无错误」也算通过。
2. **模式 A 服务器题里模型的 `sudo` 用法**：演练账号的免密 sudo 只有站点自己起容器那条路径（模式 B）写好了，模式 A 是用户自己的机器，模型不能假设有免密 sudo——题目文档里应当写明「若需要 sudo 请用用户自己的提权方式」。
3. **SQL Server 容器 E2E 未跑**（空间，见 17.4）；**MySQL 容器 E2E** 本轮也没重跑（上一轮已跑通，代码路径未变）。
4. **模式 A 服务器题的口径分只有 3/6 ~ 5/6**：文档第 6 节的 6 条命令正则，模型脚本只命中一部分（模型常把 `du --inodes` 写成 `du -x --inodes` 或别的等价写法）。这属于文档正则与模型写法的匹配问题，不是执行失败。
5. **孤儿 mysql 卷约 4.6 GB 未清理**（见 17.5），根分区仍只有 5.1 GB 可用。

### 17.8 推送与远端复核

- 推送目标：`today-dev` 分支，显式 refspec `refs/heads/today-dev:refs/heads/today-dev`，`--no-follow-tags --no-force`；**没有**推 main / wabi-dev，没有打标签，没有删远端引用。
- 远端不变量复核：`main`、12 个 v1.x 标签、`wabi-dev` 的指向与对象 SHA 都保持不变，只有 `today-dev` 前移。
