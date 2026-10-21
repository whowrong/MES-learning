// 运维训练营·模拟终端引擎（纯函数，vitest 全覆盖）
// 场景式演练：读事故工单 → 逐步输入命令 → accept 正则匹配推进 → 完成出报告
// 铁律：不执行任何真实命令，只做模式匹配 + 返回内容文件里写好的模拟输出

export interface TerminalStep {
  id: string
  objective: string // 本步目标（顶栏展示）
  accept: string[] // 命中即推进的正则（源串，new RegExp(p, "i")）
  output: string // 命中后的模拟终端输出
  hint: string // 提示按钮文案（计次影响评分）
  explain: string // 推进后的「为什么这一步」讲解
}

export interface AmbientRule {
  pattern: string // 任意时刻可查的中性命令（ls/pwd/whoami…）
  output: string // 真实感输出，不计错误不推进
}

export interface DangerRule {
  pattern: string
  output: string // 警示教学文案
}

export interface TerminalDrillDef {
  id: string
  prompt: string // 如 "ops@mes-app-01:~$" 或 "PS C:\\Users\\ops>"
  steps: TerminalStep[]
  ambient?: AmbientRule[]
  danger?: DangerRule[] // 域级危险命令，叠加在全局表之上
}

export type LineKind = "cmd" | "out" | "info" | "warn" | "ok"
export interface TerminalLine {
  kind: LineKind
  text: string
}

export interface TerminalRun {
  lines: TerminalLine[]
  stepIndex: number
  hintsUsed: number
  wrongAttempts: number
  finished: boolean
}

// 全局危险命令教学表：真实运维里会丢工作/丢数据的操作，演练里专门拦截并讲后果
export const GLOBAL_DANGER: DangerRule[] = [
  {
    pattern: "^rm\\s+(-\\w*[rf]\\w*\\s+)+/(\\s|$)",
    output: "⛔ 操作已被演练环境拦截：rm -rf / 会递归删除整台服务器的全部数据且不可恢复。真实环境里这条命令足以让你丢掉工作和公司的全部业务数据。清理磁盘永远先确认路径，从具体目录下手，配合 du 先核对再删。",
  },
  {
    pattern: "^rm\\s+(-\\w*[rf]\\w*\\s+)+/var(/\\s*$|\\s)",
    output: "⛔ 操作已被演练环境拦截：/var 下有系统日志、数据库文件和运行状态数据，整目录强删会让 MES 数据库和应用直接报废。删日志要精确到文件，且优先用 truncate 或 logrotate 而不是 rm。",
  },
  {
    pattern: "^mkfs",
    output: "⛔ 操作已被演练环境拦截：mkfs 会重新格式化整个分区，上面所有数据立即消失。磁盘空间问题的解法是找到大文件清理或扩容，绝不是格式化。",
  },
  {
    pattern: "^dd\\s+if=",
    output: "⛔ 操作已被演练环境拦截：dd 写盘一旦 of= 指错设备，目标盘数据全部覆写无法恢复。生产服务器上不要徒手 dd，备份恢复要用带校验的工具流程。",
  },
  {
    pattern: ":\\(\\)\\s*\\{",
    output: "⛔ 操作已被演练环境拦截：这是 fork 炸弹，会瞬间耗尽进程数把服务器打死。演练环境也不允许尝试。",
  },
  {
    pattern: "^shutdown|^init\\s+0|^halt",
    output: "⛔ 操作已被演练环境拦截：直接关机会让 MES 采集服务、数据库全部硬停，未落盘数据丢失，还可能把数据库文件损坏。生产服务器重启必须先走审批，按顺序停应用、停数据库，再重启。",
  },
  {
    pattern: "^(reboot|restart-computer)",
    output: "⛔ 先别急着重启：重启确实能「解决」很多表象问题，但故障原因会被现场破坏，问题大概率复发，而且 MES 数据库硬重启有损坏风险。规范做法是先取证（日志、进程、连接状态），确认恢复手段后再按顺序重启。本演练请先完成排查步骤。",
  },
  {
    pattern: "drop\\s+(table|database)",
    output: "⛔ 操作已被演练环境拦截：DROP 会连表结构带数据一起删掉，MES 的工单、报工历史将永久丢失。生产库上任何 DDL 都必须先在备份上演练、走变更审批，且操作前全量备份。",
  },
  {
    pattern: "delete\\s+from\\s+[\\w.]+\\s*;?\\s*$",
    output: "⛔ 操作已被演练环境拦截：不带 WHERE 的 DELETE 会清空整张表。清理脏数据的正确姿势：先 SELECT 同条件确认行数，备份目标表，再带 WHERE 分批删除。",
  },
  {
    pattern: "truncate\\s+table",
    output: "⛔ 操作已被演练环境拦截：TRUNCATE 清空全表且多数场景不进事务日志、无法回滚。对 MES 业务表用 TRUNCATE 等于删库跑路，任何清表操作都要走审批加备份。",
  },
]

export function initRun(drill: TerminalDrillDef): TerminalRun {
  return {
    lines: [
      { kind: "info", text: `已连接到演练终端。本次演练共 ${drill.steps.length} 个处置步骤，按顶栏目标逐步输入命令。` },
    ],
    stepIndex: 0,
    hintsUsed: 0,
    wrongAttempts: 0,
    finished: false,
  }
}

function normalize(raw: string): string {
  return raw.trim().replace(/\s+/g, " ")
}

function matches(patterns: string[], cmd: string): boolean {
  return patterns.some((p) => {
    try {
      return new RegExp(p, "i").test(cmd)
    } catch {
      return false
    }
  })
}

// 提交一条命令，返回新的 run 状态（不修改入参）
export function submitCommand(run: TerminalRun, drill: TerminalDrillDef, raw: string): TerminalRun {
  const cmd = normalize(raw)
  if (!cmd) return run
  const lines: TerminalLine[] = [...run.lines, { kind: "cmd", text: cmd }]
  const next: TerminalRun = { ...run, lines }

  if (run.finished) {
    lines.push({ kind: "info", text: "本次演练已完成，可以退出查看演练报告，或点「重新演练」再来一遍。" })
    return next
  }

  // 1. 危险命令拦截（域级 + 全局）
  const dangers = [...(drill.danger ?? []), ...GLOBAL_DANGER]
  const danger = dangers.find((d) => matches([d.pattern], cmd))
  if (danger) {
    lines.push({ kind: "warn", text: danger.output })
    return { ...next, wrongAttempts: run.wrongAttempts + 1 }
  }

  const step = drill.steps[run.stepIndex]

  // 2. 命中当前步骤 → 推进
  if (matches(step.accept, cmd)) {
    lines.push({ kind: "out", text: step.output })
    lines.push({ kind: "ok", text: `✔ 步骤 ${run.stepIndex + 1}/${drill.steps.length} 完成：${step.explain}` })
    const stepIndex = run.stepIndex + 1
    if (stepIndex >= drill.steps.length) {
      lines.push({ kind: "ok", text: "全部处置步骤完成，演练结束。退出后查看演练报告与标准操作序列（SOP）。" })
      return { ...next, stepIndex, finished: true }
    }
    lines.push({ kind: "info", text: `下一步目标：${drill.steps[stepIndex].objective}` })
    return { ...next, stepIndex }
  }

  // 3. 中性查询命令 → 真实感输出，不计错误
  const ambient = (drill.ambient ?? []).find((a) => matches([a.pattern], cmd))
  if (ambient) {
    lines.push({ kind: "out", text: ambient.output })
    return next
  }

  // 4. 其它命令 → 计一次错误尝试，给方向性反馈（不直接给答案）
  lines.push({
    kind: "warn",
    text: `这条命令没有推进排查。当前目标：${step.objective}。卡住就点右上「提示」（提示会计次，影响最终评分）。`,
  })
  return { ...next, wrongAttempts: run.wrongAttempts + 1 }
}

// 请求提示：hintsUsed+1，push 当前步骤 hint
export function requestHint(run: TerminalRun, drill: TerminalDrillDef): TerminalRun {
  if (run.finished) return run
  const step = drill.steps[run.stepIndex]
  return {
    ...run,
    hintsUsed: run.hintsUsed + 1,
    lines: [...run.lines, { kind: "info", text: `提示：${step.hint}` }],
  }
}

// 评分：满分 100，每次提示 -10，每次错误尝试 -5，下限 0
export function scoreRun(run: TerminalRun): number {
  return Math.max(0, 100 - run.hintsUsed * 10 - run.wrongAttempts * 5)
}

export function rankForOpsScore(score: number): "S" | "A" | "B" | "C" {
  if (score >= 95) return "S"
  if (score >= 85) return "A"
  if (score >= 70) return "B"
  return "C"
}
