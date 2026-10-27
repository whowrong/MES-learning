// 数据库实操营内容红线扫描：import.meta.glob 自动发现任务组文件，加组/加任务自动把关。
// 红线：id 全局唯一、check.expect 非空二维数组、answerSql/explanation/hint 完整、term_ids 真实、mode 合法。
import { describe, expect, it } from "vitest"
import termsRaw from "../../../public/content/terms.json"
import indexRaw from "../../../public/content/db-training/index.json"
import type { DbGroupBank } from "../dbTraining"

const modules = import.meta.glob("../../../public/content/db-training/*.json", { eager: true })

const termIds = new Set((termsRaw.terms as Array<{ id: string }>).map((t) => t.id))

function banks(): Array<{ file: string; bank: DbGroupBank }> {
  const out: Array<{ file: string; bank: DbGroupBank }> = []
  for (const [path, mod] of Object.entries(modules)) {
    if (path.endsWith("index.json")) continue
    out.push({ file: path.split("/").pop()!, bank: mod as unknown as DbGroupBank })
  }
  return out
}

describe("数据库实操营清单 index.json", () => {
  it("四个任务组全部登记且文件真实存在", () => {
    const registered = indexRaw.groups.map((g) => g.group).sort()
    expect(registered).toEqual(["clean", "join", "query", "report"])
    const files = new Set(banks().map((b) => b.file))
    for (const entry of indexRaw.groups) {
      expect(files.has(entry.file), `${entry.file} 未找到`).toBe(true)
    }
  })

  it("rankTexts 四档齐全且非空", () => {
    const rankTexts: Record<string, string> = indexRaw.rankTexts
    for (const rank of ["S", "A", "B", "C"]) {
      expect(rankTexts[rank], `rankTexts.${rank}`).toBeTruthy()
      expect(rankTexts[rank].length).toBeGreaterThanOrEqual(10)
    }
  })
})

describe("数据库实操营内容红线", () => {
  const allTaskIds = new Set<string>()

  for (const { file, bank } of banks()) {
    describe(`任务组 ${file}`, () => {
      it("组结构完整（group/groupName/brief/tasks）", () => {
        expect(bank.group).toBeTruthy()
        expect(bank.groupName).toBeTruthy()
        expect(bank.brief.length).toBeGreaterThanOrEqual(10)
        expect(bank.tasks.length).toBeGreaterThanOrEqual(2)
      })

      it("任务 id 全局唯一且校验要素齐全", () => {
        for (const task of bank.tasks) {
          const at = `${file}/${task.id ?? "?"}`
          expect(task.id, at).toBeTruthy()
          expect(allTaskIds.has(task.id), `任务 id ${task.id} 重复`).toBe(false)
          allTaskIds.add(task.id)
          expect(task.title.length, at).toBeGreaterThanOrEqual(4)
          expect(task.difficulty, at).toBeTruthy()
          expect(task.minutes, at).toBeGreaterThanOrEqual(1)
          expect(task.scene.length, at).toBeGreaterThan(10)
          expect(task.goal.length, at).toBeGreaterThan(5)
          expect(task.check.mode === "result" || task.check.mode === "state", `${at} mode 非法`).toBe(true)
          expect(task.check.sql.length, at).toBeGreaterThan(5)
          expect(Array.isArray(task.check.expect), `${at} expect 必须是数组`).toBe(true)
          expect(task.check.expect.length, at).toBeGreaterThan(0)
          for (const row of task.check.expect) expect(Array.isArray(row), `${at} expect 行必须是数组`).toBe(true)
          if (task.check.unorderedTieColumns !== undefined) {
            expect(task.check.mode, `${at} 并列行配置只适用于结果题`).toBe("result")
            expect(task.check.unorderedTieColumns.length, `${at} 并列键至少一列`).toBeGreaterThan(0)
            for (const column of task.check.unorderedTieColumns) {
              expect(Number.isInteger(column) && column >= 0, `${at} 并列键须为非负整数列索引`).toBe(true)
              expect(task.check.expect.every((row) => column < row.length), `${at} 并列键超出结果列范围`).toBe(true)
            }
          }
          expect(task.answerSql.length, at).toBeGreaterThan(5)
          expect(task.hint.length, at).toBeGreaterThan(5)
          expect(task.explanation.length, at).toBeGreaterThan(20)
          for (const t of task.term_ids ?? []) {
            expect(termIds.has(t), `${at} 引用了不存在的术语 ${t}`).toBe(true)
          }
        }
      })
    })
  }

  it("清洗组必须全部是 state 模式（真的动手改库），查询/关联/报表组必须全部是 result 模式", () => {
    for (const { bank } of banks()) {
      for (const task of bank.tasks) {
        if (bank.group === "clean" && task.id !== "db-c4") {
          expect(task.check.mode, `${task.id} 清洗任务应为 state 模式`).toBe("state")
        }
        if (bank.group !== "clean") {
          expect(task.check.mode, `${task.id} 查询类任务应为 result 模式`).toBe("result")
        }
      }
    }
  })
})
