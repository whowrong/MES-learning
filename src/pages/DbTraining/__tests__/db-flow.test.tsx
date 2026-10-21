// @vitest-environment jsdom
// 数据库实操营渲染级冒烟：总览 → 任务练习（真执行真校验走完一组）→ 报告 → 工作台危险 SQL 确认。
// 任何一步渲染崩溃（黑屏）或判定接线错误都会让本测试失败。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { useDbTraining } from "../useDbTraining"
import { DbTrainingPage } from "../DbTrainingPage"
import { buildDefaultProgress } from "@/content/chapters"
import dbIndex from "../../../../public/content/db-training/index.json"
import queryJson from "../../../../public/content/db-training/query.json"
import joinJson from "../../../../public/content/db-training/join.json"
import cleanJson from "../../../../public/content/db-training/clean.json"
import reportJson from "../../../../public/content/db-training/report.json"
import termsJson from "../../../../public/content/terms.json"

function jsonRes(data: unknown): Response {
  return { ok: true, status: 200, json: async () => data } as unknown as Response
}

let latest: ReturnType<typeof useDbTraining>
const patchBodies: unknown[] = []

function Harness() {
  const p = useDbTraining()
  latest = p
  return <DbTrainingPage {...p} />
}

const record = { ...buildDefaultProgress(), id: "rec-db-1" }

/** SQL → 期望结果 映射：用户敲的答案 SQL 与校验 SQL 都返回该任务的 expect（模拟真实执行） */
const sqlResults = new Map<string, unknown[][]>()
for (const bank of [queryJson, joinJson, cleanJson, reportJson]) {
  for (const t of bank.tasks) {
    sqlResults.set(t.answerSql.trim(), t.check.expect as unknown[][])
    sqlResults.set(t.check.sql.trim(), t.check.expect as unknown[][])
  }
}

beforeEach(() => {
  patchBodies.length = 0
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith("/content/db-training/index.json")) return jsonRes(dbIndex)
      if (url.endsWith("/content/db-training/query.json")) return jsonRes(queryJson)
      if (url.endsWith("/content/db-training/join.json")) return jsonRes(joinJson)
      if (url.endsWith("/content/db-training/clean.json")) return jsonRes(cleanJson)
      if (url.endsWith("/content/db-training/report.json")) return jsonRes(reportJson)
      if (url.endsWith("/content/terms.json")) return jsonRes(termsJson)
      if (url.endsWith("/api/dblab/connections")) return jsonRes({ ok: true, connections: [] })
      if (url.endsWith("/api/dblab/reset-builtin")) return jsonRes({ ok: true, message: "内置练习库已重置为初始状态" })
      if (url.endsWith("/api/dblab/exec")) {
        const body = JSON.parse(String(init?.body)) as { sql?: string }
        const sql = (body.sql ?? "").trim()
        const rows = sqlResults.get(sql)
        if (rows) {
          const columns = rows[0]?.map((_, i) => `c${i}`) ?? []
          return jsonRes({ ok: true, columns, rows, truncated: false, total: rows.length })
        }
        return jsonRes({ ok: true, columns: ["x"], rows: [[0]], truncated: false, total: 1 })
      }
      if (url.endsWith("/api/dblab/test")) return jsonRes({ ok: true, message: "连接成功" })
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
    <MemoryRouter initialEntries={["/db-training"]}>
      <Harness />
    </MemoryRouter>,
  )
  await waitFor(() => expect(latest.loading).toBe(false), { timeout: 3000 })
  expect(latest.loadError).toBe("")
}

describe("数据库实操营全流程", () => {
  it("总览四组渲染 → 进 query 组第一题", async () => {
    await bootstrap()
    expect(latest.phase).toBe("home")
    expect(latest.homeView!.groupViews).toHaveLength(4)
    expect(screen.getByText("单表查询与业务口径")).toBeTruthy()
    expect(screen.getByText(/SQL 工作台（自由执行）/)).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByText("单表查询与业务口径"))
    })
    expect(latest.phase).toBe("task")
    expect(screen.getByText(/月会拷问/)).toBeTruthy()
    expect(screen.getByText(/目标：/)).toBeTruthy()
  })

  it("query 组四题全对一次通过 → 报告 S 级并落档", async () => {
    await bootstrap()
    await act(async () => {
      fireEvent.click(screen.getByText("单表查询与业务口径"))
    })

    const editor = () => screen.getByLabelText("SQL 编辑区")
    for (const task of queryJson.tasks) {
      // 敲参考答案并执行
      await act(async () => {
        fireEvent.change(editor(), { target: { value: task.answerSql } })
      })
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /执行（不限次数）/ }))
      })
      await waitFor(() => expect(latest.taskView!.execResult?.ok).toBe(true))
      // 提交校验
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /提交校验（比对结果）/ }))
      })
      await waitFor(() => expect(latest.taskView!.solved).toBe(true))
      expect(screen.getByText(/校验通过/)).toBeTruthy()
      // 下一题或出报告
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /下一|完成本组/ }))
      })
    }

    expect(latest.phase).toBe("report")
    expect(latest.report!.score).toBe(100)
    expect(latest.report!.rank).toBe("S")
    expect(patchBodies.length).toBe(1)
    expect((patchBodies[0] as { db_history: unknown[] }).db_history).toHaveLength(1)
  })

  it("提交错误结果不锁定：给差异提示可继续修改", async () => {
    await bootstrap()
    await act(async () => {
      fireEvent.click(screen.getByText("单表查询与业务口径"))
    })
    // 敲一条结果不对的 SQL（mock 返回 [[0]]，与 db-q1 期望 [[16]] 不同）
    await act(async () => {
      fireEvent.change(screen.getByLabelText("SQL 编辑区"), { target: { value: "SELECT COUNT(*) AS n FROM work_orders WHERE status='Released'" } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /执行（不限次数）/ }))
    })
    await waitFor(() => expect(latest.taskView!.execResult?.ok).toBe(true))
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /提交校验（比对结果）/ }))
    })
    await waitFor(() => expect(latest.taskView!.checkAttempts).toBe(1))
    expect(latest.taskView!.solved).toBe(false)
    expect(latest.taskView!.verdict!.passed).toBe(false)
    expect(screen.getByText(/校验未通过/)).toBeTruthy()
    expect(screen.getByText(/行数不对|不一致/)).toBeTruthy()
  })

  it("工作台：危险 SQL 弹确认框，取消不执行；SELECT 直接执行", async () => {
    await bootstrap()
    await act(async () => {
      fireEvent.click(screen.getByText(/SQL 工作台（自由执行）/))
    })
    expect(latest.phase).toBe("workbench")
    expect(screen.getByText(/内置练习库：MES 业务表/)).toBeTruthy()

    // 无 WHERE 的 DELETE → 确认框
    await act(async () => {
      fireEvent.change(screen.getByLabelText("工作台 SQL 编辑区"), { target: { value: "DELETE FROM work_orders" } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "执行" }))
    })
    expect(screen.getByText(/确认执行危险语句/)).toBeTruthy()
    expect(screen.getByText(/无 WHERE 的 DELETE/)).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "取消" }))
    })
    expect(latest.workbenchView!.dangerConfirm).toBeNull()

    // SELECT → 直接执行出结果表
    await act(async () => {
      fireEvent.change(screen.getByLabelText("工作台 SQL 编辑区"), { target: { value: "SELECT COUNT(*) FROM items" } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "执行" }))
    })
    await waitFor(() => expect(latest.workbenchView!.wbResult?.ok).toBe(true))
    expect(latest.workbenchView!.wbHistory.length).toBe(1)
  })
})
