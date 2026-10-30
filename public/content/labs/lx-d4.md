# 日志轮转没生效：logrotate 配置重复把服务写崩

- 题目编号：`lx-d4`
- 所属模块：运维实操营 · Linux 服务器实操
- 题目类型：运维实操（终端实操，真实服务器执行命令）
- 难度 / 建议时长：进阶 / 10 分钟
- 文档路径：`public/content/labs/lx-d4.md`（站内地址 `/content/labs/lx-d4.md`）

> 本文同时服务两类读者：人（讲清这道题在练什么、环境要求、步骤、验收、常见错法）与站内 AI（据此生成准备与执行脚本）。AI 生成的脚本一律先预览、再由用户确认执行。

> ⚠️ 本站演练会执行删除、重建、清库、杀进程、改防火墙、重启服务等破坏性操作。请只填**可破坏、演练专用**的数据库与服务器；生产环境、重要数据环境请勿填入。建议用一次性实例，或随时能从快照重建的环境。

## 1. 题目目标与业务背景

**目标**：找出轮转没生效的根因（配置重复 + 权限/指令写错），修正配置让日志按天切分，且不重启采集服务、不丢日志。

**背景**：MES 采集服务 mes-collector 的日志交给 logrotate 管理，配置放在 /etc/logrotate.d/mes-collector，要求每天切分、保留 7 份、压缩并给 mes 用户读权限。

**现象**：运维同学发现 mes-collector.log 已经涨到 20G 都没切分，手动跑 logrotate -f 直接报错 "duplicate log entry"，磁盘告警同时盯着这块盘。

## 2. 涉及的数据表或服务

- logrotate（轮转调度）
- mes-collector（日志写入方，持续持有日志句柄）
- /etc/logrotate.d（轮转配置目录）

## 3. 需要的账号与权限

- 需要 sudo：可读写 /etc/logrotate.d/mes-collector、可执行 logrotate、可查 mes-collector 服务状态
- SSH 私钥 / 口令只保存在本站服务端，不进仓库、不进文档。

## 4. 环境要求（演练专用）

### 4.1 规格基线

- 演练服务器最低配置：2 vCPU / 2 GB 内存 / 20 GB 可用磁盘（其中日志分区 ≥ 2 GB）；Debian 12 或 Ubuntu 22.04 及以上，需 systemd
- 演练服务器推荐配置：4 vCPU / 4–8 GB 内存 / 40 GB 可用磁盘（日志分区 ≥ 10 GB）；Debian 13 或 Ubuntu 24.04，Docker 29 可用
- 系统版本：Debian GNU/Linux 12/13 或 Ubuntu 22.04/24.04（systemd + bash + coreutils）

> 规格出处：以下数值对齐已验证过的目标机 instabox dev 实测规格（4 vCPU / 7.8 GiB 内存、根分区 16 GB + 数据盘 20 GB、Debian GNU/Linux 13，内核 6.18，Docker 29.8 可用），最低配置按其一半左右给出，保证题目脚本与路径在演练机上跑得通。

### 4.2 额外要求

- 预置 mes-collector.service（运行中，持续写 /var/log/mes-collector.log）
- 预置 /etc/logrotate.d/mes-collector，其中同一个日志路径声明了两次（duplicate 根因）
- 轮转脚本用 copytruncate 语义（采集服务不重新打开句柄）
- 磁盘剩余空间 ≥ 2 GB，避免与磁盘类题目混淆

### 4.3 破坏性提示

> ⚠️ 本站演练会执行删除、重建、清库、杀进程、改防火墙、重启服务等破坏性操作。请只填**可破坏、演练专用**的数据库与服务器；生产环境、重要数据环境请勿填入。建议用一次性实例，或随时能从快照重建的环境。

## 5. 标准步骤

| # | 目标 | 参考动作 |
| --- | --- | --- |
| s1 | 查看轮转配置与配置目录，确认重复条目 | 轮转配置在 /etc/logrotate.d 下，cat 出来看；同名路径出现两次就是 duplicate 的来源。 |
| s2 | 用 logrotate 调试模式确认为什么不执行 | logrotate -d 是 dry-run，只检查不执行，用来把报错原文看全。 |
| s3 | 备份配置文件 | 改配置前先 cp 一份 .bak，出问题能立刻回退。 |
| s4 | 修正配置：合并重复块并补齐关键指令 | 删掉重复的那个配置块，只保留一个；因为采集服务自己持有日志句柄，轮转方式要用 copytruncate。 |
| s5 | 语法校验并强制轮转一次 | 先 -d 确认不报错，再 -f 强制执行一次。 |
| s6 | 确认切分结果且采集服务未受影响 | ls 看有没有生成 .1 文件，systemctl 确认服务还在跑。 |

每一步的判定命令见第 6 节的验收正则。

## 6. 验收标准（可机器判定）

判分方式：终端实操逐条比对命令正则（任一条命中即通过该步），最终按通过步数给出评级。

| # | 步骤目标 | 命中的命令正则 |
| --- | --- | --- |
| s1 | 查看轮转配置与配置目录，确认重复条目 | `^cat\b.*/etc/logrotate\.d/mes-collector` 或 `^ls\b.*/etc/logrotate\.d` 或 `^grep\b.*mes-collector` |
| s2 | 用 logrotate 调试模式确认为什么不执行 | `^logrotate\b.*(-d|--debug)` 或 `^logrotate\b.*(-f|--force)` |
| s3 | 备份配置文件 | `^cp\b.*logrotate` 或 `^tar\b.*logrotate` |
| s4 | 修正配置：合并重复块并补齐关键指令 | `^sed\b.*logrotate\.d` 或 `^vi\b.*logrotate\.d` 或 `^cat\b.*>.*logrotate\.d` 或 `^python3?\b.*logrotate` |
| s5 | 语法校验并强制轮转一次 | `^logrotate\b.*(-d|--debug)` 或 `^logrotate\b.*(-f|--force)` |
| s6 | 确认切分结果且采集服务未受影响 | `^ls\b.*mes-collector` 或 `^systemctl\s+(status|is-active)` 或 `^journalctl\b.*mes-collector` |

## 7. 常见错误与排查提示

- 查看轮转配置与配置目录，确认重复条目：轮转配置在 /etc/logrotate.d 下，cat 出来看；同名路径出现两次就是 duplicate 的来源。
- 要点：同一个日志路径被两个配置块声明，logrotate 会直接判定为重复并拒绝执行整个文件——这就是「一个都没切」的根因。
- 用 logrotate 调试模式确认为什么不执行：logrotate -d 是 dry-run，只检查不执行，用来把报错原文看全。
- 要点：-d 不会改任何文件，是排查配置类问题的第一选择；看到 duplicate log entry 就说明配置块冲突。
- 备份配置文件：改配置前先 cp 一份 .bak，出问题能立刻回退。
- 要点：改系统配置永远先备份，这是上生产的基本动作，也是回滚能力的来源。
- 修正配置：合并重复块并补齐关键指令：删掉重复的那个配置块，只保留一个；因为采集服务自己持有日志句柄，轮转方式要用 copytruncate。
- 要点：两块合并成一块；用 copytruncate 而不是 rename + postrotate，是因为采集服务不会重新打开日志句柄，rename 之后新日志写不进新文件。
- 语法校验并强制轮转一次：先 -d 确认不报错，再 -f 强制执行一次。
- 要点：-d 通过再 -f，避免用一次强制执行去试错；执行后应该能看到新的 .1 文件。
- 确认切分结果且采集服务未受影响：ls 看有没有生成 .1 文件，systemctl 确认服务还在跑。
- 要点：轮转不能以停服务为代价：copytruncate 的价值就是原地截断，服务无感。
- 用 rm 删除大日志释放空间：进程仍持有句柄，空间不释放，必须 truncate -s 0
- 直接 logrotate -f 不先 -d 校验：配置有错时可能半途失败

## 8. AI 环境准备步骤（供站内 AI 生成准备脚本）

AI 应当按下面的顺序在**用户填写的演练环境**上生成准备脚本；每条命令都必须先预览、由用户确认后再执行，命中站内危险命令清单的一律二次确认。

- 记录基线：ls -lh /var/log/mes-collector.log* 与 df -h
- 造故障：在配置里写入第二个同名配置块，并把 create 权限项去掉
- 确认现象：logrotate -d 报 duplicate log entry，日志不切分
- 记录回滚点：配置文件的 .bak 副本路径

## 9. AI 执行脚本要点（供站内 AI 生成执行脚本）

- logrotate -d 读出 duplicate log entry 原文
- cp 备份配置后合并重复块，补齐 create 0640 mes mes 与 copytruncate
- logrotate -d 通过后再 logrotate -f 强制轮转一次
- ls 确认生成 .1 且 systemctl is-active mes-collector 仍为 active

## 10. 安全边界与失败处理

- 只在用户自己提供的演练环境上执行；不连接任何生产实例，也不改动本站服务端配置。
- 生成的脚本一律先给出预览，用户确认后才执行；危险命令走站内既有拦截清单与二次确认。
- 失败处理：上游模型不可用 → 明确提示「AI 暂时不可用」，并保留手工执行入口；文档缺失 → 明确提示「该题文档缺失」；命令执行失败 → 原样回显报错行并停止该步；环境不符（例如题目要求 MySQL 却连的是 PostgreSQL）→ 在执行前就提示不匹配，不静默继续。
- 本题涉及的判分一律以第 6 节的机器判据为准，不采信模型自述的「已完成」。

