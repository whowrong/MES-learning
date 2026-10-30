# ERP 计件工资没更新：消息队列积压排查

- 题目编号：`int-d1`
- 所属模块：运维实操营 · MES/ERP/WMS 集成排障
- 题目类型：运维实操（终端实操，真实服务器执行命令）
- 难度 / 建议时长：进阶 / 15 分钟
- 文档路径：`public/content/labs/int-d1.md`（站内地址 `/content/labs/int-d1.md`）

> 本文同时服务两类读者：人（讲清这道题在练什么、环境要求、步骤、验收、常见错法）与站内 AI（据此生成准备与执行脚本）。AI 生成的脚本一律先预览、再由用户确认执行。

> ⚠️ 本站演练会执行删除、重建、清库、杀进程、改防火墙、重启服务等破坏性操作。请只填**可破坏、演练专用**的数据库与服务器；生产环境、重要数据环境请勿填入。建议用一次性实例，或随时能从快照重建的环境。

## 1. 题目目标与业务背景

**目标**：沿「源头 → 中间件 → 消费端」链路定位中断点，恢复消费、消化积压，并完成端到端对账验证。

**背景**：MES 与 ERP 之间通过 RabbitMQ 中间件异步集成：MES 报工后往队列 mes_to_erp 投消息，ERP 侧桥接服务（erp-bridge）消费消息生成计件工资与入库凭证。

**现象**：财务反馈 ERP 计件工资两天没更新，但车间 MES 报工一切正常、页面查询数据都在。

## 2. 涉及的数据表或服务

- MES 报工服务与 MES 业务库
- RabbitMQ（mes_to_erp 队列）
- erp-bridge（ERP 侧消费服务）

## 3. 需要的账号与权限

- 需要 sudo 管理 erp-bridge 服务、查看 RabbitMQ 队列；RabbitMQ 管理账号需能查看队列与消费者
- SSH 私钥 / 口令只保存在本站服务端，不进仓库、不进文档。

## 4. 环境要求（演练专用）

### 4.1 规格基线

- 演练服务器最低配置：2 vCPU / 2 GB 内存 / 20 GB 可用磁盘（其中日志分区 ≥ 2 GB）；Debian 12 或 Ubuntu 22.04 及以上，需 systemd
- 演练服务器推荐配置：4 vCPU / 4–8 GB 内存 / 40 GB 可用磁盘（日志分区 ≥ 10 GB）；Debian 13 或 Ubuntu 24.04，Docker 29 可用
- 系统版本：Debian GNU/Linux 12/13 或 Ubuntu 22.04/24.04（systemd + bash + coreutils）

> 规格出处：以下数值对齐已验证过的目标机 instabox dev 实测规格（4 vCPU / 7.8 GiB 内存、根分区 16 GB + 数据盘 20 GB、Debian GNU/Linux 13，内核 6.18，Docker 29.8 可用），最低配置按其一半左右给出，保证题目脚本与路径在演练机上跑得通。

### 4.2 额外要求

- 预置 RabbitMQ 实例与 mes_to_erp 队列，制造 ≥ 100 条积压消息
- 预置 ERP 应用侧服务 erp-bridge.service（退出状态）与其日志目录
- MES 业务库可读，用于验证源头数据正常

### 4.3 破坏性提示

> ⚠️ 本站演练会执行删除、重建、清库、杀进程、改防火墙、重启服务等破坏性操作。请只填**可破坏、演练专用**的数据库与服务器；生产环境、重要数据环境请勿填入。建议用一次性实例，或随时能从快照重建的环境。

## 5. 标准步骤

| # | 目标 | 参考动作 |
| --- | --- | --- |
| s1 | 先验证源头：确认 MES 侧报工数据正常落库（划定排查边界） | mysql -e "SELECT COUNT(*) FROM mes.reporting WHERE ..." 直接查 MES 库近两天的报工条数。 |
| s2 | 确认中间件 RabbitMQ 服务本身活着 | systemctl status rabbitmq-server 或 rabbitmq-diagnostics check_running。 |
| s3 | 查 mes_to_erp 队列的积压量与消费者数量 | rabbitmqctl list_queues name messages consumers，重点看 mes_to_erp 的 messages 和 consumers 两列。 |
| s4 | 到 ERP 应用服务器上确认 erp-bridge 服务状态 | systemctl status erp-bridge——注意它跑在 ERP 应用服务器上，跨机器排查。 |
| s5 | 翻 erp-bridge 日志，找它退出的根本原因 | journalctl -u erp-bridge -n 60，把服务死亡时间前后的日志连起来读，注意连接池报错。 |
| s6 | 重启 erp-bridge，恢复消费能力 | systemctl restart erp-bridge，起来后看日志确认它连上了 MQ 并开始消费。 |
| s7 | 确认积压在消化，并抽一笔报工单在 ERP 端对账验证 | 再看一次 list_queues 确认 messages 在下降、consumers=1，然后抽一笔具体报工单号到 ERP 库查凭证。 |

每一步的判定命令见第 6 节的验收正则。

## 6. 验收标准（可机器判定）

判分方式：终端实操逐条比对命令正则（任一条命中即通过该步），最终按通过步数给出评级。

| # | 步骤目标 | 命中的命令正则 |
| --- | --- | --- |
| s1 | 先验证源头：确认 MES 侧报工数据正常落库（划定排查边界） | `^mysql\b.*-e` 或 `^curl\b.*(mes|8080)` |
| s2 | 确认中间件 RabbitMQ 服务本身活着 | `^systemctl\s+status\s+rabbitmq` 或 `^rabbitmq-diagnostics\s+(status|check_running)` 或 `^rabbitmqctl\s+status` |
| s3 | 查 mes_to_erp 队列的积压量与消费者数量 | `^rabbitmqctl\s+list_queues` 或 `^rabbitmq-diagnostics\s+list_queues` |
| s4 | 到 ERP 应用服务器上确认 erp-bridge 服务状态 | `^systemctl\s+status\s+erp-bridge` 或 `^ps\b.*erp-bridge` 或 `^ssh\b` |
| s5 | 翻 erp-bridge 日志，找它退出的根本原因 | `^journalctl\b.*erp-bridge` 或 `^tail\b.*bridge` |
| s6 | 重启 erp-bridge，恢复消费能力 | `^systemctl\s+(restart|start)\s+erp-bridge` |
| s7 | 确认积压在消化，并抽一笔报工单在 ERP 端对账验证 | `^rabbitmqctl\s+list_queues` 或 `^mysql\b.*erp` 或 `^curl\b.*erp` |

## 7. 常见错误与排查提示

- 先验证源头：确认 MES 侧报工数据正常落库（划定排查边界）：mysql -e "SELECT COUNT(*) FROM mes.reporting WHERE ..." 直接查 MES 库近两天的报工条数。
- 要点：集成排障第一原则：先分段定界，别一上来就翻中间件。源头数据在，说明问题被夹在「MES 出口 → 队列 → ERP 入口」之间，排查范围立刻缩小三分之二。
- 确认中间件 RabbitMQ 服务本身活着：systemctl status rabbitmq-server 或 rabbitmq-diagnostics check_running。
- 要点：中间件进程活着。但「进程活着」不等于「链路健康」——队列积压、消费者掉线都发生在进程之下，下一步看队列内部。
- 查 mes_to_erp 队列的积压量与消费者数量：rabbitmqctl list_queues name messages consumers，重点看 mes_to_erp 的 messages 和 consumers 两列。
- 要点：铁证：mes_to_erp 积压 4521 条、消费者为 0——消息进得来、没人消费。其它队列消费者正常，进一步锁定：是 ERP 侧的桥接服务掉线了。
- 到 ERP 应用服务器上确认 erp-bridge 服务状态：systemctl status erp-bridge——注意它跑在 ERP 应用服务器上，跨机器排查。
- 要点：消费者两天前就死了，和财务说的「两天没更新」严丝合缝。而且死亡时间 03:14 是凌晨——那个时段通常跑批处理，方向指向夜间作业对数据库做了什么。
- 翻 erp-bridge 日志，找它退出的根本原因：journalctl -u erp-bridge -n 60，把服务死亡时间前后的日志连起来读，注意连接池报错。
- 要点：根因链完整了：凌晨 ERP 数据库重启升级 → 桥接服务连接池耗尽 → 消费线程崩溃 → 服务没有自动重连逻辑，一死就是两天。技术根因之外还有管理根因：数据库重启没人通知接口运维，服务死亡没有告警。
- 重启 erp-bridge，恢复消费能力：systemctl restart erp-bridge，起来后看日志确认它连上了 MQ 并开始消费。
- 要点：服务起来且日志明确「开始消费 4521 条」才算恢复。积压消息会被顺序消化——这也检验了当初的架构设计：异步队列保证了 MES 侧在 ERP 挂掉期间照常生产，数据一条没丢。
- 确认积压在消化，并抽一笔报工单在 ERP 端对账验证：再看一次 list_queues 确认 messages 在下降、consumers=1，然后抽一笔具体报工单号到 ERP 库查凭证。
- 要点：验证分两层：技术指标（积压下降）+ 业务对账（单笔单据两边一致）。只看不报错不代表数据对了——对账才是集成运维的灵魂。收尾整改：桥接服务加自动重连、加「消费者=0 持续 5 分钟」告警、数据库变更通知接口负责人进流程。
- 直接 purge 队列把积压清掉：站内危险命令清单会拦截，数据对不上就没法追责
- 不先验证源头就怀疑 MES：MES 报工正常，问题在链路后半段

## 8. AI 环境准备步骤（供站内 AI 生成准备脚本）

AI 应当按下面的顺序在**用户填写的演练环境**上生成准备脚本；每条命令都必须先预览、由用户确认后再执行，命中站内危险命令清单的一律二次确认。

- 记录基线：MES 报工表最新记录数、RabbitMQ 队列深度与消费者数、erp-bridge 服务状态
- 造故障：停止 erp-bridge 并往队列灌入 ≥ 100 条消息制造积压
- 记录回滚点：队列名与积压基线数

## 9. AI 执行脚本要点（供站内 AI 生成执行脚本）

- 先验证源头：查 MES 报工数据是否正常落库，划定排查边界
- 确认 RabbitMQ 服务活着，再查 mes_to_erp 队列积压量与消费者数量
- 到 ERP 侧确认 erp-bridge 服务状态并翻它的日志找退出根因
- 重启 erp-bridge 恢复消费，确认积压在下降
- 端到端对账：抽一笔报工单在 ERP 端核对
- 验收正则覆盖：源头查询 / 服务状态 / 队列查询 / 日志查看 / 重启 / 积压下降 / 对账

## 10. 安全边界与失败处理

- 只在用户自己提供的演练环境上执行；不连接任何生产实例，也不改动本站服务端配置。
- 生成的脚本一律先给出预览，用户确认后才执行；危险命令走站内既有拦截清单与二次确认。
- 失败处理：上游模型不可用 → 明确提示「AI 暂时不可用」，并保留手工执行入口；文档缺失 → 明确提示「该题文档缺失」；命令执行失败 → 原样回显报错行并停止该步；环境不符（例如题目要求 MySQL 却连的是 PostgreSQL）→ 在执行前就提示不匹配，不静默继续。
- 本题涉及的判分一律以第 6 节的机器判据为准，不采信模型自述的「已完成」。

