// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  authStore: {
    isValid: false as boolean,
    model: null as { collectionName?: string } | null,
    onChange: vi.fn((_callback: () => void, _immediate?: boolean) => () => {}),
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

import { MesAuthGate } from "../MesAuthGate"

beforeEach(() => {
  mocks.authStore.isValid = false
  mocks.authStore.model = null
  mocks.authStore.onChange.mockClear()
  mocks.authStore.clear.mockClear()
  mocks.authWithPassword.mockReset()
})

afterEach(() => cleanup())

describe("MesAuthGate", () => {
  it("keeps the page unobstructed until the login button is opened", () => {
    render(<MesAuthGate><main>学习内容</main></MesAuthGate>)

    expect(screen.getByText("学习内容")).toBeTruthy()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByLabelText("邮箱")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "打开登录面板" }))
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(screen.getByLabelText("邮箱")).toBeTruthy()
  })

  it("submits login credentials and closes the dialog on success", async () => {
    mocks.authWithPassword.mockResolvedValueOnce({})
    render(<MesAuthGate><main>学习内容</main></MesAuthGate>)
    fireEvent.click(screen.getByRole("button", { name: "打开登录面板" }))
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "learner@example.com" } })
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "example-password" } })
    fireEvent.click(screen.getByRole("button", { name: "登录" }))

    await waitFor(() => expect(mocks.authWithPassword).toHaveBeenCalledWith("learner@example.com", "example-password"))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
})
