# SQL Server 起不来：MES/ERP 共库早班告急

- 题目编号：`win-d2`
- 所属模块：运维实操营 · Windows 服务器运维
- 题目类型：运维实操（终端实操，真实服务器执行命令）
- 难度 / 建议时长：进阶 / 15 分钟
- 文档路径：`public/content/labs/win-d2.md`（站内地址 `/content/labs/win-d2.md`）

> 本文同时服务两类读者：人（讲清这道题在练什么、环境要求、步骤、验收、常见错法）与站内 AI（据此生成准备与执行脚本）。AI 生成的脚本一律先预览、再由用户确认执行。

> ⚠️ 本站演练会执行删除、重建、清库、杀进程、改防火墙、重启服务等破坏性操作。请只填**可破坏、演练专用**的数据库与服务器；生产环境、重要数据环境请勿填入。建议用一次性实例，或随时能从快照重建的环境。

## 1. 题目目标与业务背景

**目标**：找到 SQL Server 无法启动的根因并恢复，验证业务连接，全程保住数据安全。

**背景**：小厂典型架构：MES 与 ERP 共用一台 Windows Server 上的 SQL Server 2016，数据文件与备份都在 D 盘。

**现象**：早班 07:30，MES 与 ERP 客户端同时报「无法连接数据库」，服务列表里 SQL Server 处于停止状态。

## 2. 涉及的数据表或服务

- SQL Server 服务（MSSQLSERVER）
- D 盘数据/日志文件与历史备份
- E 盘归档目录
- MES / ERP 业务库

## 3. 需要的账号与权限

- SQL Server 服务管理权限 + 磁盘与目录读写权限；演练数据库账号需能查 MES 核心表
- SSH 私钥 / 口令只保存在本站服务端，不进仓库、不进文档。

## 4. 环境要求（演练专用）

### 4.1 规格基线

- 演练服务器最低配置：2 vCPU / 2 GB 内存 / 20 GB 可用磁盘（其中日志分区 ≥ 2 GB）；Debian 12 或 Ubuntu 22.04 及以上，需 systemd
- 演练服务器推荐配置：4 vCPU / 4–8 GB 内存 / 40 GB 可用磁盘（日志分区 ≥ 10 GB）；Debian 13 或 Ubuntu 24.04，Docker 29 可用
- 系统版本：Windows Server 2019/2022 + SQL Server 2019/2022（Developer 版即可）

> 规格出处：以下数值对齐已验证过的目标机 instabox dev 实测规格（4 vCPU / 7.8 GiB 内存、根分区 16 GB + 数据盘 20 GB、Debian GNU/Linux 13，内核 6.18，Docker 29.8 可用），最低配置按其一半左右给出，保证题目脚本与路径在演练机上跑得通。

### 4.2 额外要求

- D 盘可用空间 < 1 GB（模拟空间耗尽），E 盘空间充足且可写
- D 盘预置若干超期 .bak 历史备份，用于「迁移到 E 盘而不是删除」
- SQL Server ERRORLOG 中预置一条因空间不足导致的启动失败记录

### 4.3 破坏性提示

> ⚠️ 本站演练会执行删除、重建、清库、杀进程、改防火墙、重启服务等破坏性操作。请只填**可破坏、演练专用**的数据库与服务器；生产环境、重要数据环境请勿填入。建议用一次性实例，或随时能从快照重建的环境。

## 5. 标准步骤

| # | 目标 | 参考动作 |
| --- | --- | --- |
| s1 | 确认 SQL Server 服务当前状态 | Get-Service MSSQLSERVER。如果直接 Start-Service 起不来，别反复硬试，先去看它的错误日志。 |
| s2 | 读 SQL Server 自己的 ERRORLOG，找启动失败的确切原因 | SQL Server 的启动日志在它自己的安装目录 MSSQL\Log\ERRORLOG，Get-Content -Tail 40 看最后几十行；Windows 事件查看器里也有对应条目。 |
| s3 | 确认 D 盘空间现状 | Get-PSDrive -PSProvider FileSystem 列出各盘用量。 |
| s4 | 找出 D 盘上的大文件，确认哪些是可迁移的历史备份 | Get-ChildItem D:\backup | Sort Length -Descending 看最大的几个文件，注意文件名里的日期。 |
| s5 | 把超期备份迁移到 E 归档盘（不是删除） | Move-Item 源 目标——注意是「移动」不是 Remove-Item「删除」。超期备份先归档，确认归档完整后才轮到删除，那是另一天的事。 |
| s6 | 空间就位，启动 SQL Server 服务 | Start-Service MSSQLSERVER。启动大型实例要经历崩溃恢复，等它几十秒是正常的，不要中途再 kill。 |
| s7 | 验证数据库真正可用：查询 MES 核心业务表 | sqlcmd -S localhost -Q "SELECT ..." 直接跑业务查询，连通性和数据一起验证。 |

每一步的判定命令见第 6 节的验收正则。

## 6. 验收标准（可机器判定）

判分方式：终端实操逐条比对命令正则（任一条命中即通过该步），最终按通过步数给出评级。

| # | 步骤目标 | 命中的命令正则 |
| --- | --- | --- |
| s1 | 确认 SQL Server 服务当前状态 | `^Get-Service\s+MSSQL` 或 `^sc\s+query\s+MSSQL` 或 `^net\s+start(\s|$)` |
| s2 | 读 SQL Server 自己的 ERRORLOG，找启动失败的确切原因 | `^Get-Content\b.*ERRORLOG` 或 `^Get-EventLog\b.*Application` 或 `^Get-WinEvent\b` |
| s3 | 确认 D 盘空间现状 | `^Get-PSDrive\b` 或 `^Get-WmiObject\b.*LogicalDisk` 或 `^Get-CimInstance\b.*LogicalDisk` 或 `^wmic\s+logicaldisk` |
| s4 | 找出 D 盘上的大文件，确认哪些是可迁移的历史备份 | `^Get-ChildItem\b.*(D:|backup)` 或 `^dir\b.*(D:|backup)` |
| s5 | 把超期备份迁移到 E 归档盘（不是删除） | `^Move-Item\b` |
| s6 | 空间就位，启动 SQL Server 服务 | `^Start-Service\s+MSSQL` 或 `^net\s+start\s+MSSQL` |
| s7 | 验证数据库真正可用：查询 MES 核心业务表 | `^sqlcmd\b` 或 `^Invoke-Sqlcmd\b` 或 `^Test-NetConnection\b` |

## 7. 常见错误与排查提示

- 确认 SQL Server 服务当前状态：Get-Service MSSQLSERVER。如果直接 Start-Service 起不来，别反复硬试，先去看它的错误日志。
- 要点：服务「启动后立即停止」说明不是没配自启，而是启动过程中遇到致命错误。反复点启动只会反复失败，下一步是取证。
- 读 SQL Server 自己的 ERRORLOG，找启动失败的确切原因：SQL Server 的启动日志在它自己的安装目录 MSSQL\Log\ERRORLOG，Get-Content -Tail 40 看最后几十行；Windows 事件查看器里也有对应条目。
- 要点：根因一目了然：D 盘满了，tempdb 无法扩展，SQL Server 启动即自杀。凌晨 3 点发生——大概率是凌晨备份任务把盘写满的。
- 确认 D 盘空间现状：Get-PSDrive -PSProvider FileSystem 列出各盘用量。
- 要点：D 盘 400G 只剩 20M。注意 E 归档盘还有 112G——处置思路有了：把该挪的挪走，而不是硬删。
- 找出 D 盘上的大文件，确认哪些是可迁移的历史备份：Get-ChildItem D:\backup | Sort Length -Descending 看最大的几个文件，注意文件名里的日期。
- 要点：三份 9 月底到 10 月初的全备早已超出「留 2 周」策略（今天是 10-21），214 个日志备份也远超 3 天。可迁移空间约 200G，不用删任何东西就能救活 D 盘。
- 把超期备份迁移到 E 归档盘（不是删除）：Move-Item 源 目标——注意是「移动」不是 Remove-Item「删除」。超期备份先归档，确认归档完整后才轮到删除，那是另一天的事。
- 要点：备份是 RPO 的最后一道防线。空间告急时的正确动作是迁移归档，不是就地删除——删除的唯一前提是确认另一份副本已在异地/归档盘完好存在。
- 空间就位，启动 SQL Server 服务：Start-Service MSSQLSERVER。启动大型实例要经历崩溃恢复，等它几十秒是正常的，不要中途再 kill。
- 要点：非正常关闭后 SQL Server 启动时要跑恢复流程（重做已提交、回滚未提交事务），实例越大越久。Agent 也要确认 Running——备份作业、告警作业全靠它调度。
- 验证数据库真正可用：查询 MES 核心业务表：sqlcmd -S localhost -Q "SELECT ..." 直接跑业务查询，连通性和数据一起验证。
- 要点：连接成功且业务表可查才算恢复完成。注意查询暴露的业务问题：故障期间报工断档，要立刻通知车间纸质记录补录，并检查 MES→ERP 接口有没有积压——数据库恢复只是第一步。
- 直接删 .bak 释放空间：题目要求迁移归档而不是删除，数据安全优先
- 不读 ERRORLOG 就猜原因：启动失败的确切原因写在 SQL Server 自己的日志里

## 8. AI 环境准备步骤（供站内 AI 生成准备脚本）

AI 应当按下面的顺序在**用户填写的演练环境**上生成准备脚本；每条命令都必须先预览、由用户确认后再执行，命中站内危险命令清单的一律二次确认。

- 记录基线：D/E 盘可用空间、SQL Server 服务状态、ERRORLOG 尾部、备份文件清单与大小
- 造故障：把 D 盘可用空间压到 1 GB 以下，并把 SQL Server 置为停止状态
- 记录回滚点：待迁移备份文件清单与目标路径

## 9. AI 执行脚本要点（供站内 AI 生成执行脚本）

- 先确认 SQL Server 服务状态，再读 ERRORLOG 找启动失败的确切原因
- 查 D 盘空间（Get-PSDrive / dir），再定位 D 盘大文件，区分历史备份与在用数据文件
- 把超期备份迁移到 E 盘（Move-Item，不是 Remove-Item）
- 空间就位后启动 SQL Server 服务，用业务库查询验证 MES 核心表可读
- 验收正则覆盖：服务状态 / ERRORLOG / 磁盘空间 / 迁移 / 启动 / 业务查询

## 10. 安全边界与失败处理

- 只在用户自己提供的演练环境上执行；不连接任何生产实例，也不改动本站服务端配置。
- 生成的脚本一律先给出预览，用户确认后才执行；危险命令走站内既有拦截清单与二次确认。
- 失败处理：上游模型不可用 → 明确提示「AI 暂时不可用」，并保留手工执行入口；文档缺失 → 明确提示「该题文档缺失」；命令执行失败 → 原样回显报错行并停止该步；环境不符（例如题目要求 MySQL 却连的是 PostgreSQL）→ 在执行前就提示不匹配，不静默继续。
- 本题涉及的判分一律以第 6 节的机器判据为准，不采信模型自述的「已完成」。

