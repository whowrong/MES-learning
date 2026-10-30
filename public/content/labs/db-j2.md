# 报工明星榜：谁干得最多

- 题目编号：`db-j2`
- 所属模块：数据库实操营 · 多表关联与数据断链
- 题目类型：数据库实操（真实数据库连接执行 SQL）
- 难度 / 建议时长：进阶 / 8 分钟
- 文档路径：`public/content/labs/db-j2.md`（站内地址 `/content/labs/db-j2.md`）

> 本文同时服务两类读者：人（讲清这道题在练什么、环境要求、步骤、验收、常见错法）与站内 AI（据此生成准备与执行脚本）。AI 生成的脚本一律先预览、再由用户确认执行。

> ⚠️ 本站演练会执行删除、重建、清库、杀进程、改防火墙、重启服务等破坏性操作。请只填**可破坏、演练专用**的数据库与服务器；生产环境、重要数据环境请勿填入。建议用一次性实例，或随时能从快照重建的环境。

## 1. 题目目标与业务背景

**目标**：输出 emp_name、team、报工次数 n、合格总数 ok 四列，按 n 降序取前 5。

**业务背景**：月底车间评产出标兵，要按人统计报工次数与合格数。报工记录 work_reports 里只有工号 employee_no，姓名和班组在 employees 表——计件工资和评优都靠这张关联查询。

## 2. 涉及的数据表或服务

- 涉及表：`work_reports`、`employees`
- 练习库结构：内置练习库共 8 张表（items / bom / employees / equipment / work_orders / work_reports / inventory / sales_orders），合计约 231 行；真实连库时按第 4 节的空间与数据量建议预置同量级数据。

## 3. 需要的账号与权限

- 只需要 SELECT 权限（只读账号即可作答）。
- 连接信息只保存在本站服务端（页面与仓库都不落明文密码），列表回显一律脱敏。

## 4. 环境要求（演练专用）

### 4.1 规格基线

- 数据库版本：MySQL 8.0.x / MariaDB 10.11 / PostgreSQL 15 及以上；站内内置练习库由 node:sqlite 提供，SQL 走 SQLite 兼容子集
- 最小表空间 / 数据量：数据库可用空间 ≥ 100 MB；数据量按内置练习库同量级预置（8 张表、约 231 行），单题新增脏数据 ≤ 200 行

> 规格出处：以下数值对齐已验证过的目标机 instabox dev 实测规格（4 vCPU / 7.8 GiB 内存、根分区 16 GB + 数据盘 20 GB、Debian GNU/Linux 13，内核 6.18，Docker 29.8 可用），最低配置按其一半左右给出，保证题目脚本与路径在演练机上跑得通。

### 4.2 额外要求

- 无额外要求：按题目用到的服务预置即可。

### 4.3 破坏性提示

> ⚠️ 本站演练会执行删除、重建、清库、杀进程、改防火墙、重启服务等破坏性操作。请只填**可破坏、演练专用**的数据库与服务器；生产环境、重要数据环境请勿填入。建议用一次性实例，或随时能从快照重建的环境。

## 5. 标准步骤

```sql
SELECT e.emp_name, e.team, COUNT(r.report_id) AS n, SUM(r.qty_ok) AS ok FROM work_reports r JOIN employees e ON r.employee_no = e.emp_no GROUP BY r.employee_no ORDER BY n DESC LIMIT 5
```

- 思路提示：GROUP BY 按工号分组（工号唯一），SELECT 里带出姓名班组；COUNT 数报工条数，SUM 加合格数
- 讲解：关联 + 分组聚合的组合拳。一个方言坑值得记住：GROUP BY r.employee_no 却 SELECT e.emp_name，SQLite 宽容放行，MySQL 开了 ONLY_FULL_GROUP_BY（5.7+ 默认）会直接报错，SQL Server 也要求 SELECT 的非聚合列都进 GROUP BY。写客户环境的 SQL 前先确认数据库方言，「在我机器上能跑」是实施现场最经典的翻车。

## 6. 验收标准（可机器判定）

判分方式：执行下面的校验 SQL，结果必须与期望值完全一致（列名与行序都算）。

```sql
SELECT e.emp_name, e.team, COUNT(r.report_id) AS n, SUM(r.qty_ok) AS ok FROM work_reports r JOIN employees e ON r.employee_no = e.emp_no GROUP BY r.employee_no ORDER BY n DESC LIMIT 5
```

- 期望结果：`[["杨建军","装配班",12,130],["钱秀英","装配班",10,91],["吴秀英","装配班",10,100],["韩秀英","电气班",8,52],["赵志强","装配班",6,69]]`

## 7. 常见错误与排查提示

- 常见错法：GROUP BY 按工号分组（工号唯一），SELECT 里带出姓名班组；COUNT 数报工条数，SUM 加合格数
- 为什么：关联 + 分组聚合的组合拳。一个方言坑值得记住：GROUP BY r.employee_no 却 SELECT e.emp_name，SQLite 宽容放行，MySQL 开了 ONLY_FULL_GROUP_BY（5.7+ 默认）会直接报错，SQL Server 也要求 SELECT 的非聚合列都进 GROUP BY。写客户环境的 SQL 前先确认数据库方言，「在我机器上能跑」是实施现场最经典的翻车。

## 8. AI 环境准备步骤（供站内 AI 生成准备脚本）

AI 应当按下面的顺序在**用户填写的演练环境**上生成准备脚本；每条命令都必须先预览、由用户确认后再执行，命中站内危险命令清单的一律二次确认。

- 确认连接可达：先跑一条只读查询（如 `SELECT 1`）确认账号、库名、网络都通。
- 确认目标表存在且结构一致：跑 `SHOW COLUMNS` / `\d` 之类只读命令核对字段名与类型。
- 预置脏数据：按本题的场景补齐需要的脏数据行（脏值、多写法状态值、尾部空格等），并记录补了多少行以便回滚。
- 记录基线：把关键表的行数与关键汇总值（本题校验 SQL 的期望值）先查一遍存下来，作为回滚与验收基准。

## 9. AI 执行脚本要点（供站内 AI 生成执行脚本）

- 先跑只读校验：`SELECT e.emp_name, e.team, COUNT(r.report_id) AS n, SUM(r.qty_ok) AS ok FROM work_reports r JOIN employees e ON r.employee_no = e.emp_no GROUP BY r.employee_no ORDER BY n DESC LIMIT 5`
- 再跑用户的作答 SQL，并把结果与校验 SQL 的期望值比对；不一致要指出差在哪一行、差多少。
- 涉及写操作（UPDATE/DELETE）时，先用 SELECT 预览受影响的行数，确认行数与预期一致再提交。

## 10. 安全边界与失败处理

- 只在用户自己提供的演练环境上执行；不连接任何生产实例，也不改动本站服务端配置。
- 生成的脚本一律先给出预览，用户确认后才执行；危险命令走站内既有拦截清单与二次确认。
- 失败处理：上游模型不可用 → 明确提示「AI 暂时不可用」，并保留手工执行入口；文档缺失 → 明确提示「该题文档缺失」；命令执行失败 → 原样回显报错行并停止该步；环境不符（例如题目要求 MySQL 却连的是 PostgreSQL）→ 在执行前就提示不匹配，不静默继续。
- 本题涉及的判分一律以第 6 节的机器判据为准，不采信模型自述的「已完成」。

