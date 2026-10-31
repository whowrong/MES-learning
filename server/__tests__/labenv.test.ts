// 一次性 Docker 演练环境的端口分配测试（服务端执行器的纯函数）。
//
// 这个文件在 server/ 下而不是 src/ 下：src 的 tsconfig 不带 node 类型，
// 而端口探测要用 node:net（绑一个监听端口来验证「占用 -> 不可用」）。
import { describe, expect, it } from "vitest"
import net from "node:net"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { isPortFree, pickPort, readRequestJson, removeArgs, removeContainer } from "../labenv.mjs"

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

// 销毁路径的防回归测试。
//
// 背景：mysql / postgres / openssh-server 镜像都自带 VOLUME 声明，docker run
// 每次都会生成一个匿名卷；曾经销毁容器只用了 `rm -f`，卷全留在磁盘上——
// 一轮 E2E 就攒下 47 个卷、4.7GB，根分区被吃满。下面三例把这个坑钉死。
function dockerRun(args: string[]) {
  return spawnSync("docker", args, { encoding: "utf8", timeout: 60000 })
}
const hasDocker = dockerRun(["info"]).status === 0
const anyLocalImage = ["mysql:8.0", "postgres:16-alpine", "busybox:latest"]
  .find((img) => dockerRun(["image", "inspect", img]).status === 0)

describe("一次性环境的销毁（不留匿名卷）", () => {
  it("销毁命令同时带 -f 与 -v：连同容器自动生成的匿名卷一起删", () => {
    const args = removeArgs("mes-lab-labenv-abc123") as string[]
    expect(args).not.toBeNull()
    // -f 强制删除（容器还在跑也能删），-v 连同匿名卷一起删
    const flags = args.filter((a) => a.startsWith("-")).join("")
    expect(flags).toContain("f")
    expect(flags).toContain("v")
    expect(args.join(" ")).toBe("rm -fv mes-lab-labenv-abc123")
  })

  it("只允许销毁 mes-lab- 前缀的容器，绝不碰现网服务", () => {
    expect(removeArgs("nginx")).toBeNull()
    expect(removeArgs("mes-pocketbase")).toBeNull()
    expect(removeArgs("")).toBeNull()
    expect(removeArgs(undefined)).toBeNull()
  })

  it.skipIf(!hasDocker || !anyLocalImage)("销毁后容器与它的匿名卷都不复存在（集成级）", () => {
    const name = "mes-lab-test-" + Date.now().toString(36)
    const created = dockerRun(["create", "--name", name, anyLocalImage as string])
    expect(created.status, created.stderr).toBe(0)
    const volume = dockerRun(["inspect", "-f", "{{range .Mounts}}{{.Name}}{{end}}", name]).stdout.trim()
    expect(volume).not.toBe("")
    expect(dockerRun(["volume", "inspect", volume]).status).toBe(0)
    try {
      expect(removeContainer(name)).toBe(true)
      expect(dockerRun(["ps", "-a", "--filter", `name=^/${name}$`, "--format", "{{.Names}}"]).stdout.trim()).toBe("")
      expect(dockerRun(["volume", "inspect", volume]).status).not.toBe(0)
    } finally {
      dockerRun(["rm", "-fv", name])
      dockerRun(["volume", "rm", volume])
    }
  })
})

describe("作业通道的 @文件 传参", () => {
  it("以 @ 开头时从文件读请求体（口令因此不必出现在 argv 里）", () => {
    const file = path.join(os.tmpdir(), `labenv-req-${Date.now().toString(36)}.json`)
    fs.writeFileSync(file, JSON.stringify({ action: "create", kind: "db" }), { mode: 0o600 })
    try {
      const raw = readRequestJson("@" + file)
      expect(JSON.parse(raw)).toEqual({ action: "create", kind: "db" })
    } finally {
      fs.unlinkSync(file)
    }
  })

  it("不存在的文件返回空串而不是抛错", () => {
    expect(readRequestJson("@/definitely/not/here.json")).toBe("")
  })
})
