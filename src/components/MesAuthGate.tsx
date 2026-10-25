import { FormEvent, useEffect, useState } from "react"
import { pb } from "@/lib/pb"

type AuthState = { valid: boolean; revision: number }

function hasMesAuth(): boolean {
  return pb.authStore.isValid && pb.authStore.model?.collectionName === "mes_users"
}

export function MesAuthGate({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => ({ valid: hasMesAuth(), revision: 0 }))
  const [email, setEmail] = useState("")
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
      await pb.collection("mes_users").authWithPassword(email.trim(), password)
      setPassword("")
    } catch {
      setError("邮箱或密码不正确，或账号尚未配置。")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {children}
      <details className="fixed right-3 top-3 z-50 max-w-[calc(100vw-1.5rem)] rounded-lg border bg-card/95 p-2 text-sm shadow-lg backdrop-blur">
        <summary className="cursor-pointer select-none px-2 py-1 font-medium">
          {auth.valid ? "已登录 · 账户" : "实操 / 存档登录"}
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
              <span>邮箱</span>
              <input autoComplete="username" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2" />
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
