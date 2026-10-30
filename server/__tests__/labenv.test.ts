// 一次性 Docker 演练环境的端口分配测试（服务端执行器的纯函数）。
//
// 这个文件在 server/ 下而不是 src/ 下：src 的 tsconfig 不带 node 类型，
// 而端口探测要用 node:net（绑一个监听端口来验证「占用 -> 不可用」）。
import { describe, expect, it } from "vitest"
import net from "node:net"
import { isPortFree, pickPort } from "../labenv.mjs"

describe("一次性环境的端口分配", () => {
  it("被占用的端口判为不可用，释放后恢复可用", async () => {
    const srv = net.createServer()
    await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", () => resolve()))
    const port = (srv.address() as net.AddressInfo).port
    expect(await isPortFree(port)).toBe(false)
    await new Promise<void>((resolve) => srv.close(() => resolve()))
    expect(await isPortFree(port)).toBe(true)
  })

  it("挑出来的端口落在给定区间内，且避开已占用端口", async () => {
    const range: [number, number] = [14300, 14349]
    const port = await pickPort(range)
    expect(port).not.toBeNull()
    expect(port as number).toBeGreaterThanOrEqual(range[0])
    expect(port as number).toBeLessThanOrEqual(range[1])
    const second = await pickPort(range, [port as number])
    expect(second).not.toBe(port)
  })

  it("不会挑中现网占用端口段", async () => {
    const port = await pickPort([14200, 14249])
    expect(port).not.toBeNull()
    expect([8090, 8091, 8080, 3307, 8099, 22, 80, 443]).not.toContain(port as number)
  })
})
