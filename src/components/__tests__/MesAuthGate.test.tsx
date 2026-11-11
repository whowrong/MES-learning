// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  authStore: {
    isValid: false as boolean,
    model: null as { collectionName?: string } | null,
    onChange: vi.fn(() => () => {}),
    clear: vi.fn(),
  },
  authWithPassword: vi.fn(),
}))

vi.mock("@/lib/pb", () => ({
  pb: {
    authStore: mocks.authStore,
    collection: () => ({ authWithPassword: mocks.authWithPassword }),
  },
}))

import { MesAuthGate, MesAuthTrigger } from "../MesAuthGate"

afterEach(() => cleanup())
beforeEach(() => {
  mocks.authStore.isValid = false
  mocks.authStore.model = null
  mocks.authStore.onChange.mockClear()
  mocks.authStore.clear.mockClear()
  mocks.authWithPassword.mockReset()
})

describe("MesAuthGate", () => {
  it("keeps the page unobstructed until the navigation login entry is opened", () => {
    render(<MesAuthGate><nav><MesAuthTrigger /></nav><main>学习内容</main></MesAuthGate>)
    expect(screen.getByText("学习内容")).toBeTruthy()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByLabelText("账号")).toBeNull()
    const trigger = screen.getByRole("button", { name: "打开登录面板" })
    expect(trigger.className).toContain("border-primary/40")
    expect(trigger.className).not.toContain("fixed")
    fireEvent.click(trigger)
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(screen.getByLabelText("账号")).toBeTruthy()
  })

  it("authenticates by username and closes the dialog on success", async () => {
    mocks.authWithPassword.mockResolvedValueOnce({})
    render(<MesAuthGate><nav><MesAuthTrigger /></nav><main>学习内容</main></MesAuthGate>)
    fireEvent.click(screen.getByRole("button", { name: "打开登录面板" }))
    fireEvent.change(screen.getByLabelText("账号"), { target: { value: " monika " } })
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "example-password" } })
    fireEvent.click(screen.getByRole("button", { name: "登录" }))
    await waitFor(() => expect(mocks.authWithPassword).toHaveBeenCalledWith("monika", "example-password"))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
})
