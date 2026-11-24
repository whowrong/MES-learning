import { describe, expect, it } from "vitest"
import { shouldUsePbProxyAuth } from "../pb"

describe("self-hosted PocketBase auth header routing", () => {
  it("keeps PocketBase tokens separate from the browser Basic Auth header on self-hosted IP sites", () => {
    expect(shouldUsePbProxyAuth("203.0.113.10", true)).toBe(true)
  })

  it("uses direct Authorization only for non-self-hosted direct PocketBase hosts", () => {
    expect(shouldUsePbProxyAuth("203.0.113.10", false)).toBe(false)
    expect(shouldUsePbProxyAuth("localhost", false)).toBe(false)
  })

  it("uses the proxy header for hostname-based deployments", () => {
    expect(shouldUsePbProxyAuth("mes.example.test", false)).toBe(true)
  })
})
