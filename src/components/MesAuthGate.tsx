import { FormEvent, useEffect, useState } from "react"
import { UserRound } from "lucide-react"
import { pb } from "@/lib/pb"

type AuthState = { valid: boolean; revision: number }

function hasMesAuth(): boolean {
  return pb.authStore.isValid && pb.authStore.model?.collectionName === "mes_users"
}

export function MesAuthGate({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => ({ valid: hasMesAuth(), revision: 0 }))
  const [identity, setIdentity] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => pb.authStore.onChange(() => {
    setAuth((current) => ({ valid: hasMesAuth(), revision: current.revision + 1 }))
  }, true), [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setBusy(true)
    try {
      await pb.collection("mes_users").authWithPassword(identity.trim(), password)
      setPassword("")
    } catch {
      setError("账号或密码不正确，或账号尚未配置。")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {children}
      {/*
        登录入口不能压住顶栏：顶栏是 sticky top-0 h-16，右上角有「术语卡库 / 自由沙盘」两个按钮。
        原实现固定在 right-3 top-3（与顶栏同高），展开后直接盖住这两个按钮，点不到。
        现在：所有宽度一律锚到顶栏正下方（top-16），窄屏（<sm）收成 40x40 图标按钮，
        宽屏（>=sm）保留文字按钮外观；两种宽度下都不再覆盖顶栏的原有可交互元素。
      */}
      <details
        data-testid="mes-auth-entry"
        className="fixed right-2 top-16 z-50 max-w-[calc(100vw-1.5rem)] rounded-lg border bg-card/95 p-2 text-sm shadow-lg backdrop-blur sm:right-3"
      >
        <summary
          data-testid="mes-auth-summary"
          aria-label={auth.valid ? "已登录 · 账户" : "实操 / 存档登录"}
          title={auth.valid ? "已登录 · 账户" : "实操 / 存档登录"}
          className="flex h-10 w-10 cursor-pointer select-none items-center justify-center gap-2 rounded-md font-medium sm:h-auto sm:w-auto sm:justify-start sm:px-2 sm:py-1"
        >
          <UserRound className="h-4 w-4 sm:hidden" aria-hidden="true" />
          <span className="hidden sm:inline">{auth.valid ? "已登录 · 账户" : "实操 / 存档登录"}</span>
        </summary>
        {auth.valid ? (
          <div className="flex items-center gap-3 px-2 pb-2">
            <span className="text-muted-foreground">登录后可使用受保护的实操和个人存档</span>
            <button type="button" onClick={() => pb.authStore.clear()} className="shrink-0 rounded-md border px-2 py-1">退出</button>
          </div>
        ) : (
          <form onSubmit={submit} className="w-72 max-w-[calc(100vw-3rem)] space-y-3 p-2">
            <p className="text-xs text-muted-foreground">学习内容公开可读；数据库/SSH 实操与个人存档需要应用账号。此站不开放注册。</p>
            <label className="block space-y-1">
              <span>账号</span>
              <input autoComplete="username" type="text" required value={identity} onChange={(e) => setIdentity(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2" />
            </label>
            <label className="block space-y-1">
              <span>密码</span>
              <input autoComplete="current-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2" />
            </label>
            {error && <p role="alert" className="text-destructive">{error}</p>}
            <button disabled={busy} type="submit" className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60">{busy ? "正在登录…" : "登录"}</button>
          </form>
        )}
      </details>
    </>
  )
}
