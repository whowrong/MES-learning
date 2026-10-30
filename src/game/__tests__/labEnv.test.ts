// 两种演练环境模式（模式 A 远程环境 / 模式 B 站点一次性 Docker 环境）的逻辑测试。
import { describe, expect, it } from "vitest"
import {
  LAB_ENV_MODES,
  SITE_DB_PORT_RANGE,
  SITE_SSH_PORT_RANGE,
  labEnvModeSpec,
  needsSiteEnv,
  remoteEnvRequirement,
  siteEnvPreset,
  siteEnvSpec,
  type LabEnvMode,
} from "@/game/labEnv"
import { matchLabAssert, type LabStep } from "@/game/labScripts"

describe("两种演练环境模式", () => {
  it("提供并列的两种模式，并写清各自的取舍", () => {
    expect(LAB_ENV_MODES.map((m) => m.mode)).toEqual(["remote", "site"])
    for (const m of LAB_ENV_MODES) {
      expect(m.label.length).toBeGreaterThan(0)
      expect(m.hint.length).toBeGreaterThan(0)
      expect(m.tradeoff.length).toBeGreaterThan(0)
    }
    expect(labEnvModeSpec("remote").mode).toBe("remote")
    expect(labEnvModeSpec("site").mode).toBe("site")
  })

  it("只有模式 B 需要站点创建一次性环境", () => {
    expect(needsSiteEnv("site")).toBe(true)
    expect(needsSiteEnv("remote")).toBe(false)
  })

  it("模式 A 的前置条件说清账号与权限，且提醒别用生产机", () => {
    const db = remoteEnvRequirement("db")
    expect(db.join(" ")).toContain("权限")
    expect(db.join(" ")).toContain("不要指向生产库")
    const server = remoteEnvRequirement("server")
    expect(server.join(" ")).toContain("sudo")
    expect(server.join(" ")).toContain("别用生产机")
    expect(server.join(" ")).toContain("prod")
  })

  it("模式 B 的预置说明按题型区分数据库与服务器", () => {
    expect(siteEnvPreset("db", "mysql").join(" ")).toContain("MySQL")
    expect(siteEnvPreset("db", "postgres").join(" ")).toContain("PostgreSQL")
    expect(siteEnvPreset("db", "sqlserver").join(" ")).toContain("SQL Server")
    expect(siteEnvPreset("server").join(" ")).toContain("sshd")
  })

  it("两种模式都有最小与推荐配置", () => {
    for (const kind of ["db", "server"] as const) {
      const spec = siteEnvSpec(kind)
      expect(spec.min).toMatch(/vCPU/)
      expect(spec.rec).toMatch(/vCPU/)
    }
  })

  it("模式 B 的端口段与现网端口不冲突", () => {
    const live = [22, 80, 443, 8080, 8090, 8091, 8099, 3307]
    for (const port of live) {
      expect(SITE_DB_PORT_RANGE[0] <= port && port <= SITE_DB_PORT_RANGE[1]).toBe(false)
      expect(SITE_SSH_PORT_RANGE[0] <= port && port <= SITE_SSH_PORT_RANGE[1]).toBe(false)
    }
  })
})

describe("两种模式共用的判分口径", () => {
  const step: LabStep = {
    id: "s1",
    title: "查看磁盘",
    command: "df -h /data",
    expect: "",
    assert: ["^df\\b", "Filesystem"],
  }

  it("输出命中验收正则即达标（模式 A / 模式 B 同一口径）", () => {
    expect(matchLabAssert(step, "Filesystem Size Used Avail Use% Mounted on")).toBe(true)
  })

  it("命令片段兜底：命令本身命中也算达标（去包装后）", () => {
    expect(matchLabAssert(step, "sudo df -h /data")).toBe(true)
  })

  it("两者都不命中即不达标", () => {
    expect(matchLabAssert(step, "nothing to see here")).toBe(false)
  })

  it("判分函数与模式无关：mode 不进签名", () => {
    expect(matchLabAssert.length).toBe(2)
    const modes: LabEnvMode[] = ["remote", "site"]
    for (const mode of modes) {
      expect(mode).toBeTruthy()
    }
  })
})
