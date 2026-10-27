// 数据库实操营纯逻辑单测：结果对比判定 / 计分 / SQL 安全检测
import { describe, expect, it } from "vitest"
import {
  detectDangerousSql,
  isReadOnlySql,
  judgeTaskResult,
  normalizeCell,
  scoreByAttempts,
  scoreTaskGroup,
  rankForDbScore,
} from "../dbTraining"

describe("normalizeCell 单元格归一化", () => {
  it("null/undefined 等价，数字按值比较，字符串去首尾空格", () => {
    expect(normalizeCell(null)).toBe("NULL")
    expect(normalizeCell(undefined)).toBe("NULL")
    expect(normalizeCell(1)).toBe("1")
    expect(normalizeCell(1.0)).toBe("1")
    expect(normalizeCell(26.2)).toBe("26.2")
    expect(normalizeCell(" 轴承 ")).toBe("轴承")
    expect(normalizeCell(true)).toBe("1")
  })
})

describe("judgeTaskResult 结果集判定", () => {
  const expectRows = [
    ["WO-1", 10, 2],
    ["WO-2", 5, 0],
  ]

  it("完全一致通过", () => {
    const v = judgeTaskResult(expectRows, expectRows)
    expect(v.passed).toBe(true)
  })

  it("数字与字符串形式等价（10 vs '10'）通过", () => {
    const v = judgeTaskResult([["WO-1", "10", "2"], ["WO-2", "5", "0"]], expectRows)
    expect(v.passed).toBe(true)
  })

  it("行数不对给出定位提示", () => {
    const v = judgeTaskResult([["WO-1", 10, 2]], expectRows)
    expect(v.passed).toBe(false)
    expect(v.diffHint).toContain("行数")
  })

  it("列数不对给出定位提示", () => {
    const v = judgeTaskResult([["WO-1", 10], ["WO-2", 5]], expectRows)
    expect(v.passed).toBe(false)
    expect(v.diffHint).toContain("列数")
  })

  it("单元格差异指出行列位置", () => {
    const v = judgeTaskResult([["WO-1", 10, 3], ["WO-2", 5, 0]], expectRows)
    expect(v.passed).toBe(false)
    expect(v.diffHint).toContain("第 1 行第 3 列")
  })

  it("顺序敏感：行序不同不通过", () => {
    const v = judgeTaskResult([["WO-2", 5, 0], ["WO-1", 10, 2]], expectRows)
    expect(v.passed).toBe(false)
  })

  it("仅允许相同排序键的并列行互换，组间排序仍严格", () => {
    const expected = [["钱秀英", "装配班", 10, 91], ["吴秀英", "装配班", 10, 100], ["韩秀英", "电气班", 8, 52]]
    const tiedRowsReversed = [["吴秀英", "装配班", 10, 100], ["钱秀英", "装配班", 10, 91], ["韩秀英", "电气班", 8, 52]]
    expect(judgeTaskResult(tiedRowsReversed, expected, [2]).passed).toBe(true)
    expect(judgeTaskResult([expected[2], expected[0], expected[1]], expected, [2]).passed).toBe(false)
    expect(judgeTaskResult([["钱秀英", "装配班", 10, 999], expected[1], expected[2]], expected, [2]).passed).toBe(false)
  })
})

describe("计分", () => {
  it("第 1 次提交通过 100，第 2 次 80，第 3 次及以后 60，看答案 60", () => {
    expect(scoreByAttempts(1, false)).toBe(100)
    expect(scoreByAttempts(2, false)).toBe(80)
    expect(scoreByAttempts(3, false)).toBe(60)
    expect(scoreByAttempts(9, false)).toBe(60)
    expect(scoreByAttempts(1, true)).toBe(60)
  })

  it("组总分 = 平均（四舍五入）", () => {
    expect(scoreTaskGroup([100, 80, 60])).toBe(80)
    expect(scoreTaskGroup([100, 100, 60])).toBe(87)
    expect(scoreTaskGroup([])).toBe(0)
  })

  it("档位与全站一致", () => {
    expect(rankForDbScore(100)).toBe("S")
    expect(rankForDbScore(90)).toBe("A")
    expect(rankForDbScore(75)).toBe("B")
    expect(rankForDbScore(50)).toBe("C")
  })
})

describe("SQL 安全检测", () => {
  it("只读判定：SELECT/WITH/SHOW/EXPLAIN 是只读，其余不是", () => {
    expect(isReadOnlySql("SELECT * FROM t")).toBe(true)
    expect(isReadOnlySql("  with x as (select 1) select * from x")).toBe(true)
    expect(isReadOnlySql("SHOW TABLES")).toBe(true)
    expect(isReadOnlySql("EXPLAIN SELECT 1")).toBe(true)
    expect(isReadOnlySql("UPDATE t SET a=1")).toBe(false)
    expect(isReadOnlySql("DELETE FROM t")).toBe(false)
  })

  it("无 WHERE 的 DELETE/UPDATE 触发 warn", () => {
    const d1 = detectDangerousSql("DELETE FROM work_orders", false)
    expect(d1.length).toBe(1)
    expect(d1[0].label).toContain("DELETE")
    const d2 = detectDangerousSql("UPDATE items SET unit='个'", false)
    expect(d2.length).toBe(1)
    expect(d2[0].label).toContain("UPDATE")
  })

  it("带 WHERE 的 DELETE/UPDATE 不触发", () => {
    expect(detectDangerousSql("DELETE FROM t WHERE id=1", false)).toHaveLength(0)
    expect(detectDangerousSql("UPDATE t SET a=1 WHERE id=2", false)).toHaveLength(0)
  })

  it("DROP / TRUNCATE 触发 warn", () => {
    expect(detectDangerousSql("DROP TABLE items", false)[0].label).toContain("DROP")
    expect(detectDangerousSql("truncate table items", false)[0].label).toContain("TRUNCATE")
  })

  it("只读保护模式：非只读语句被 block 级拦截", () => {
    const d = detectDangerousSql("UPDATE t SET a=1 WHERE id=2", true)
    expect(d.length).toBe(1)
    expect(d[0].level).toBe("block")
  })

  it("只读保护模式：SELECT 放行", () => {
    expect(detectDangerousSql("SELECT 1", true)).toHaveLength(0)
  })

  it("多语句逐条检测", () => {
    const d = detectDangerousSql("SELECT 1; DELETE FROM t; UPDATE x SET a=1 WHERE b=2", false)
    expect(d.length).toBe(1)
  })

  it("注释开头不误判：起始提示注释行后仍是只读 SELECT（v1.14.1 回归）", () => {
    expect(isReadOnlySql("-- 提示：多种取值归类用 IN\nSELECT COUNT(*) FROM t")).toBe(true)
    expect(isReadOnlySql("/* 块注释 */\n-- 行注释\nWITH x AS (SELECT 1) SELECT * FROM x")).toBe(true)
    expect(isReadOnlySql("-- 注释\nUPDATE t SET a=1")).toBe(false)
  })

  it("注释不能绕过危险语句确认弹窗", () => {
    expect(detectDangerousSql("-- 清库\nDROP TABLE items", false)[0].label).toContain("DROP")
    expect(detectDangerousSql("/* x */ DELETE FROM work_orders", false)[0].label).toContain("DELETE")
  })
})
