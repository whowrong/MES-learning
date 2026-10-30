# 定时任务没跑：02:00 的归档脚本从未执行

- 题目编号：`lx-d7`
- 所属模块：运维实操营 · Linux 服务器实操
- 题目类型：运维实操（终端实操，真实服务器执行命令）
- 难度 / 建议时长：入门 / 8 分钟
- 文档路径：`public/content/labs/lx-d7.md`（站内地址 `/content/labs/lx-d7.md`）

> 本文同时服务两类读者：人（讲清这道题在练什么、环境要求、步骤、验收、常见错法）与站内 AI（据此生成准备与执行脚本）。AI 生成的脚本一律先预览、再由用户确认执行。

> ⚠️ 本站演练会执行删除、重建、清库、杀进程、改防火墙、重启服务等破坏性操作。请只填**可破坏、演练专用**的数据库与服务器；生产环境、重要数据环境请勿填入。建议用一次性实例，或随时能从快照重建的环境。

## 1. 题目目标与业务背景

**目标**：确认定时任务是否在调度、是否执行、在哪一步失败，修好之后手动补跑一次并验证产物。

**背景**：MES 数据归档任务写在一台应用服务器的 root crontab 里，每天 02:00 把前一天的报工数据打包到 /data/backup/mes-report/。

**现象**：运维例行检查发现 /data/backup/mes-report 里最新文件还停在 3 天前，cron 任务像是从来没执行过。

## 2. 涉及的数据表或服务

- cron（调度器）
- /opt/mes/scripts/archive-report.sh（归档脚本）
- /data/backup/mes-report（归档产物目录）

## 3. 需要的账号与权限

- 需要 sudo 或该用户自身的 crontab 权限：可 crontab -l/-e、可改脚本权限、可查 cron 日志
- SSH 私钥 / 口令只保存在本站服务端，不进仓库、不进文档。

## 4. 环境要求（演练专用）

### 4.1 规格基线

- 演练服务器最低配置：2 vCPU / 2 GB 内存 / 20 GB 可用磁盘（其中日志分区 ≥ 2 GB）；Debian 12 或 Ubuntu 22.04 及以上，需 systemd
- 演练服务器推荐配置：4 vCPU / 4–8 GB 内存 / 40 GB 可用磁盘（日志分区 ≥ 10 GB）；Debian 13 或 Ubuntu 24.04，Docker 29 可用
- 系统版本：Debian GNU/Linux 12/13 或 Ubuntu 22.04/24.04（systemd + bash + coreutils）

> 规格出处：以下数值对齐已验证过的目标机 instabox dev 实测规格（4 vCPU / 7.8 GiB 内存、根分区 16 GB + 数据盘 20 GB、Debian GNU/Linux 13，内核 6.18，Docker 29.8 可用），最低配置按其一半左右给出，保证题目脚本与路径在演练机上跑得通。

### 4.2 额外要求

- 预置 cron 服务（active）与一条 02:00 的归档任务
- 脚本文件为 DOS 换行符（^M）且没有可执行权限——两道经典坑同时存在
- 预置 /data/backup/mes-report 目录（产物应落在这里）

### 4.3 破坏性提示

> ⚠️ 本站演练会执行删除、重建、清库、杀进程、改防火墙、重启服务等破坏性操作。请只填**可破坏、演练专用**的数据库与服务器；生产环境、重要数据环境请勿填入。建议用一次性实例，或随时能从快照重建的环境。

## 5. 标准步骤

| # | 目标 | 参考动作 |
| --- | --- | --- |
| s1 | 查看定时任务清单 | crontab -l 看当前用户的定时任务，ls /etc/cron.d 看系统级任务。 |
| s2 | 确认 cron 服务在跑 | systemctl is-active cron 确认调度器本身活着。 |
| s3 | 看 cron 日志，确认任务有没有被触发 | journalctl -u cron 或 /var/log/cron 里看有没有触发记录。 |
| s4 | 检查脚本本身（换行符、可执行权限、路径） | ls 看权限，file / cat -A 看是不是 DOS 换行符（^M）。 |
| s5 | 修好脚本并手动补跑一次 | 去掉 ^M、加执行权限，然后手动跑一次看日志。 |
| s6 | 确认产物落盘并确认任务已重新排上 | ls 看产物、crontab -l 看任务仍在。 |

每一步的判定命令见第 6 节的验收正则。

## 6. 验收标准（可机器判定）

判分方式：终端实操逐条比对命令正则（任一条命中即通过该步），最终按通过步数给出评级。

| # | 步骤目标 | 命中的命令正则 |
| --- | --- | --- |
| s1 | 查看定时任务清单 | `^crontab\s+-l` 或 `^cat\b.*/etc/crontab` 或 `^ls\b.*/etc/cron` |
| s2 | 确认 cron 服务在跑 | `^systemctl\s+(status|is-active)\s+cron` 或 `^systemctl\s+(status|is-active)\s+crond` |
| s3 | 看 cron 日志，确认任务有没有被触发 | `^journalctl\b.*cron` 或 `^cat\b.*/var/log/cron|^tail\b.*/var/log/cron` 或 `^grep\b.*archive.*cron` |
| s4 | 检查脚本本身（换行符、可执行权限、路径） | `^ls\b.*archive-report` 或 `^file\b.*archive-report|^cat\b.*-A.*archive-report|^sed\b.*-\$.*archive-report` 或 `^head\b.*archive-report` |
| s5 | 修好脚本并手动补跑一次 | `^chmod\b` 或 `^sed\b.*archive-report` 或 `^dos2unix\b` 或 `^/opt/mes/scripts/archive-report\.sh|^bash\b.*archive-report` 或 `^sh\b.*archive-report` |
| s6 | 确认产物落盘并确认任务已重新排上 | `^ls\b.*mes-report` 或 `^crontab\s+-l` 或 `^systemctl\s+status\s+cron` |

## 7. 常见错误与排查提示

- 查看定时任务清单：crontab -l 看当前用户的定时任务，ls /etc/cron.d 看系统级任务。
- 要点：先确认任务「在不在」：很多「没执行」其实是任务压根没配。
- 确认 cron 服务在跑：systemctl is-active cron 确认调度器本身活着。
- 要点：任务配了不代表会跑：cron 服务停了，所有定时任务都在睡觉。
- 看 cron 日志，确认任务有没有被触发：journalctl -u cron 或 /var/log/cron 里看有没有触发记录。
- 要点：日志里没有触发记录，说明任务没被调度器取走，要往「调度链路」而不是「脚本内部」找原因。
- 检查脚本本身（换行符、可执行权限、路径）：ls 看权限，file / cat -A 看是不是 DOS 换行符（^M）。
- 要点：两个经典坑：脚本没有可执行权限、脚本是 Windows 换行符（^M）——后者在 Linux 上会报 not found。
- 修好脚本并手动补跑一次：去掉 ^M、加执行权限，然后手动跑一次看日志。
- 要点：手动补跑一次是最快的验证：脚本能跑通，cron 的问题自然就清楚了。
- 确认产物落盘并确认任务已重新排上：ls 看产物、crontab -l 看任务仍在。
- 要点：产物与调度两件事都要确认：补跑成功不代表明晚 02:00 会自动跑。
- crontab -r 清空全部任务：只能 crontab -e 精确改单条
- 手动跑通就认为 cron 问题解决了：补跑验证的是脚本，不是调度链路

## 8. AI 环境准备步骤（供站内 AI 生成准备脚本）

AI 应当按下面的顺序在**用户填写的演练环境**上生成准备脚本；每条命令都必须先预览、由用户确认后再执行，命中站内危险命令清单的一律二次确认。

- 记录基线：crontab -l、systemctl is-active cron、/data/backup/mes-report 现有产物
- 造故障：脚本写成 CRLF 换行 + chmod 644，确认 02:00 后目录没有新文件
- 记录回滚点：脚本 .bak 副本与 crontab 原文

## 9. AI 执行脚本要点（供站内 AI 生成执行脚本）

- crontab -l 确认任务在，systemctl is-active cron 确认调度器活着
- journalctl -u cron / /var/log/cron 确认任务是否被触发
- ls -l + file + cat -A 看出 ^M 与缺少执行权限
- sed 去掉 ^M、chmod +x，手动执行一次补跑并 tail 日志
- ls 确认产物生成 + crontab -l 确认调度仍在

## 10. 安全边界与失败处理

- 只在用户自己提供的演练环境上执行；不连接任何生产实例，也不改动本站服务端配置。
- 生成的脚本一律先给出预览，用户确认后才执行；危险命令走站内既有拦截清单与二次确认。
- 失败处理：上游模型不可用 → 明确提示「AI 暂时不可用」，并保留手工执行入口；文档缺失 → 明确提示「该题文档缺失」；命令执行失败 → 原样回显报错行并停止该步；环境不符（例如题目要求 MySQL 却连的是 PostgreSQL）→ 在执行前就提示不匹配，不静默继续。
- 本题涉及的判分一律以第 6 节的机器判据为准，不采信模型自述的「已完成」。

