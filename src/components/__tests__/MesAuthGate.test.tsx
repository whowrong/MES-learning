// @vitest-environment jsdom
// 站内登录入口的响应式回归测试。
//
// 背景：登录入口原来是 fixed right-3 top-3，和 sticky 顶栏（h-16）同高，
// 手机上直接压住顶栏右上角的「术语卡库 / 自由沙盘」按钮，点不到；宽屏展开后同样压住。
// 修复后：所有宽度一律锚到顶栏正下方（top-16），窄屏收成 40x40 图标，宽屏保留文字按钮，
// 两种宽度下都不再覆盖顶栏的原有可交互元素。
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { MesAuthGate } from "@/components/MesAuthGate"

afterEach(() => {
  cleanup()
})

describe("站内登录入口的响应式定位", () => {
  it("所有宽度都锚在顶栏正下方，不再与顶栏同高", () => {
    render(
      <MesAuthGate>
        <div>页面内容</div>
      </MesAuthGate>,
    )
    const entry = screen.getByTestId("mes-auth-entry")
    const cls = entry.className
    // top-16 = 4rem，正好在 h-16 顶栏下方，窄屏宽屏都不再压住顶栏按钮
    expect(cls).toContain("top-16")
    expect(cls).toContain("right-2")
    expect(cls).toContain("sm:right-3")
    // 关键回归：不能再出现 sm:top-3（宽屏展开后会盖住「术语卡库 / 自由沙盘」）
    expect(cls).not.toContain("sm:top-3")
    expect(cls).not.toContain(" top-3")
  })

  it("窄屏收成图标按钮，宽屏才显示文字", () => {
    render(
      <MesAuthGate>
        <div>页面内容</div>
      </MesAuthGate>,
    )
    const summary = screen.getByTestId("mes-auth-summary")
    expect(summary.className).toContain("h-10")
    expect(summary.className).toContain("w-10")
    expect(summary.className).toContain("sm:h-auto")
    expect(summary.className).toContain("sm:w-auto")
    const icon = summary.querySelector("svg")
    expect(icon?.getAttribute("class")).toContain("sm:hidden")
    const label = screen.getByText("实操 / 存档登录")
    expect(label.className).toContain("hidden")
    expect(label.className).toContain("sm:inline")
  })

  it("登录标识输入框仍是自由文本，标签仍是「账号」", () => {
    const { container } = render(
      <MesAuthGate>
        <div>页面内容</div>
      </MesAuthGate>,
    )
    const input = container.querySelector('input[autocomplete="username"]') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.closest("label")?.textContent).toContain("账号")
    expect(input.type).toBe("text")
    expect(input.getAttribute("autocomplete")).toBe("username")
    expect(screen.getByLabelText("密码").getAttribute("type")).toBe("password")
  })
})
