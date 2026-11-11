// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  pbFetch: vi.fn(),
  getPocketBaseUrl: vi.fn(() => "/__pb"),
}))

vi.mock("@/lib/pb", () => mocks)

import { SiteFeedback } from "../SiteFeedback"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("SiteFeedback", () => {
  it("submits a note and shows the confirmation", async () => {
    mocks.pbFetch.mockResolvedValueOnce({ ok: true })
    render(<SiteFeedback />)
    fireEvent.change(screen.getByLabelText("反馈内容"), { target: { value: "希望增加更多工单案例" } })
    fireEvent.click(screen.getByRole("button", { name: "提交反馈" }))
    await waitFor(() => expect(mocks.pbFetch).toHaveBeenCalledWith("/__pb/api/site_feedback", expect.objectContaining({ method: "POST" })))
    expect(JSON.parse(mocks.pbFetch.mock.calls[0][1].body)).toMatchObject({ message: "希望增加更多工单案例" })
    expect(await screen.findByText("谢谢你，反馈已收到！")).toBeTruthy()
  })

  it("shows a recoverable error if submission fails", async () => {
    mocks.pbFetch.mockResolvedValueOnce({ ok: false })
    render(<SiteFeedback />)
    fireEvent.change(screen.getByLabelText("反馈内容"), { target: { value: "测试反馈" } })
    fireEvent.click(screen.getByRole("button", { name: "提交反馈" }))
    expect(await screen.findByText("暂时没提交成功，请稍后再试。")).toBeTruthy()
  })
})
