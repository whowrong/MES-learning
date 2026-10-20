// @vitest-environment jsdom
// 全流程冒烟测试：按玩家真实操作路径点按钮推进 story → match → judge → quiz → fill → sort → result，
// 任何一步渲染崩溃（黑屏）都会让本测试失败。题目按「本局抽取子集」游玩；judge 关题目由题库自动衍生。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { useLevel } from "../useLevel"
import { LevelPage } from "../LevelPage"
import type { ProgressRecord } from "@/content/chapters"
import { buildDefaultProgress } from "@/content/chapters"
import ch1Json from "../../../../public/content/levels/ch1.json"
import ch2Json from "../../../../public/content/levels/ch2.json"
import ch3Json from "../../../../public/content/levels/ch3.json"
import ch4Json from "../../../../public/content/levels/ch4.json"
import termsJson from "../../../../public/content/terms.json"
import type { ReactNode } from "react"

const ch1: unknown = ch1Json
const ch2: unknown = ch2Json
const ch3: unknown = ch3Json
const ch4: unknown = ch4Json
const termsData: unknown = termsJson

function jsonRes(data: unknown): Response {
  const res = {
    ok: true,
    status: 200,
    json: async () => data,
  }
  return res as unknown as Response
}

/** 玩家操作入口：hook 返回的 props 直接可调用（配对/提交等），按钮走真实点击 */
let latest: ReturnType<typeof useLevel>

function Harness() {
  const p = useLevel()
  latest = p
  return <LevelPage {...p} />
}

function renderLevel(chapter = 1) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/level?ch=${chapter}`]}>{children}</MemoryRouter>
  )
  return render(<Harness />, { wrapper: Wrapper })
}

async function bootstrap(chapter = 1) {
  renderLevel(chapter)
  await waitFor(() => expect(latest.loading).toBe(false), { timeout: 3000 })
  expect(latest.loadError).toBe("")
}

async function playStory() {
  while (latest.phase === "story") {
    const btn = screen.getByRole("button", { name: /继续|开始闯关/ })
    await act(async () => {
      fireEvent.click(btn)
    })
  }
}

/** 本局连连看全部按正确答案配对并提交 */
function playMatchAllCorrect() {
  const round = latest.roundMatch!
  for (const q of round) act(() => latest.assignConcept(q.answer, q.id))
  expect(latest.matchAllPlaced).toBe(true)
  act(() => latest.submitMatch())
  expect(latest.matchCorrect).toBe(round.length)
}

/** 本局真假鉴定全部答对并推进（每题按 isMatch 判断 yes/no） */
async function playJudgeAllCorrect() {
  const total = latest.judgeTotal
  expect(total).toBeGreaterThan(0)
  for (let i = 0; i < total; i++) {
    expect(latest.phase).toBe("judge")
    const v = latest.judgeQuestionView!
    act(() => latest.pickJudgeAnswer(v.isMatch ? "yes" : "no"))
    act(() => latest.submitJudgeProblem())
    expect(latest.judgeQuestionView?.judged).toBe(true)
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: i === total - 1 ? /完成鉴定/ : /下一题/ }),
      )
    })
  }
}

/** 本局抉择关全部答对并推进到下一关 */
async function playQuizAllCorrect() {
  const round = latest.roundQuiz!
  for (let i = 0; i < round.length; i++) {
    expect(latest.phase).toBe("quiz")
    act(() => latest.pickQuizOption(round[i].answer))
    act(() => latest.submitQuizQuestion())
    expect(latest.quizQuestionView?.judged).toBe(true)
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: i === round.length - 1 ? /完成抉择/ : /下一题/ }),
      )
    })
  }
}

/** 本局填空关全部答对并推进到下一关 */
async function playFillAllCorrect() {
  const round = latest.roundFill!
  for (let i = 0; i < round.length; i++) {
    expect(latest.phase).toBe("fill")
    act(() => latest.pickFillOption(round[i].answer))
    act(() => latest.submitFillQuestion())
    expect(latest.fillQuestionView?.judged).toBe(true)
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: i === round.length - 1 ? /完成填空/ : /下一题/ }),
      )
    })
  }
}

beforeEach(() => {
  const saved: ProgressRecord & { id: string } = { ...buildDefaultProgress(), id: "rec1" }
  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input)
    if (url.includes("terms.json")) return jsonRes(termsData)
    if (url.includes("levels/index.json")) {
      return jsonRes({
        levels: [
          { chapter: 1, file: "ch1.json" },
          { chapter: 2, file: "ch2.json" },
          { chapter: 3, file: "ch3.json" },
          { chapter: 4, file: "ch4.json" },
        ],
      })
    }
    if (url.includes("levels/ch4.json")) return jsonRes(ch4)
    if (url.includes("levels/ch3.json")) return jsonRes(ch3)
    if (url.includes("levels/ch2.json")) return jsonRes(ch2)
    if (url.includes("levels/ch1.json")) return jsonRes(ch1)
    if (url.includes("/api/player_progress")) {
      const method = init?.method ?? "GET"
      if (method === "PATCH") return jsonRes({ ok: true })
      if (method === "POST") return jsonRes({ id: "rec1" })
      return jsonRes({ items: [saved] })
    }
    throw new Error(`测试里出现意料之外的请求: ${url}`)
  })
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("第一章全流程（黑屏回归）", () => {
  it("story → 本局抽 12 条全对提交 → 进入真假鉴定（衍生 12 题）", async () => {
    await bootstrap()
    expect(latest.phase).toBe("story")
    await playStory()
    expect(latest.phase).toBe("match")

    // 抽题制：题库 41 条，本局只上场 12 条，且都来自题库
    const bank = latest.matchStage!.quotes
    expect(bank.length).toBe(41)
    const round = latest.roundMatch!
    expect(round.length).toBe(12)
    for (const q of round) expect(bank.some((b) => b.id === q.id)).toBe(true)

    playMatchAllCorrect()

    // 关键复现点：点真实按钮推进——之前用户在这里黑屏
    const nextBtn = screen.getByRole("button", { name: "进入下一关：真假鉴定" })
    await act(async () => {
      fireEvent.click(nextBtn)
    })
    expect(latest.phase).toBe("judge")
    // 鉴定题从题库衍生：6 句 × 2 = 12 题
    expect(latest.judgeTotal).toBe(12)
    expect(screen.getAllByText(latest.judgeStage!.title).length).toBeGreaterThan(0)
  })

  it("概念槽计数：两条引语配到同一概念显示 ×2（从 answers 聚合，与本局题目一致）", async () => {
    await bootstrap()
    await playStory()
    const round = latest.roundMatch!
    const [q0, q1] = round
    // 故意把第二条也配到第一条的正确概念上（只测计数 UI，不管对错）
    act(() => latest.assignConcept(q0.answer, q0.id))
    act(() => latest.assignConcept(q0.answer, q1.id))
    expect(latest.matchAnswers[q1.id]).toBe(q0.answer)
    expect(screen.getAllByText("×2").length).toBeGreaterThan(0)
  })

  it("拖拽链路：dragStart → drop 完成配对（dataTransfer 读不到时走兜底）", async () => {
    await bootstrap()
    await playStory()
    const q1 = latest.roundMatch![0]
    const card = screen.getByText(q1.text).closest('[draggable="true"]')
    expect(card).toBeTruthy()
    const store: Record<string, string> = {}
    fireEvent.dragStart(card!, {
      dataTransfer: {
        setData: (k: string, v: string) => {
          store[k] = v
        },
        getData: (k: string) => store[k] ?? "",
      },
    })
    expect(store["text/plain"]).toBe(q1.id)
    // drop 时 getData 返回空串，模拟个别浏览器读不到 MIME —— 应走组件内兜底
    const termName = latest.terms[q1.answer].term
    const slot = screen.getAllByText(termName)[0]
    fireEvent.drop(slot, { dataTransfer: { getData: () => "", setData: () => {} } })
    expect(latest.matchAnswers[q1.id]).toBe(q1.answer)
    // 配对后引语卡上出现选择徽标（badge 文本形如「→ 工单×」）
    expect(screen.getByText(new RegExp(`→ ${termName}`))).toBeTruthy()
  })

  it("UI 点击路径：点引语卡→点概念槽术语名即配对（不弹术语卡），同槽第二条计数 ×2", async () => {
    await bootstrap()
    await playStory()
    const round = latest.roundMatch!
    const [q0, q1] = round
    const termName = latest.terms[q0.answer].term

    const card1 = screen.getByText(q0.text).closest('[draggable="true"]')
    fireEvent.click(card1!)
    fireEvent.click(screen.getAllByText(termName)[0])
    expect(latest.matchAnswers[q0.id]).toBe(q0.answer)
    expect(screen.getAllByText("×1").length).toBeGreaterThan(0)
    // 点术语名必须完成配对，而不是弹出术语卡
    expect(latest.termCard).toBeNull()

    const card2 = screen.getByText(q1.text).closest('[draggable="true"]')
    fireEvent.click(card2!)
    fireEvent.click(screen.getAllByText(termName)[0])
    expect(latest.matchAnswers[q1.id]).toBe(q0.answer)
    expect(screen.getAllByText("×2").length).toBeGreaterThan(0)
  })

  it("手机端：选中引语弹出底部概念抽屉，点概念即配对，不用滚动找侧栏", async () => {
    // 模拟窄屏：matchMedia 命中 max-width:1023px
    const origMM = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width: 1023px"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }))
    try {
      await bootstrap()
      await playStory()
      const q0 = latest.roundMatch![0]
      const card = screen.getByText(q0.text).closest('[draggable="true"]')
      fireEvent.click(card!)
      // 底部抽屉弹出
      const drawer = screen.getByRole("dialog", { name: "选择概念" })
      expect(drawer).toBeTruthy()
      // 在抽屉里点目标概念 → 配对完成、抽屉关闭（selectedQuote 清空）
      const termName = latest.terms[q0.answer].term
      fireEvent.click(within(drawer as HTMLElement).getAllByText(termName)[0])
      expect(latest.matchAnswers[q0.id]).toBe(q0.answer)
      expect(screen.queryByRole("dialog", { name: "选择概念" })).toBeNull()
      expect(latest.selectedQuote).toBeNull()
    } finally {
      window.matchMedia = origMM
    }
  })

  it("judge → quiz → sort → 结算页渲染总评分", async () => {
    await bootstrap()
    await playStory()
    playMatchAllCorrect()
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "进入下一关：真假鉴定" }))
    })
    await playJudgeAllCorrect()
    expect(latest.phase).toBe("quiz")
    await playQuizAllCorrect()
    expect(latest.phase).toBe("sort")

    // 排序：两次提交（第二次后揭晓正解），点「完成本章 · 查看结算」
    act(() => latest.submitSort())
    act(() => latest.submitSort())
    expect(latest.sortRevealed).toBe(true)
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /完成本章 · 查看结算/ }))
    })
    await waitFor(() => expect(latest.phase).toBe("result"))

    // 结算页：总评分卡渲染；排序按打乱序直接提交，分数按本局实际答对数核算
    expect(latest.chapterScore).not.toBeNull()
    const totalPoints =
      latest.roundMatch!.length + latest.judgeTotal + latest.roundQuiz!.length + latest.sortStage!.steps.length
    const expectedCorrect =
      latest.roundMatch!.length + latest.judgeTotal + latest.roundQuiz!.length + (latest.sortStage!.steps.length - latest.sortWrongCount)
    expect(latest.chapterScore!.score).toBe(Math.round((expectedCorrect / totalPoints) * 100))
    expect(latest.chapterScore!.total).toBe(totalPoints)
    expect(screen.getByText("总评分")).toBeTruthy()
    expect(screen.getByText("项目仪表变动分解")).toBeTruthy()
    expect(fetchMockCalls().some((c) => c.method === "PATCH")).toBe(true)
  })

  it("有错题时：判定后展示正确答案对照，错题术语进复习队列", async () => {
    await bootstrap()
    await playStory()

    const round = latest.roundMatch!
    const first = round[0]
    const wrongConcept = latest.matchStage!.concepts.find((c) => c !== first.answer)!
    act(() => latest.assignConcept(wrongConcept, first.id))
    for (const q of round.slice(1)) act(() => latest.assignConcept(q.answer, q.id))
    act(() => latest.submitMatch())
    expect(latest.matchCorrect).toBe(round.length - 1)
    // 错题卡上直接亮出「正确答案：xx」（quote 卡本身也是 role=button，用 getAll）
    expect(screen.getAllByRole("button", { name: /正确答案：/ }).length).toBeGreaterThan(0)

    // 穿过鉴定关（全对），抉择故意答错本局第一题
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "进入下一关：真假鉴定" }))
    })
    await playJudgeAllCorrect()
    const quizRound = latest.roundQuiz!
    const zFirst = quizRound[0]
    const wrongOpt = zFirst.options.find((o) => o.id !== zFirst.answer)!
    act(() => latest.pickQuizOption(wrongOpt.id))
    act(() => latest.submitQuizQuestion())
    expect(screen.getByText(/正确答案是：/)).toBeTruthy()
    for (let i = 0; i < quizRound.length; i++) {
      if (i > 0) {
        act(() => latest.pickQuizOption(quizRound[i].answer))
        act(() => latest.submitQuizQuestion())
      }
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: i === quizRound.length - 1 ? /完成抉择/ : /下一题/ }))
      })
    }

    act(() => latest.submitSort())
    act(() => latest.submitSort())
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /完成本章 · 查看结算/ }))
    })
    await waitFor(() => expect(latest.phase).toBe("result"))

    // 错题涉及术语进复习队列，分数低于满分
    expect(latest.chapterScore!.score).toBeLessThan(100)
    expect(latest.newReviewTerms).toContain(first.term_ids[0])
    expect(screen.getByText("这些概念进了你的复习队列")).toBeTruthy()
  })
})

describe("第二章全流程（脏数据清洗）", () => {
  it("story → 台账体检 → 台账鉴定 → 抉择 → 填空 → 排序 → 结算走内容配置并解锁第三章", async () => {
    await bootstrap(2)
    expect(latest.level?.chapter).toBe(2)
    await playStory()

    expect(latest.matchStage!.quotes.length).toBe(34)
    expect(latest.roundMatch!.length).toBe(11)
    expect(latest.matchStage!.concepts.length).toBe(5)
    playMatchAllCorrect()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "进入下一关：真假鉴定" }))
    })
    expect(latest.judgeTotal).toBe(10) // 5 句 × 2
    await playJudgeAllCorrect()

    expect(latest.phase).toBe("quiz")
    expect(latest.roundQuiz!.length).toBe(3)
    await playQuizAllCorrect()

    expect(latest.phase).toBe("fill")
    expect(latest.roundFill!.length).toBe(2)
    await playFillAllCorrect()
    expect(latest.phase).toBe("sort")

    act(() => latest.submitSort())
    act(() => latest.submitSort())
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /完成本章 · 查看结算/ }))
    })
    await waitFor(() => expect(latest.phase).toBe("result"))

    // 第二章结算走内容文件里的 settlement 配置：数据准确率每错 1 处 -3
    const acc = latest.resultDeltas.find((d) => d.key === "dataAccuracy")!
    expect(acc.delta).toBe(latest.sortWrongCount > 0 ? -3 * latest.sortWrongCount : 0)
    expect(latest.resultDeltas.find((d) => d.key === "projectProgress")?.delta).toBe(15)
    expect(latest.chapterState["2"]).toBe("cleared")
    expect(latest.chapterState["3"]).toBe("open")
    expect(screen.getByText("总评分")).toBeTruthy()
  })
})

describe("第三章全流程（建模与配置）", () => {
  it("story → 配台连连看 → 配置鉴定 → 抉择 → 填空 → 排序 → 结算含预算工期扣分并解锁第四章", async () => {
    await bootstrap(3)
    expect(latest.level?.chapter).toBe(3)
    await playStory()

    expect(latest.matchStage!.quotes.length).toBe(36)
    expect(latest.roundMatch!.length).toBe(12)
    expect(latest.matchStage!.concepts.length).toBe(8)
    playMatchAllCorrect()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "进入下一关：真假鉴定" }))
    })
    expect(latest.judgeTotal).toBe(12) // 6 句 × 2
    await playJudgeAllCorrect()

    expect(latest.phase).toBe("quiz")
    expect(latest.roundQuiz!.length).toBe(3)
    await playQuizAllCorrect()

    expect(latest.phase).toBe("fill")
    expect(latest.roundFill!.length).toBe(2)
    await playFillAllCorrect()
    expect(latest.phase).toBe("sort")

    act(() => latest.submitSort())
    act(() => latest.submitSort())
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /完成本章 · 查看结算/ }))
    })
    await waitFor(() => expect(latest.phase).toBe("result"))

    // 第三章结算：进度 +15；数据准确率每错 -3、预算工期每错 -2（排序错步按实际数）
    expect(latest.resultDeltas.find((d) => d.key === "projectProgress")?.delta).toBe(15)
    const acc = latest.resultDeltas.find((d) => d.key === "dataAccuracy")!
    const budget = latest.resultDeltas.find((d) => d.key === "budgetLeft")!
    expect(acc.delta).toBe(latest.sortWrongCount > 0 ? -3 * latest.sortWrongCount : 0)
    expect(budget.delta).toBe(latest.sortWrongCount > 0 ? -2 * latest.sortWrongCount : 0)
    // 通关打卡 + 解锁第四章
    expect(latest.chapterState["3"]).toBe("cleared")
    expect(latest.chapterState["4"]).toBe("open")
    const patched = fetchMockCalls().filter((c) => c.method === "PATCH")
    expect(patched.length).toBeGreaterThan(0)
  })
})

describe("第四章全流程（执行与报工）", () => {
  it("story → 现场连连看 → 现场鉴定 → 抉择 → 填空 → 排序 → 结算含库存准确率扣分并解锁第五章", async () => {
    await bootstrap(4)
    expect(latest.level?.chapter).toBe(4)
    await playStory()

    expect(latest.matchStage!.quotes.length).toBe(25)
    expect(latest.roundMatch!.length).toBe(12)
    expect(latest.matchStage!.concepts.length).toBe(8)
    playMatchAllCorrect()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "进入下一关：真假鉴定" }))
    })
    expect(latest.judgeTotal).toBe(12) // 6 句 × 2
    await playJudgeAllCorrect()

    expect(latest.phase).toBe("quiz")
    expect(latest.roundQuiz!.length).toBe(3)
    await playQuizAllCorrect()

    expect(latest.phase).toBe("fill")
    expect(latest.roundFill!.length).toBe(2)
    await playFillAllCorrect()
    expect(latest.phase).toBe("sort")

    act(() => latest.submitSort())
    act(() => latest.submitSort())
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /完成本章 · 查看结算/ }))
    })
    await waitFor(() => expect(latest.phase).toBe("result"))

    // 第四章结算：进度 +15；数据准确率每错 -3、库存准确率每错 -2（排序错步按实际数）
    expect(latest.resultDeltas.find((d) => d.key === "projectProgress")?.delta).toBe(15)
    const acc = latest.resultDeltas.find((d) => d.key === "dataAccuracy")!
    const inv = latest.resultDeltas.find((d) => d.key === "inventoryAccuracy")!
    expect(acc.delta).toBe(latest.sortWrongCount > 0 ? -3 * latest.sortWrongCount : 0)
    expect(inv.delta).toBe(latest.sortWrongCount > 0 ? -2 * latest.sortWrongCount : 0)
    // 通关打卡 + 解锁第五章
    expect(latest.chapterState["4"]).toBe("cleared")
    expect(latest.chapterState["5"]).toBe("open")
    const patched = fetchMockCalls().filter((c) => c.method === "PATCH")
    expect(patched.length).toBeGreaterThan(0)
  })
})

function fetchMockCalls(): Array<{ method: string }> {
  const mock = fetch as unknown as ReturnType<typeof vi.fn>
  return mock.mock.calls.map((c) => ({ method: (c[1]?.method as string) ?? "GET" }))
}
