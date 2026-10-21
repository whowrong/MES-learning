// 模拟终端引擎单测：推进 / 错误计数 / 提示计次 / 危险拦截 / 中性查询 / 评分
import { describe, expect, it } from "vitest"
import {
  GLOBAL_DANGER,
  initRun,
  rankForOpsScore,
  requestHint,
  scoreRun,
  submitCommand,
  type TerminalDrillDef,
} from "../opsTerminal"

const drill: TerminalDrillDef = {
  id: "t1",
  prompt: "ops@mes-app-01:~$",
  steps: [
    {
      id: "s1",
      objective: "查看磁盘占用",
      accept: ["^df(\\s+-\\w+)*\\s*$"],
      output: "/dev/vda1 50G 50G 0 100% /",
      hint: "以 d 开头的两个字母",
      explain: "先看全局再下手",
    },
    {
      id: "s2",
      objective: "定位大目录",
      accept: ["^du\\s+.*-s", "^du\\s+-sh"],
      output: "48G /var/log",
      hint: "du 加汇总参数",
      explain: "逐层收敛范围",
    },
  ],
  ambient: [{ pattern: "^pwd$", output: "/home/ops" }],
}

describe("模拟终端引擎", () => {
  it("初始状态：第 0 步、未完成、带开场说明", () => {
    const run = initRun(drill)
    expect(run.stepIndex).toBe(0)
    expect(run.finished).toBe(false)
    expect(run.lines[0].kind).toBe("info")
  })

  it("命中当前步骤 accept 即推进并附讲解", () => {
    let run = initRun(drill)
    run = submitCommand(run, drill, "df -h")
    expect(run.stepIndex).toBe(1)
    expect(run.lines.some((l) => l.kind === "ok" && l.text.includes("先看全局"))).toBe(true)
  })

  it("乱序命令不推进（第 2 步命令在第 1 步输不算对）", () => {
    let run = initRun(drill)
    run = submitCommand(run, drill, "du -sh /var/log")
    expect(run.stepIndex).toBe(0)
    expect(run.wrongAttempts).toBe(1)
  })

  it("无关命令计错误尝试并复述当前目标", () => {
    let run = initRun(drill)
    run = submitCommand(run, drill, "vim /etc/hosts")
    expect(run.wrongAttempts).toBe(1)
    expect(run.lines.at(-1)!.text).toContain("查看磁盘占用")
  })

  it("中性查询命令返回真实感输出且不计错误", () => {
    let run = initRun(drill)
    run = submitCommand(run, drill, "pwd")
    expect(run.wrongAttempts).toBe(0)
    expect(run.lines.at(-1)!.text).toBe("/home/ops")
  })

  it("完成全部步骤后 finished，后续命令只给完成提示", () => {
    let run = initRun(drill)
    run = submitCommand(run, drill, "df")
    run = submitCommand(run, drill, "du -sh /var")
    expect(run.finished).toBe(true)
    const before = run.stepIndex
    run = submitCommand(run, drill, "ls")
    expect(run.stepIndex).toBe(before)
    expect(run.lines.at(-1)!.kind).toBe("info")
  })

  it("提示计次且不推进", () => {
    let run = initRun(drill)
    run = requestHint(run, drill)
    expect(run.hintsUsed).toBe(1)
    expect(run.stepIndex).toBe(0)
    expect(run.lines.at(-1)!.text).toContain("d 开头")
  })

  it("危险命令被拦截并计错误尝试", () => {
    let run = initRun(drill)
    run = submitCommand(run, drill, "rm -rf /")
    expect(run.wrongAttempts).toBe(1)
    expect(run.stepIndex).toBe(0)
    expect(run.lines.at(-1)!.kind).toBe("warn")
    run = submitCommand(run, drill, "DELETE FROM work_orders;")
    expect(run.wrongAttempts).toBe(2)
    run = submitCommand(run, drill, "shutdown -h now")
    expect(run.wrongAttempts).toBe(3)
  })

  it("reboot 也被拦截（先取证再重启）", () => {
    let run = initRun(drill)
    run = submitCommand(run, drill, "reboot")
    expect(run.stepIndex).toBe(0)
    expect(run.lines.at(-1)!.text).toContain("先别急着重启")
  })

  it("评分：满分 100，提示 -10、错误 -5，下限 0；空命令不改状态", () => {
    let run = initRun(drill)
    run = submitCommand(run, drill, "   ")
    expect(run.lines.length).toBe(1)
    run = submitCommand(run, drill, "bad1")
    run = submitCommand(run, drill, "bad2")
    run = requestHint(run, drill)
    run = submitCommand(run, drill, "df -h")
    run = submitCommand(run, drill, "du -sh /var")
    expect(scoreRun(run)).toBe(100 - 10 - 10)
    let zero = initRun(drill)
    for (let i = 0; i < 30; i++) zero = submitCommand(zero, drill, "bad")
    expect(scoreRun(zero)).toBe(0)
  })

  it("评级档位与全站一致", () => {
    expect(rankForOpsScore(95)).toBe("S")
    expect(rankForOpsScore(94)).toBe("A")
    expect(rankForOpsScore(85)).toBe("A")
    expect(rankForOpsScore(70)).toBe("B")
    expect(rankForOpsScore(69)).toBe("C")
  })

  it("全局危险表每条正则都能编译", () => {
    for (const d of GLOBAL_DANGER) {
      expect(() => new RegExp(d.pattern, "i")).not.toThrow()
    }
  })
})
