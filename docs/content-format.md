# 内容文件格式文档（关卡 / 术语）

游戏的所有内容（章节关卡、术语卡、判定反馈）都在 `public/content/` 下的 JSON 文件里，**加新关卡不用改任何代码**：照着示例文件复制一份、改内容即可。页面启动时通过 `content/levels/index.json` 清单发现所有关卡文件。

```
public/content/
├── terms.json          # 术语卡库源数据（全站共用）
└── levels/
    ├── index.json      # 关卡清单：列出有哪些章节文件
    └── ch1.json        # 第 1 章内容（示例关，加新章节照抄结构）
```

## terms.json

```jsonc
{
  "terms": [
    {
      "id": "work_order",        // 唯一 id，关卡文件用 id 引用术语
      "term": "工单",             // 标准术语名
      "dialect": "派活儿的任务单", // 车间大白话（给零基础玩家的第一解释）
      "definition": "……",        // 完整定义：它是什么、管什么
      "example": "……",           // 一个具体例子（最好带数字）
      "knowledge_id": "K1-1",    // 对应知识点映射表编号，用于验收对账
      "illustration": "work_order_states"  // 可选：讲解图 id，注册表在 src/components/illustrations/index.ts
    }
  ]
}
```

**讲解图（illustration）**：给难懂概念配一张可视化图，术语卡弹窗里自动渲染在大白话和定义之间。当前注册表（16 张）：`bom_tree`（BOM 树）/ `route_flow`（工艺路线流动图）/ `backflush_flow`（倒冲扣料算式流）/ `work_order_states`（工单状态机）/ `yield_funnel`（产出漏斗）/ `wip_level`（在制品水位图）/ `inventory_count`（账实对照）/ `loss_rate_bar`（损耗备料条）/ `dispatch_board`（派工板）/ `unit_mismatch`（单位断链）/ `duplicate_codes`（一物两码合并）/ `calendar_strip`（工厂日历周条）/ `takt_line`（节拍时间轴）/ `batch_trace`（批次追溯链）/ `rework_loop`（返工回环）/ `shift_rotation`（班次轮转）。另有 `FactoryShape`（三厂型形态小图，用于厂型选卡页）。加新图：在 `src/components/illustrations/` 写组件（只用 token 色）→ `index.ts` 注册 → 术语卡加 `illustration` 字段，不改弹窗代码；`__tests__/registry.test.ts` 自动把关「术语引用的图必须已注册」。

## 知识点映射表（knowledge_id）

`terms.json` 的 `knowledge_id`、关卡文件的 `knowledge_ids`、各题库的 `term_ids` 都指向这张表；
映射不到的机制不要加（见文末红线）。

| 编号 | 主题 | 覆盖内容 |
| --- | --- | --- |
| K0 | 数据意识（跨章） | 数据准确率 |
| K1 | 调研认知（第一章） | 工单、BOM、工艺路线、报工、在制品、库存、倒冲扣料、工作中心、损耗率、派工单、缺料分析 |
| K2 | 静态数据与脏数据（第二章） | 一物两码、计量单位口径、一行两料、BOM 层级、主数据 |
| K3 | 建模与配置（第三章） | 物料主档、工序、工厂日历、半成品 |
| K4 | 执行与报工（第四章） | 报废、合格率、班次、返工、生产日报、计件工资 |
| K5 / K6 | 预留（路线图阶段） | 第五章质量与库存、第六章上线陪产等，尚未建卡，暂不产出内容 |
| K7 | 厂型认知 | 节拍时间、产线、工位、配方、批次、混线生产 |
| K8 | 订单与供应链 | 销售订单、物料需求计划 MRP、库存准确率 |
| K9 | 实施与交付（实习准备营 方向 1） | ERP、WMS、订单到发货全流程、数据迁移、数据清洗、数据责任人、实施蓝图、上线切换、上线验收、需求调研记录、操作手册、培训课件、扫码报工 |
| K10 | 产线现场信息化（实习准备营 方向 4） | Modbus、西门子 S7、OPC UA、PROFINET、EtherNet/IP、工业网关、IO 点表、PLC、程序下载与联调、视觉检测、需求分级、驻场沟通 |
| K11 | 通用底座（实习准备营 通用底座） | 多表关联 JOIN、索引、慢查询、视图、存储过程、事务、Linux 排障、脚本错误处理 |

> K9 ~ K11 是随「实习准备营」新增的三块知识域（见下一节）。编号只增不改：新增机制一律续用
> 对应知识域的下一个编号，不要重排已有编号（存档与验收对账按编号走）。

## levels/index.json

```jsonc
{ "levels": [ { "chapter": 1, "file": "ch1.json" } ] }
```

加新章节：把 `chN.json` 放进 `levels/`，在 `index.json` 里加一行。**不需要动 src/ 下任何代码。**

## levels/chN.json（关卡文件）

```jsonc
{
  "chapter": 1,                  // 章节号，与 index.json 一致
  "title": "调研认知",
  "scene": "hongfa-factory/day-1", // 场景代号（界面展示用等宽字体）
  "knowledge_ids": ["K1-1"],     // 本章覆盖的知识点，验收对账用
  "story": [                     // 开场剧情段落；{{term_id}} 会渲染成可点开的术语标注
    "……{{work_order}}……"
  ],
  "stages": [ … ],               // 关卡数组，按顺序游玩，见下
  "result": {
    "progressReward": 15,        // 通关时「项目进度」仪表的增量
    "clearedText": "……",        // 通关剧情
    "nextChapterHint": "……",    // 下一章预告
    "rankTexts": {               // 总评分档位评语（结算页按 S/A/B/C 取对应文案）
      "S": "全对时的评语……",
      "A": "……", "B": "……", "C": "……"
    }
  }
}
```

**总评分规则**（代码内置，见 `src/game/settlement.ts` 的 `computeChapterScore`）：每条引语、每道抉择题、每个排序步骤都算一个判定点，得分 = 答对率 × 100（四舍五入）；档位 S ≥ 95、A ≥ 85、B ≥ 70、其余 C。**判定点按本局实际抽中的题量计算**（见下「题库与每局抽题」）。

## 题库与每局抽题（perRound）

match / quiz / fill 三种题型都是**题库制**：内容文件里放完整题库，`perRound` 配每局随机抽取的数量（缺省 = 全量上场）。进关时抽题定格，判定、计分、复习队列都只针对本局子集；重玩会抽到不同题目。

```jsonc
{
  "id": "match",
  "type": "match",
  "perRound": 12,        // 题库 18 条，每局随机抽 12 条上场
  ...
}
```

出题建议：**每局题量按「全量时代的三分之二」定基准**（连连看 12 条、抉择 3 题、填空 2 题），题库多出来的题用于每局轮换保鲜——题库越大，重玩撞题越少；match 各概念对应条数保持不均（防排除法数数）；sort 是完整流程**不抽题**（步骤缺一不可）。当前配置：ch1 match 41/12、quiz 12/3；ch2 match 34/11、quiz 11/3、fill 7/2；ch3 match 36/12、quiz 11/3、fill 7/2；ch4 match 25/12、quiz 11/3、fill 7/2（格式：题库/每局）。

### result.settlement：内容驱动的仪表结算（可选，第二章起推荐）

不写 `settlement` 时走第一章的默认规则（每错 1 处：数据准确率 -2、工人配合度 -1）。写了则完全按配置结算——**每章扣哪几项仪表、扣多重、文案怎么写，都由内容文件决定，不用改代码**：

```jsonc
"settlement": {
  "progressReward": 15,                 // 项目进度增量
  "progressReason": "完成主数据清洗……",  // 进度增加的展示原因
  "wrongPenalties": [                   // 每错 1 处的扣分项（可配多项）
    {
      "key": "dataAccuracy",            // GAUGE_DEFS 里的仪表 key
      "perWrong": -3,                   // 每错 1 处的增减值
      "reason": "看走眼 {n} 处：……",     // {n} 会被替换为总错误数
      "perfectReason": "一处没看走眼：……" // 全对时 delta=0 的展示原因
    }
  ]
}
```

### stage 类型一：match（连连看）

判断每条引语「在说哪个概念」。提交判定后，每条引语都会展示「你的选择 vs 正确答案」对照（错题的正确答案可直接点开术语卡），讲解同样全部来自内容文件。

```jsonc
{
  "id": "match",
  "type": "match",
  "title": "车间黑话连连看",
  "intro": "玩法说明……",
  "concepts": ["work_order", "bom"],   // 概念槽：terms.json 里的术语 id
  "quotes": [
    {
      "id": "q1",
      "text": "「师傅的原话……」",
      "answer": "work_order",          // 唯一正确概念（concepts 里的 id）
      "term_ids": ["work_order"],      // 答错时进复习队列的术语
      "feedback": {                    // 答错时的三句话讲解（固定结构）
        "factory": "现实工厂会怎样……",
        "data": "MES 数据会怎样……",
        "consultant": "顾问该怎么做……"
      }
    }
  ]
}
```

### stage 类型二：quiz（场景抉择，单选）

一次一题、提交后立即判定并内联展示三句话讲解（Duolingo 节奏）。放在 match 之后、sort 之前效果最好，但顺序完全由 `stages` 数组决定。

```jsonc
{
  "id": "quiz",
  "type": "quiz",
  "title": "调研现场抉择",
  "intro": "玩法说明……",
  "questions": [
    {
      "id": "z1",
      "prompt": "场景描述 + 问题……",
      "options": [                       // 至少 2 个，建议 4 个
        { "id": "o1", "text": "选项文案……" }
      ],
      "answer": "o1",                    // 正确选项 id，必须在 options 里
      "term_ids": ["data_quality"],      // 答错时进复习队列的术语
      "feedback": {                      // 三句话讲解，答对答错都展示
        "factory": "现实工厂会怎样……",
        "data": "MES 数据会怎样……",
        "consultant": "顾问该怎么做……"
      }
    }
  ]
}
```

### stage 类型三：judge（真假鉴定，自动衍生零手写）

**不需要写题目**：从指定的 match 题库自动衍生——每局随机抽 `perRound` 句引语，每句出两道判断题（正确配对答「对」+ 随机错误配对答「错」），打乱后逐题作答、即时判定。讲解复用引语自带的三句话 feedback；判错时额外点明「其实它在说 XX」。组合数 = 抽句组合 × 每句的错误配对选择，题库 29 句时单章变化上千种，**这是对抗「玩两三次就熟」的主力机制**。

```jsonc
{
  "id": "judge",
  "type": "judge",
  "title": "真假鉴定",
  "intro": "玩法说明……",
  "perRound": 6,              // 每局抽几句引语（每句衍生 2 题，6 句 = 12 题）
  "sourceStageId": "match"    // 素材来源的 match 关 id，缺省 "match"
}
```

### stage 类型四：fill（限时填空速答）

题干里用 `____`（四个下划线）挖空，玩家从选项里选词填入；每题倒计时（`secondsPerQuestion`，缺省 20 秒），归零未提交按未作答判错。题目结构与 quiz 完全相同（options/answer/term_ids/feedback），适合公式、口诀类的短句挖空：

```jsonc
{
  "id": "fill",
  "type": "fill",
  "title": "顾问口诀填空",
  "intro": "玩法说明……",
  "secondsPerQuestion": 20,
  "questions": [
    {
      "id": "f1",
      "prompt": "倒冲扣料 = 报工数量 × BOM 单耗 × (1 + ____)",
      "options": [ { "id": "o1", "text": "损耗率" } ],
      "answer": "o1",
      "term_ids": ["loss_rate", "backflush"],
      "feedback": { "factory": "……", "data": "……", "consultant": "……" }
    }
  ]
}
```

### stage 类型五：sort（流程排序）

`steps` 数组**按正确顺序书写**，页面加载时自动打乱。

```jsonc
{
  "id": "sort",
  "type": "sort",
  "title": "接单到入库",
  "intro": "玩法说明……",
  "maxAttempts": 2,                    // 最多提交次数，超过直接看正解
  "steps": [
    { "id": "s1", "text": "步骤描述", "note": "错位时展示：为什么它在这个位置" }
  ]
}
```

## 面试题库（public/content/interview/）

面试训练营的题目同样是内容驱动：`index.json` 登记六个难度档题库文件（intern/campus/social/exp1/exp2/exp3 = 实习/校招/社招/1年/2年/3年），**加题只改题库 JSON，不改代码**。

```jsonc
{
  "tier": "campus",
  "tierName": "校招",
  "tierHint": "这一档面试官重点看什么……",   // 组卷面板展示
  "questions": [
    {
      "id": "c-biz-1",               // 全库唯一（存档/复习队列按 id 记录）
      "type": "single",              // single 单选 | multiple 多选 | judge 判断 | short 简答自评
      "category": "biz",             // biz 实施业务 | data 数据主数据 | sql 数据库 | ops 服务器运维 | soft 项目软素质
      "prompt": "面试官口吻的场景题干……",
      "options": [ { "id": "o1", "text": "……" } ],  // single ≥2 项；multiple ≥3 项且至少 1 个干扰项；judge/short 留空数组
      "answer": "o1",                // single/judge 为字符串（judge 只能 yes/no）；multiple 为 id 数组；short 为空串
      "reference": "参考答案全文（≥40 字）",
      "bonus_points": ["加分点（每条 ≥6 字）"],
      "term_ids": ["work_order"],    // 关联术语卡；答错时进复习队列（可为空数组）
      "source_hint": "题目出处/考察点说明"
    }
  ]
}
```

计分规则（`src/game/interview.ts`）：每题等权；客观题对=1 错=0；简答按四档自评折算（没思路 0 / 答出一半 0.5 / 基本答全 0.8 / 完美 1）；总分=得分率×100，档位 S≥95/A≥85/B≥70/C，评语在 `index.json` 的 `rankTexts`。红线：题干必须是面试官口吻真实场景、reference 与 bonus_points 必填、多选题必须留干扰项——`src/content/__tests__/interview-quality.test.ts` 自动扫描全部题库文件把关。

## 厂型特训营（public/content/factory-types/）

厂型训练同样是内容驱动：`index.json` 登记三个厂型文件（discrete/flow/hybrid = 离散制造/流水线制造/混合型），**加厂型或加题只改 JSON，不改代码**。

```jsonc
// index.json
{ "types": [{ "type": "discrete", "file": "discrete.json" }], "rankTexts": { "S": "…", "A": "…", "B": "…", "C": "…" } }

// discrete.json —— 单个厂型全部内容
{
  "type": "discrete",                  // 与 index.json 一致，三档内唯一
  "typeName": "离散制造",
  "tagline": "一句画像（选卡页展示）",
  "industries": ["五金机加工"],         // 典型行业 chips
  "brief": [                           // 档案页翻页屏（≥3 屏，须含一屏踩坑案例）
    { "id": "organize", "title": "生产怎么组织", "body": "…（可含 {{term_id}} 术语标注）" },
    { "id": "survey",   "title": "调研必问清单", "items": ["…"] },
    { "id": "pitfalls", "title": "典型踩坑", "cases": [
      { "id": "p1", "scene": "…", "consequence": "…", "lesson": "…", "term_ids": ["…"] }
    ]}
  ],
  "quiz": {
    "perRound": 6,                     // 每局抽题数（≤题库量）
    "questions": [                     // 结构与关卡 quiz 题完全一致
      {
        "id": "d-q1",                  // 全库唯一，前缀 d-/f-/h- 区分厂型
        "prompt": "车间现场场景 + 问题（题干禁止出现答案术语字样）",
        "options": [ { "id": "o1", "text": "…" } ],   // ≥2 个，建议 4 个
        "answer": "o1",
        "term_ids": ["takt_time"],     // 答错进复习队列
        "feedback": { "factory": "…", "data": "…", "consultant": "…" }   // 三句话讲解，一个不能省
      }
    ]
  }
}
```

计分（`src/game/factory.ts`）：每题等权，答对得分；总分=得分率×100，档位与全站一致（S≥95/A≥85/B≥70/C），评语在 `index.json` 的 `rankTexts`。红线：三厂型题目严禁换皮——每题必须踩中该厂型的命门差异（离散=工单/工艺路线、流水线=节拍/批次、混合=衔接/口径）；term_ids 必须指向真实术语；`src/content/__tests__/factory-quality.test.ts` 自动扫描全部厂型文件把关。

## 运维训练营（public/content/ops-training/）

严肃向运维实操模块（非游戏化）：以 MES 为中心、ERP/WMS 为辅。`index.json` 登记四个训练域（linux/windows/cloud/integration），**加域或加训练项目只改 JSON，不改代码**。每个域文件的 `items` 里混排三种形式：

```jsonc
// index.json
{ "domains": [{ "domain": "linux", "file": "linux.json" }], "rankTexts": { "S": "…", "A": "…", "B": "…", "C": "…" } }

// linux.json —— 单个训练域全部内容
{
  "domain": "linux",
  "domainName": "Linux 服务器实操",
  "brief": "一段域简介（选域页展示）",
  "items": [
    {   // 形式一：terminal 终端演练（核心玩法，模拟终端逐步敲命令）
      "id": "lx-d1",                       // 全域唯一，前缀 lx-/win-/cloud-/int- 区分
      "kind": "terminal",
      "title": "磁盘打满：MES 采集服务停止写库",
      "difficulty": "入门", "minutes": 10,
      "ticket": { "background": "…", "symptom": "…", "objective": "…" },   // 事故工单三要素
      "prompt": "ops@mes-app-01:~$",       // 终端提示符（Windows 域用 PS C:\\Users\\ops>）
      "steps": [
        {
          "id": "s1",
          "objective": "本步目标（顶栏展示）",
          "accept": ["^df\\b"],            // 命中即推进的正则源串（JS RegExp，i 标志；禁用 (?i) 内联标志）
          "output": "命令命中后返回的模拟输出（逼真多行文本）",
          "hint": "提示按钮文案（计次扣分）",
          "explain": "推进后的「为什么这一步」讲解"
        }
      ],
      "ambient": [{ "pattern": "^pwd$", "output": "/home/ops" }],   // 可选：中性查询命令，真实感输出不计错
      "danger": [{ "pattern": "^rm\\b.*mes-collector\\.log", "output": "⛔ 拦截+后果讲解（≥20字）" }],  // 可选：域级危险命令教学，叠加全局表（rm -rf /、mkfs、shutdown、reboot、DROP TABLE、无 WHERE DELETE 等）
      "sop": ["df -h", "…"]                // 标准操作序列（演练报告回放，背下来照做）
    },
    {   // 形式二：choice 场景决策组（一次一题提交即判定，结构同关卡 quiz）
      "id": "lx-c1", "kind": "choice", "title": "…", "difficulty": "入门", "minutes": 12,
      "intro": "…",
      "questions": [{ "id": "lx-c1-q1", "prompt": "…", "options": [{ "id": "o1", "text": "…" }], "answer": "o1", "term_ids": [], "feedback": { "factory": "现场会怎样", "data": "系统与数据会怎样", "consultant": "运维该怎么做" } }]
    },
    {   // 形式三：order 处置流程排序（steps 按正确顺序书写，页面加载自动打乱）
      "id": "lx-o1", "kind": "order", "title": "…", "difficulty": "入门", "minutes": 6,
      "intro": "…", "maxAttempts": 2,
      "steps": [{ "id": "s1", "text": "步骤描述", "note": "错位时展示：为什么它在这个位置" }]
    }
  ]
}
```

计分（引擎在 `src/game/opsTerminal.ts`，纯函数）：terminal 满分 100，每次提示 -10、每次错误尝试/危险拦截 -5；choice 按答对率；order 第一次排对 100 / 第二次 80 / 看正解 60。档位与全站一致（S≥95/A≥85/B≥70/C）。红线：accept/ambient/danger 正则必须可编译（**JS 正则不支持 `(?i)` 内联标志**，引擎已统一加 i 标志）、工单三要素齐全、步骤 ≥2、决策题三句话讲解完整、排序步骤 ≥3 且每步带 note、term_ids 指向真实术语——`src/content/__tests__/ops-quality.test.ts` 自动扫描全部域文件把关，`src/pages/OpsTraining/__tests__/ops-flow.test.tsx` 是渲染级全流程冒烟（真敲命令走完 lx-d1）。

## 数据库实操营（public/content/db-training/）

严肃向 SQL 实操模块：所有任务在**真实执行环境**（内置 SQLite 练习库）里判分。`index.json` 登记四个任务组（query/join/clean/report），**加组或加任务只改 JSON，不改代码**：

```jsonc
// index.json
{ "groups": [{ "group": "query", "file": "query.json" }], "rankTexts": { "S": "…", "A": "…", "B": "…", "C": "…" } }

// query.json —— 单个任务组
{
  "group": "query",
  "groupName": "单表查询与业务口径",
  "brief": "组简介（总览页展示，≥10 字）",
  "tasks": [
    {
      "id": "db-q1",                    // 全库唯一，前缀 db-q/db-j/db-c/db-r 区分组
      "title": "月会拷问：这个月到底完工了多少张工单",
      "difficulty": "入门", "minutes": 6,
      "scene": "业务场景描述（实施顾问视角，≥10 字）",
      "goal": "明确目标：输出哪些列、怎么排序、取前几（判分依据，写清楚口径）",
      "starterSql": "-- 可选：起始 SQL 骨架提示",
      "check": {
        "mode": "result",               // result=比对用户 SQL 执行结果 | state=用户改库后跑校验 SQL 验证库状态
        "sql": "SELECT COUNT(*) AS n FROM work_orders WHERE status IN ('Completed','已完成','完成')",
        "expect": [[16]]                // 期望结果：二维数组（行×列），默认行序敏感
      },
      "answerSql": "…",                 // 参考答案（result 模式必须与 check.sql 结果一致）
      "hint": "提示按钮文案（计次扣分）",
      "explanation": "讲解：为什么这么写 + 实施现场的坑（≥20 字）",
      "term_ids": ["work_order"]        // 关联术语卡；未满分时进复习队列
    }
  ]
}
```

计分（`src/game/dbTraining.ts`）：任务分 = 第 1 次提交校验通过 100 / 第 2 次 80 / 第 3 次起或看答案 60，用过提示再 -10；组总分 = 任务平均，档位与全站一致。执行 SQL 不限次数不扣分（真实结果就是最好的反馈），只有「提交校验」计次。若题目规定排序但不规定相同排序键的先后，可在 `check` 中设置可选的 `unorderedTieColumns`（零基输出列索引，例如 `[2]`）：同键行可互换，组间排序和行内容仍严格校验。红线：check.expect 必须由 `node server/backfill-db-expect.mjs` 对着真实练习库算出回填（禁止手编数字）；result 模式 answerSql 执行结果必须与 check.sql 一致（脚本自动验证）；清洗组（clean）任务用 state 模式（db-c4 盘点查询除外）；term_ids 指向真实术语——`src/content/__tests__/db-quality.test.ts` 自动扫描把关。

**内置练习库种子**：`server/seed-practice-db.mjs`（确定性数据：固定种子伪随机，重置后断言稳定可复现；八张表 items/bom/work_orders/work_reports/inventory/sales_orders/employees/equipment，故意埋一物两码、单位混乱、状态口径不一、账实不符、编码尾部空格等典型脏数据）。改动种子数据后**必须重跑 backfill 脚本**刷新全部 expect。生成的 .db 文件在仓库外（/workspace/pocketbase-bin/lab-data/），不进 GitHub。

## 部署文档模板（public/content/ops-training/deploy-docs.json）

运维训练营·真实服务器模式的预置部署手册（Linux 环境初始化 / MySQL 演练库 / 采集服务 systemd 部署 / Prometheus+Grafana 监控）。每份文档 = markdown 正文 + 可选「一键部署命令序列」（每条 `{label, cmd}`，发送后逐条预览确认执行）。⚠️ 该文件与训练域文件同目录，`ops-quality.test.ts` 的 glob 扫描已显式跳过它；再加同目录非域文件同样要跳过。

## 实习准备营（public/content/career-prep/）

面向实习 / 校招实施岗的备考模块：三条学习路线（方向 1 工业软件实施与交付、方向 4 产线现场信息化、
通用底座），每条路线 = 知识卡 + 模拟面试题 + 流程排序题，答完出 S/A/B/C 评分与面试官评语。
内容文件放在 `public/content/career-prep/`，页面运行时加载（`src/content/careerPrep.ts`），
组卷与判分在 `src/game/careerPrep.ts`。

```
public/content/career-prep/
├── index.json        # 赛道清单 + 卷型配置 + 四档评语
├── direction1.json   # 方向 1 · 工业软件实施与交付
├── direction4.json   # 方向 4 · 产线现场信息化
└── base.json         # 通用底座
```

`index.json`：

```jsonc
{
  "tracks": [
    { "id": "direction1", "file": "direction1.json", "name": "方向 1 · …", "hint": "…" },
  ],
  "paperSizes": [ { "id": "full", "questionCount": 8, "orderCount": 1 } ],  // 卷型：抽多少题
  "rankTexts": { "S": "…", "A": "…", "B": "…", "C": "…" },                // 四档评语
}
```

赛道文件 `{trackId}.json`：

```jsonc
{
  "trackId": "direction1",
  "trackName": "方向 1 · 工业软件实施与交付",
  "subtitle": "…", "intro": "…",
  "cards": [   // 知识卡
    { "id": "c-erp", "title": "…", "summary": "…",
      "points": ["…", "…", "…"], "pitfalls": ["…"], "term_ids": ["erp"] }
  ],
  "questions": [   // 模拟面试题（单选 / 多选 / 判断 / 简答自评）
    { "id": "i-biz-4", "type": "single", "prompt": "…", "options": ["…", "…"],
      "answer": 0, "reference": "…", "bonus_points": ["…"], "term_ids": ["…"] }
  ],
  "orders": [   // 流程排序题：步骤全对才得分
    { "id": "o-impl", "title": "…", "intro": "…",
      "steps": [ { "id": "s1", "label": "…", "note": "…" } ] }
  ]
}
```

**红线**（由 `src/content/__tests__/career-quality.test.ts` 自动扫描全部赛道文件把关，
新增赛道文件会被自动发现，不用改测试）：
- 清单登记的赛道文件必须存在；赛道 id 与 `CAREER_TRACK_ORDER` 一致；
- `rankTexts` 四档齐全，每档不少于 10 字；
- 题目 id 全局唯一（存档与复习队列按 id 记录）；
- 每题 `reference` 不少于 60 字、`bonus_points` 至少 1 条且每条不少于 6 字（防空口套话）；
- `term_ids` 必须指向 `terms.json` 里真实存在的术语；
- 知识卡至少 3 条要点 + 1 条常见坑；
- 顺序题步骤 id 唯一且不少于 3 步；
- 顺序题必须全对才得分：判定会额外拒绝重复步骤与不在题面里的非法步骤。

## 约定与红线

- **每个机制必须挂知识点**：新增内容时 `knowledge_ids` / `term_ids` 必填，映射不到知识点的机制不要加。
- **题干禁止漏答案**：match/quiz/fill 的题干（引语、场景、挖空句）里**不得出现答案术语的字样**——问报工的题里写「报工单」等于把答案印在题面上。用车间大白话描述情境（「每天交上来一沓写着干了多少件的小纸条」），让玩家靠理解配对，不靠字面撞词。术语卡 `dialect` 与题干的对应关系是允许的学习线索，但答案术语本名不能出现。
- **一题只有一个可辩护的答案（唯一锚点法）**：出 match 题前先给每个概念定一个「唯一锚点」——题目情境只允许踩这个锚点，不得混入其他概念的锚点。第一章的锚点表：工单 = 贴在线上的任务指令（做多少/何时完）；报工 = 报数动作（人把干完的数量说出来/写条子）；库存 = 仓库的账（账面数 vs 实物、放哪个架子）；在制品 = 悬在两道工序中间、不属于任何仓；倒冲 = 发料不开单、事后按产量倒算扣料；工作中心 = 场地+人+设备（一天能干多少）；工艺路线 = 顺序不可乱跳。写完每题自查：「这句话是否也能解释成另一个概念？」（反例：「喷完漆的放半成品区」——完工动作像报工、「半成品」像在制品、「放区里」像入库，三重含糊；正解：只写「仓库的本子和货架」= 库存锚点）。两可的题必须重写到只剩一个合理答案，干扰项靠选项设计制造，不靠题干含糊制造。
- **答错必给三句话讲解**：`feedback.factory / data / consultant` 三个字段一个都不能省——游戏没有失败惩罚，只有「错误 → 现实后果 → 讲解」。
- **文案口径**：术语第一次出现必须在 `story` 或 `intro` 里用 `{{term_id}}` 标注；大白话放 `dialect`，别把定义写成教科书。
- id 全局唯一（quote id、step id、term id 各自命名空间内唯一即可），改内容别改已上线的 id——存档里的复习队列按 id 记录。
- 章节号必须与首页章节表（`src/content/chapters.ts`）对应；把 `playable` 置 true 的章节必须有同名关卡文件。
