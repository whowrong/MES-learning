// @vitest-environment jsdom
// 站内登录入口的响应式回归测试。
//
// 背景：登录入口原来是 fixed right-3 top-3，和 sticky 顶栏（h-16）同高，
// 手机上直接压住顶栏右上角的「术语卡库 / 自由沙盘」按钮，点不到。
// 修复后：窄屏（<sm）入口落到顶栏下方（top-16）并收成图标，宽屏（>=sm）保持原位置与外观。
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { MesAuthGate } from "@/components/MesAuthGate"

describe("站内登录入口的响应式定位", () => {
  it("窄屏落在顶栏下方，宽屏保持原来的右上角位置", () => {
    render(
      <MesAuthGate>
        <div>页面内容</div>
      </MesAuthGate>,
    )
    const entry = screen.getByTestId("mes-auth-entry")
    const cls = entry.className
    // 窄屏：top-16 = 4rem，正好在 h-16 顶栏下方，不再压住顶栏按钮
    expect(cls).toContain("top-16")
    expect(cls).toContain("right-2")
    // 宽屏：桌面端位置与外观保持原样
    expect(cls).toContain("sm:top-3")
    expect(cls).toContain("sm:right-3")
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
