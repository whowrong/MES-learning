// The disposable-environment hooks execute Docker/container operations, so they must
// always require a normal MES account before invoking the executor.
import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const hookPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../templates/pb_hooks/lab_proxy.pb.js")
const hookSource = fs.readFileSync(hookPath, "utf8")

function routeDefinition(route: string) {
  const marker = `routerAdd("POST", "${route}",`
  const start = hookSource.indexOf(marker)
  if (start < 0) throw new Error(`Missing route: ${route}`)
  const nextRoute = hookSource.indexOf("\nrouterAdd(", start + marker.length)
  return hookSource.slice(start, nextRoute < 0 ? undefined : nextRoute).trimEnd()
}

describe("临时演练环境路由认证", () => {
  it.each(["/api/labenv/create", "/api/labenv/destroy", "/api/labenv/status"])(
    "%s 在执行前要求 MES 用户认证",
    (route) => {
      expect(routeDefinition(route)).toContain("}, requireMesUser)")
    },
  )
})
