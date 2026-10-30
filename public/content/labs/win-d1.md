# IIS 站点 503：MES 应用程序池崩溃取证

- 题目编号：`win-d1`
- 所属模块：运维实操营 · Windows 服务器运维
- 题目类型：运维实操（终端实操，真实服务器执行命令）
- 难度 / 建议时长：进阶 / 12 分钟
- 文档路径：`public/content/labs/win-d1.md`（站内地址 `/content/labs/win-d1.md`）

> 本文同时服务两类读者：人（讲清这道题在练什么、环境要求、步骤、验收、常见错法）与站内 AI（据此生成准备与执行脚本）。AI 生成的脚本一律先预览、再由用户确认执行。

> ⚠️ 本站演练会执行删除、重建、清库、杀进程、改防火墙、重启服务等破坏性操作。请只填**可破坏、演练专用**的数据库与服务器；生产环境、重要数据环境请勿填入。建议用一次性实例，或随时能从快照重建的环境。

## 1. 题目目标与业务背景

**目标**：取证定位应用程序池崩溃原因，恢复 MES 站点，并做防复发处置。全程不影响同机其它站点。

**背景**：MES Web 站点（.NET）跑在 Windows Server 2016 的 IIS 上，应用程序池 MESPool，同机还挂着 OA 和报表两个站点。

**现象**：车间浏览器访问 MES 全部返回 503 Service Unavailable，OA 正常。

## 2. 涉及的数据表或服务

- IIS（MES 站点 + MESPool 应用程序池）
- 同机其它站点（OA 等，必须保持正常）
- Windows 事件日志

## 3. 需要的账号与权限

- 本机管理员（或 IIS 管理 + 事件日志读取 + 服务管理权限）
- SSH 私钥 / 口令只保存在本站服务端，不进仓库、不进文档。

## 4. 环境要求（演练专用）

### 4.1 规格基线

- 演练服务器最低配置：2 vCPU / 2 GB 内存 / 20 GB 可用磁盘（其中日志分区 ≥ 2 GB）；Debian 12 或 Ubuntu 22.04 及以上，需 systemd
- 演练服务器推荐配置：4 vCPU / 4–8 GB 内存 / 40 GB 可用磁盘（日志分区 ≥ 10 GB）；Debian 13 或 Ubuntu 24.04，Docker 29 可用
- 系统版本：Windows Server 2019/2022，IIS 角色已安装，PowerShell 5.1 及以上

> 规格出处：以下数值对齐已验证过的目标机 instabox dev 实测规格（4 vCPU / 7.8 GiB 内存、根分区 16 GB + 数据盘 20 GB、Debian GNU/Linux 13，内核 6.18，Docker 29.8 可用），最低配置按其一半左右给出，保证题目脚本与路径在演练机上跑得通。

### 4.2 额外要求

- 预置 MES 站点与 MESPool 应用程序池，以及一个正常站点（用于验证不影响同机其它站点）
- Windows 事件日志中预置一条 MESPool 被回收/崩溃的记录（Application 日志）
- 预置 MESPool 回收设置可被修改（定时回收配置）

### 4.3 破坏性提示

> ⚠️ 本站演练会执行删除、重建、清库、杀进程、改防火墙、重启服务等破坏性操作。请只填**可破坏、演练专用**的数据库与服务器；生产环境、重要数据环境请勿填入。建议用一次性实例，或随时能从快照重建的环境。

## 5. 标准步骤

| # | 目标 | 参考动作 |
| --- | --- | --- |
| s1 | 查看 IIS 站点与应用程序池状态，确认故障层级 | PowerShell 里 Get-Website 看站点，Get-WebAppPoolState -Name MESPool 看应用程序池。 |
| s2 | 翻应用程序事件日志，找 MESPool 被停掉的原因 | Get-EventLog -LogName Application -Newest 30 过滤 WAS / W3SVC 来源，Windows 的服务级故障都记在这里。 |
| s3 | 确认系统层没有连带异常（磁盘/硬件/其它服务） | Get-EventLog -LogName System -Newest 20，确认 System 日志里没有 Error 级硬件或磁盘事件。 |
| s4 | 看整机内存压力与占用大户，评估 OOM 的外部因素 | Get-Process | Sort-Object WorkingSet64 -Descending | Select -First 5 按内存倒序看大户。 |
| s5 | 只启动 MES 的应用程序池，恢复站点 | Start-WebAppPool -Name MESPool。注意：不要用 iisreset，那会连累同机的 OA 和报表站点。 |
| s6 | 本机验证 MES 页面真正可访问 | Invoke-WebRequest -Uri http://localhost/login.aspx -UseBasicParsing 本机探活。 |
| s7 | 防复发：给 MESPool 配定时回收，避开高峰自动换新进程 | Set-ItemProperty 修改 IIS: 提供程序下 MESPool 的回收配置（recycling.periodicRestart）。 |

每一步的判定命令见第 6 节的验收正则。

## 6. 验收标准（可机器判定）

判分方式：终端实操逐条比对命令正则（任一条命中即通过该步），最终按通过步数给出评级。

| # | 步骤目标 | 命中的命令正则 |
| --- | --- | --- |
| s1 | 查看 IIS 站点与应用程序池状态，确认故障层级 | `^Get-Website\b` 或 `^Get-WebAppPoolState\b` 或 `^Get-ChildItem\s+IIS:` 或 `^appcmd\s+list` |
| s2 | 翻应用程序事件日志，找 MESPool 被停掉的原因 | `^Get-EventLog\b.*Application` 或 `^Get-WinEvent\b.*Application` |
| s3 | 确认系统层没有连带异常（磁盘/硬件/其它服务） | `^Get-EventLog\b.*System` 或 `^Get-WinEvent\b.*System` |
| s4 | 看整机内存压力与占用大户，评估 OOM 的外部因素 | `^Get-Process\b` 或 `^Get-CimInstance\b.*OperatingSystem` 或 `^systeminfo\b` |
| s5 | 只启动 MES 的应用程序池，恢复站点 | `^Start-WebAppPool\b` 或 `^Restart-WebAppPool\b` |
| s6 | 本机验证 MES 页面真正可访问 | `^Invoke-WebRequest\b` 或 `^Invoke-RestMethod\b` 或 `^curl\b` |
| s7 | 防复发：给 MESPool 配定时回收，避开高峰自动换新进程 | `^Set-ItemProperty\b` 或 `^Set-WebConfigurationProperty\b` 或 `^appcmd\s+set\b` |

## 7. 常见错误与排查提示

- 查看 IIS 站点与应用程序池状态，确认故障层级：PowerShell 里 Get-Website 看站点，Get-WebAppPoolState -Name MESPool 看应用程序池。
- 要点：站点 Started 但应用程序池 Stopped——503 的直接原因找到了：w3wp 工作进程没了。且只有 MESPool 挂，说明是 MES 自身问题，不是 IIS 全局故障。
- 翻应用程序事件日志，找 MESPool 被停掉的原因：Get-EventLog -LogName Application -Newest 30 过滤 WAS / W3SVC 来源，Windows 的服务级故障都记在这里。
- 要点：两层信息：直接原因是 w3wp 反复 OutOfMemoryException；IIS 的「快速故障保护」在 5 分钟 5 次失败后自动禁用了池子，防止无限崩溃循环。这是保护机制，不是故障本身。
- 确认系统层没有连带异常（磁盘/硬件/其它服务）：Get-EventLog -LogName System -Newest 20，确认 System 日志里没有 Error 级硬件或磁盘事件。
- 要点：排障要区分「局部病」和「全身病」：System 日志干净，确认问题局限在 MES 应用自身的内存，不用怀疑宿主机。
- 看整机内存压力与占用大户，评估 OOM 的外部因素：Get-Process | Sort-Object WorkingSet64 -Descending | Select -First 5 按内存倒序看大户。
- 要点：8G 机器上 OA 池 3.9G + SQL Server 1.8G，MES 的 w3wp 崩溃前吃到 4.1G——三个大胃王挤一台机器，MES 先被挤死。根因是应用内存泄漏或报表未分页，宿主机容量也偏紧。
- 只启动 MES 的应用程序池，恢复站点：Start-WebAppPool -Name MESPool。注意：不要用 iisreset，那会连累同机的 OA 和报表站点。
- 要点：快速故障保护禁用后必须手动 Start-WebAppPool 重新启用。只动目标池，OA 和报表全程无感——生产服务器上「影响面最小化」优先于「操作省事」。
- 本机验证 MES 页面真正可访问：Invoke-WebRequest -Uri http://localhost/login.aspx -UseBasicParsing 本机探活。
- 要点：池子 Started 不等于页面能用，200 才算数。再让车间刷一下报工页确认端到端，故障才算恢复。
- 防复发：给 MESPool 配定时回收，避开高峰自动换新进程：Set-ItemProperty 修改 IIS: 提供程序下 MESPool 的回收配置（recycling.periodicRestart）。
- 要点：定时回收是 .NET 应用内存泄漏的止血带：赶在 OOM 前换新进程。这只是缓兵之计——根治要开发查泄漏（崩溃前 4.1G 的 dump 留给开发分析），同时给事件 5011 配告警，别等车间打电话才知道。
- 用 iisreset 重启整站：会影响同机其它站点，题目要求只动 MESPool
- 只看站点状态不看事件日志：状态只能说明现象，日志才给根因

## 8. AI 环境准备步骤（供站内 AI 生成准备脚本）

AI 应当按下面的顺序在**用户填写的演练环境**上生成准备脚本；每条命令都必须先预览、由用户确认后再执行，命中站内危险命令清单的一律二次确认。

- 记录基线：两个站点的状态、MESPool 的进程数与配置、事件日志最近条目
- 造故障：把 MESPool 停掉或制造一次回收失败，让 MES 站点返回 503 而 OA 仍正常
- 记录回滚点：MESPool 原配置与另一个站点的状态快照

## 9. AI 执行脚本要点（供站内 AI 生成执行脚本）

- 先看站点与应用程序池状态，确认故障层级在应用池而不是 IIS 整体
- 翻 Application 事件日志找 MESPool 被停掉的直接原因
- 确认磁盘/内存等系统层没有连带异常，再只启动 MESPool
- 用本机访问 MES 页面验证可访问，并确认同机其它站点未受影响
- 防复发：给 MESPool 配定时回收（空闲时间/回收时间），避开高峰换新进程
- 验收正则覆盖：Get-WebSite / 事件日志 / 内存查看 / Start-AppPool / 页面访问验证 / 回收配置

## 10. 安全边界与失败处理

- 只在用户自己提供的演练环境上执行；不连接任何生产实例，也不改动本站服务端配置。
- 生成的脚本一律先给出预览，用户确认后才执行；危险命令走站内既有拦截清单与二次确认。
- 失败处理：上游模型不可用 → 明确提示「AI 暂时不可用」，并保留手工执行入口；文档缺失 → 明确提示「该题文档缺失」；命令执行失败 → 原样回显报错行并停止该步；环境不符（例如题目要求 MySQL 却连的是 PostgreSQL）→ 在执行前就提示不匹配，不静默继续。
- 本题涉及的判分一律以第 6 节的机器判据为准，不采信模型自述的「已完成」。

