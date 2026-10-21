// @vitest-environment jsdom
// 运维训练营渲染级冒烟：域选择 → 清单 → 终端演练（真实敲命令走完）→ 决策组 → 排序组 → 报告，
// 任何一步渲染崩溃（黑屏）或引擎接线错误都会让本测试失败。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { useOpsTraining } from "../useOpsTraining"
import { OpsTrainingPage } from "../OpsTrainingPage"
import { buildDefaultProgress } from "@/content/chapters"
import opsIndex from "../../../../public/content/ops-training/index.json"
import linuxJson from "../../../../public/content/ops-training/linux.json"
import windowsJson from "../../../../public/content/ops-training/windows.json"
import cloudJson from "../../../../public/content/ops-training/cloud.json"
import integrationJson from "../../../../public/content/ops-training/integration.json"
import termsJson from "../../../../public/content/terms.json"

function jsonRes(data: unknown): Response {
  return { ok: true, status: 200, json: async () => data } as unknown as Response
}

let latest: ReturnType<typeof useOpsTraining>
const patchBodies: unknown[] = []

function Harness() {
  const p = useOpsTraining()
  latest = p
  return <OpsTrainingPage {...p} />
}

const record = { ...buildDefaultProgress(), id: "rec-ops-1" }

beforeEach(() => {
  patchBodies.length = 0
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith("/content/ops-training/index.json")) return jsonRes(opsIndex)
      if (url.endsWith("/content/ops-training/linux.json")) return jsonRes(linuxJson)
      if (url.endsWith("/content/ops-training/windows.json")) return jsonRes(windowsJson)
      if (url.endsWith("/content/ops-training/cloud.json")) return jsonRes(cloudJson)
      if (url.endsWith("/content/ops-training/integration.json")) return jsonRes(integrationJson)
      if (url.endsWith("/content/terms.json")) return jsonRes(termsJson)
      if (init?.method === "PATCH") {
        patchBodies.push(JSON.parse(String(init.body)))
        return jsonRes(record)
      }
      if (url.includes("/api/player_progress")) return jsonRes({ items: [record] })
      return jsonRes({})
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function bootstrap() {
  render(
    <MemoryRouter initialEntries={["/ops-training"]}>
      <Harness />
    </MemoryRouter>,
  )
  await waitFor(() => expect(latest.loading).toBe(false), { timeout: 3000 })
  expect(latest.loadError).toBe("")
}

/** 在模拟终端里敲一条命令并回车 */
async function typeCommand(cmd: string) {
  const input = screen.getByLabelText("终端命令输入")
  await act(async () => {
    fireEvent.change(input, { target: { value: cmd } })
    fireEvent.keyDown(input, { key: "Enter" })
  })
}

describe("运维训练营全流程", () => {
  it("域选择 → 清单 → 终端演练 lx-d1 满分通关 → 报告", async () => {
    await bootstrap()
    expect(latest.phase).toBe("domains")
    expect(latest.domainsView!.domainViews).toHaveLength(4)

    // 进 Linux 域
    await act(async () => {
      fireEvent.click(screen.getByText("Linux 服务器实操"))
    })
    expect(latest.phase).toBe("list")
    expect(latest.listView!.itemViews.length).toBeGreaterThanOrEqual(6)

    // 进第一个终端演练
    await act(async () => {
      fireEvent.click(screen.getByText("磁盘打满：MES 采集服务停止写库"))
    })
    expect(latest.phase).toBe("terminal")
    expect(screen.getByText(/事故工单/)).toBeTruthy()

    // 按 SOP 敲完 6 步
    for (const cmd of [
      "df -h",
      "du -h --max-depth=1 /",
      "du -sh /var/*",
      "truncate -s 0 /var/log/mes-collector.log",
      "df -h",
      "systemctl restart mes-collector",
    ]) {
      await typeCommand(cmd)
    }
    expect(latest.terminalView!.run.finished).toBe(true)

    // 危险命令教学：重开后 rm -rf / 被拦截
    // （当前 run 已完成，直接出报告）
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /查看演练报告/ }))
    })
    expect(latest.phase).toBe("report")
    expect(latest.report!.kind).toBe("terminal")
    expect(latest.report!.score).toBe(100)
    expect(latest.report!.rank).toBe("S")
    expect(screen.getByText(/标准操作序列/)).toBeTruthy()
    expect(patchBodies.length).toBe(1)
    expect((patchBodies[0] as { ops_history: unknown[] }).ops_history).toHaveLength(1)

    // 回清单
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /返回训练清单/ }))
    })
    expect(latest.phase).toBe("list")
  })

  it("决策组 lx-c1 全对出分并落档", async () => {
    await bootstrap()
    await act(async () => {
      fireEvent.click(screen.getByText("Linux 服务器实操"))
    })
    await act(async () => {
      fireEvent.click(screen.getByText("Linux 巡检与应急处置八题"))
    })
    expect(latest.phase).toBe("choice")

    const view0 = latest.choiceView!
    const total = view0.total
    expect(total).toBe(8)
    for (let i = 0; i < total; i++) {
      const v = latest.choiceView!
      act(() => latest.pickChoice(v.question.answer))
      act(() => latest.submitChoice())
      expect(latest.choiceView!.judged).toBe(true)
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: i === total - 1 ? /完成本组，出分/ : /下一题/ }),
        )
      })
    }
    expect(latest.phase).toBe("report")
    expect(latest.report!.kind).toBe("choice")
    expect(latest.report!.score).toBe(100)
    expect(latest.report!.choice!.correctCount).toBe(8)
    expect(patchBodies.length).toBe(1)
  })

  it("排序组 lx-o1 一次排对得满分；排序错时给 wrongFlash 不锁定", async () => {
    await bootstrap()
    await act(async () => {
      fireEvent.click(screen.getByText("Linux 服务器实操"))
    })
    await act(async () => {
      fireEvent.click(screen.getByText("磁盘告警处置全流程"))
    })
    expect(latest.phase).toBe("order")

    // 先乱序提交一次：应提示 wrongFlash 且未判定结束
    act(() => latest.submitOrder())
    expect(latest.orderView!.judged).toBe(false)
    expect(latest.orderView!.wrongFlash).toBe(true)
    act(() => latest.dismissOrderFlash())

    // 按正确顺序（内容文件步骤书写序 s1..s7）冒泡归位
    const orderItem = linuxJson.items.find((i) => i.id === "lx-o1") as unknown as {
      steps: Array<{ id: string }>
    }
    const correctIds = orderItem.steps.map((s) => s.id)
    for (let target = 0; target < correctIds.length; target++) {
      for (;;) {
        const rows = latest.orderView!.rows
        const cur = rows.findIndex((r) => r.id === correctIds[target])
        if (cur === target) break
        act(() => latest.moveOrderStep(cur, -1))
      }
    }
    act(() => latest.submitOrder())
    expect(latest.orderView!.judged).toBe(true)
    expect(latest.orderView!.solved).toBe(true)

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /完成，出演练报告/ }))
    })
    expect(latest.phase).toBe("report")
    // 第 2 次提交排对 = 80 分（档位 B：A 需 ≥85）
    expect(latest.report!.score).toBe(80)
    expect(latest.report!.rank).toBe("B")
    expect(patchBodies.length).toBe(1)
  })

  it("终端里敲危险命令被拦截并计错误尝试", async () => {
    await bootstrap()
    await act(async () => {
      fireEvent.click(screen.getByText("Linux 服务器实操"))
    })
    await act(async () => {
      fireEvent.click(screen.getByText("磁盘打满：MES 采集服务停止写库"))
    })
    await typeCommand("rm -rf /")
    expect(latest.terminalView!.run.wrongAttempts).toBe(1)
    expect(latest.terminalView!.run.stepIndex).toBe(0)
    expect(screen.getByText(/演练环境拦截/)).toBeTruthy()

    // 用错方向的 rm 也被域级 danger 拦截教学
    await typeCommand("rm /var/log/mes-collector.log")
    expect(latest.terminalView!.run.wrongAttempts).toBe(2)
    expect(screen.getByText(/truncate -s 0 原地清空/)).toBeTruthy()

    // 提示按钮计次
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /提示（计次扣分）/ }))
    })
    expect(latest.terminalView!.run.hintsUsed).toBe(1)
  })

  it("终端「复制全部」把工单上下文 + 终端记录写进剪贴板", async () => {
    const writeText = vi.fn(async (_text: string) => {})
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    try {
      await bootstrap()
      await act(async () => {
        fireEvent.click(screen.getByText("Linux 服务器实操"))
      })
      await act(async () => {
        fireEvent.click(screen.getByText("磁盘打满：MES 采集服务停止写库"))
      })
      await typeCommand("df -h")

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /复制全部终端记录/ }))
      })

      expect(writeText).toHaveBeenCalledTimes(1)
      const text = String(writeText.mock.calls[0][0])
      // 工单三要素齐全，AI 拿到就有完整上下文
      expect(text).toContain("【演练】磁盘打满")
      expect(text).toContain("【背景】")
      expect(text).toContain("【现象】")
      expect(text).toContain("【处置目标】")
      expect(text).toContain("【当前步骤目标】")
      // 终端记录含命令行（带提示符）与输出
      expect(text).toContain("—— 终端记录 ——")
      expect(text).toContain("df -h")
      expect(text).toContain("Filesystem")
      expect(text).toContain("100%")
      // 复制成功后按钮短暂变为「已复制」
      expect(screen.getByText("已复制")).toBeTruthy()
    } finally {
      delete (navigator as unknown as { clipboard?: unknown }).clipboard
    }
  })
})
