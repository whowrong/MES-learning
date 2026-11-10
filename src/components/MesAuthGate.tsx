import { FormEvent, useEffect, useState } from "react"
import { LogIn, UserRound } from "lucide-react"
import { pb } from "@/lib/pb"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

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
  const [open, setOpen] = useState(false)

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
      setOpen(false)
    } catch {
      setError("账号或密码不正确，或账号尚未配置。")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={auth.valid ? "打开账户面板" : "打开登录面板"}
            className="fixed right-2 top-16 z-40 rounded-full border-border/70 bg-background/90 px-3 shadow-md backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-lg sm:right-3"
          >
            {auth.valid ? <UserRound aria-hidden="true" /> : <LogIn aria-hidden="true" />}
            <span>{auth.valid ? "账户" : "登录"}</span>
          </Button>
        </DialogTrigger>
        <DialogContent
          overlayClassName="bg-black/40 backdrop-blur-[2px]"
          className="max-w-[calc(100vw-2rem)] rounded-2xl border-border/70 bg-card/95 p-6 shadow-2xl backdrop-blur sm:max-w-sm"
        >
          <DialogHeader className="space-y-2 pr-6 text-left">
            <DialogTitle className="text-xl">{auth.valid ? "账户" : "登录"}</DialogTitle>
            <DialogDescription>
              {auth.valid
                ? "登录后可使用受保护的实操和个人存档。"
                : "学习内容公开可读；数据库 / SSH 实操与个人存档需要应用账号，此站不开放注册。"}
            </DialogDescription>
          </DialogHeader>
          {auth.valid ? (
            <div className="flex items-center justify-between gap-4 rounded-xl border bg-background/70 p-4">
              <span className="text-sm text-muted-foreground">当前已登录</span>
              <Button type="button" variant="outline" onClick={() => {
                pb.authStore.clear()
                setOpen(false)
              }}>
                退出登录
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <label className="block space-y-1.5 text-sm font-medium">
                <span>账号</span>
                <input
                  autoComplete="username"
                  autoFocus
                  type="text"
                  required
                  value={identity}
                  onChange={(event) => setIdentity(event.target.value)}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-base shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium">
                <span>密码</span>
                <input
                  autoComplete="current-password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-base shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button disabled={busy} type="submit" className="h-11 w-full rounded-xl">
                {busy ? "正在登录…" : "登录"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
