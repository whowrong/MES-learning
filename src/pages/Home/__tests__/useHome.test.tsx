// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, renderHook, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

const mocks = vi.hoisted(() => ({
  authStore: {
    isValid: false as boolean,
    model: null as { collectionName?: string } | null,
    onChange: vi.fn(),
  },
  pbFetch: vi.fn(),
  getPocketBaseUrl: vi.fn(() => "/mes/__pb"),
}))

vi.mock("@/lib/pb", () => ({
  pb: { authStore: mocks.authStore },
  pbFetch: mocks.pbFetch,
  getPocketBaseUrl: mocks.getPocketBaseUrl,
}))

import { useHome } from "../useHome"

afterEach(() => cleanup())
beforeEach(() => {
  mocks.authStore.isValid = false
  mocks.authStore.model = null
  mocks.authStore.onChange.mockReset()
  mocks.pbFetch.mockReset()
})

describe("useHome progress loading", () => {
  it("retries the saved progress read after self-hosted login succeeds", async () => {
    let onAuthChange: (() => void) | undefined
    mocks.authStore.onChange.mockImplementation((callback: () => void) => {
      onAuthChange = callback
      return () => {}
    })
    mocks.pbFetch
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: "saved-progress" }] }) })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter>{children}</MemoryRouter>
    )
    const { result } = renderHook(() => useHome(), { wrapper })
    await waitFor(() => expect(result.current.loadError).toContain("存档读取失败"))

    mocks.authStore.isValid = true
    mocks.authStore.model = { collectionName: "mes_users" }
    onAuthChange?.()

    await waitFor(() => expect(result.current.recordId).toBe("saved-progress"))
    expect(result.current.loadError).toBe("")
    expect(mocks.pbFetch).toHaveBeenCalledTimes(2)
  })
})
