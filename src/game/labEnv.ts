// 实操营「两种演练环境模式」的纯逻辑
//
// 模式 A（remote）：用户自己的远程环境——用户填自己部署的练习用数据库 / 服务器，
//                   站点 AI 按该题文档生成脚本，并在用户那台机器上真实执行。
// 模式 B（site）：站点自带的一次性 Docker 演练环境——站点在部署机上起一个可丢弃的
//                   容器（数据库题起数据库容器，服务器题起 sshd 容器），演练结束或超时后销毁。
//
// 两种模式共用同一套：题目文档、AI 脚本生成、预览与二次确认、危险命令拦截、判分口径；
// 只有「执行目标」这一层不同。

export type LabEnvMode = "remote" | "site"

export interface LabEnvModeSpec {
  mode: LabEnvMode
  label: string
  short: string
  hint: string
  tradeoff: string
}

export const LAB_ENV_MODES: LabEnvModeSpec[] = [
  {
    mode: "remote",
    label: "使用我的远程环境",
    short: "我的远程环境",
    hint: "填你自己部署的练习用数据库 / 服务器，AI 按该题文档生成脚本，并在你那台机器上真实执行。",
    tradeoff: "更贴近真实交付环境：真实数据形态、真实账号权限，可复用为长期演练台；但环境要自己准备。",
  },
  {
    mode: "site",
    label: "使用站点的一次性 Docker 演练环境",
    short: "站点一次性环境",
    hint: "站点在部署机上起一个可丢弃的容器（数据库题起数据库容器，服务器题起 sshd 容器），演练结束或超时自动销毁。",
    tradeoff: "零准备、随时重来，适合反复练与破坏性操作；但环境是一次性的，容器里的数据不保留。",
  },
]

export function labEnvModeSpec(mode: LabEnvMode): LabEnvModeSpec {
  return LAB_ENV_MODES.find((m) => m.mode === mode) ?? LAB_ENV_MODES[0]
}

/** 模式 B 需要站点创建一次性环境；模式 A 不需要 */
export function needsSiteEnv(mode: LabEnvMode): boolean {
  return mode === "site"
}

/** 模式 A：用户需要具备的账号与权限 */
export function remoteEnvRequirement(kind: "db" | "server"): string[] {
  if (kind === "db") {
    return [
      "一个可登录的数据库账号（MySQL / PostgreSQL / SQL Server 任选，与题目一致）",
      "对目标库表的建表、写入、删除权限（题目里有删除/重建/清库步骤）",
      "一个可丢弃的练习用库；不要指向生产库",
    ]
  }
  return [
    "一台可 SSH 登录的 Linux 主机（演练专用，别用生产机）",
    "一个能执行 systemctl / journalctl / df / du / find 等命令的账号",
    "sudo 权限（部分排障题要停服务、改配置、重启）",
    "主机名不要含 prod / 生产 / 正式 / 线上，否则会触发红色告警并要求二次确认",
  ]
}

/** 模式 B：站点侧预置的服务与脏数据（按题型） */
export function siteEnvPreset(kind: "db" | "server", engine = "mysql"): string[] {
  if (kind === "db") {
    if (engine === "postgres") return ["一次性 PostgreSQL 16 容器（库名 lab、账号 lab）", "空库：建表 / 插入 / 索引重建类题目可从零做"]
    if (engine === "sqlserver") return ["一次性 SQL Server 2022 容器（sa 账号）", "空库：建表 / 插入类题目可从零做"]
    return ["一次性 MySQL 8.0 容器（库名 lab、账号 root）", "空库：建表 / 插入 / 索引重建类题目可从零做"]
  }
  return [
    "一次性 sshd 容器（账号 lab、随机口令，端口 14300-14349 段）",
    "干净的系统盘 / 数据目录，没有预置脏数据——需要脏数据的题目按题面自行制造",
    "容器内已具备基础命令（df / du / find / touch / rm 等），没有 systemd 与数据库服务",
  ]
}

/** 模式 B：环境规格（数值对齐部署机实测：4 vCPU / 7.8 GiB 内存 / Debian 13） */
export function siteEnvSpec(kind: "db" | "server"): { min: string; rec: string } {
  if (kind === "db") {
    return {
      min: "1 vCPU / 1 GiB 内存 / 2 GiB 磁盘；MySQL 8.0 约需 512 MiB 内存",
      rec: "2 vCPU / 2 GiB 内存 / 5 GiB 磁盘；给 InnoDB 留 1 GiB buffer pool",
    }
  }
  return {
    min: "1 vCPU / 512 MiB 内存 / 2 GiB 磁盘",
    rec: "2 vCPU / 1 GiB 内存 / 5 GiB 磁盘； inode 占用高的题目建议 1 GiB 以上 inode 配额",
  }
}

/** 模式 B 的端口段（与服务端 server/labenv.mjs 保持一致） */
export const SITE_DB_PORT_RANGE = [14200, 14249] as const
export const SITE_SSH_PORT_RANGE = [14300, 14349] as const
