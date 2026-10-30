import { useState } from "react"
import {
  AlertCircle,
  Boxes,
  ClipboardList,
  Factory,
  FlaskConical,
  Home,
  Lock,
  Minus,
  Play,
  Plus,
  ScrollText,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { useSandbox } from "./useSandbox"

const STATUS_LABEL: Record<string, string> = {
  planned: "待开工",
  running: "在制",
  blocked: "停线",
  done: "完工",
}

export function SandboxPage(p: ReturnType<typeof useSandbox>) {
  const [stockDraft, setStockDraft] = useState<Record<string, string>>({})

  if (p.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">自由沙盘加载中……</p>
      </div>
    )
  }

  if (p.loadError || !p.content || !p.state) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
        <div className="flex items-center gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{p.loadError || "沙盘内容不可用"}</span>
        </div>
        <Button variant="outline" onClick={p.goHome}>
          <Home className="mr-2 h-4 w-4" />
          回首页
        </Button>
      </div>
    )
  }

  if (!p.unlocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-gradient-to-br from-background via-secondary/40 to-card px-4">
        <div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-md">
          <h1 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Lock className="h-5 w-5 text-primary" />
            自由沙盘还没开放
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{p.lockMessage}</p>
          {!p.progressReadable && (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              （当前读不到学习存档，可能还没登录站内账号；登录后会按你的真实进度判断。）
            </p>
          )}
          <Button className="mt-5" variant="outline" onClick={p.goHome}>
            <Home className="mr-2 h-4 w-4" />
            回首页看主线
          </Button>
        </div>
      </div>
    )
  }

  const { content, state } = p
  const wcName = (id: string) => content.workCenters.find((w) => w.id === id)?.name ?? id
  const matName = (id: string) => content.materials.find((m) => m.id === id)?.name ?? id
  const matUnit = (id: string) => content.materials.find((m) => m.id === id)?.unit ?? ""
  const productName = (id: string) => content.products.find((x) => x.id === id)?.name ?? id

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/40 to-card pb-16">
      <div className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <FlaskConical className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="font-mono text-[11px] tracking-widest text-muted-foreground">SANDBOX</p>
            <h1 className="text-base font-bold text-foreground">{content.title}</h1>
          </div>
          <span className="hidden text-sm text-muted-foreground sm:inline">{content.subtitle}</span>
          <Button className="ml-auto" size="sm" variant="outline" onClick={p.goHome}>
            <Home className="mr-2 h-4 w-4" />
            回首页
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <p className="text-sm leading-7 text-muted-foreground">{content.intro}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {content.tips.map((tip) => (
            <li key={tip} className="rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-xs leading-6 text-muted-foreground">
              {tip}
            </li>
          ))}
        </ul>

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {/* ---------- 物料库存 ---------- */}
          <section className="rounded-2xl border bg-card p-5 shadow-md lg:col-span-1">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Boxes className="h-4 w-4 text-primary" />
              物料库存
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">改库存看看产线在哪里断料。</p>
            <div className="mt-4 space-y-4">
              {content.materials.map((m) => {
                const value = state.inventory[m.id] ?? 0
                const negative = value < 0
                return (
                  <div key={m.id} className="rounded-xl border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {m.name}
                        <span className="ml-1 text-xs text-muted-foreground">({m.unit})</span>
                      </span>
                      <span className={`font-mono text-sm ${negative ? "text-destructive" : "text-foreground"}`}>
                        {value}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <Button size="sm" variant="outline" aria-label={`${m.name}减 10`} onClick={() => p.onAdjustStock(m.id, -10)}>
                        <Minus className="h-3.5 w-3.5" />
                        10
                      </Button>
                      <Button size="sm" variant="outline" aria-label={`${m.name}减 1`} onClick={() => p.onAdjustStock(m.id, -1)}>
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" aria-label={`${m.name}加 1`} onClick={() => p.onAdjustStock(m.id, 1)}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" aria-label={`${m.name}加 10`} onClick={() => p.onAdjustStock(m.id, 10)}>
                        <Plus className="h-3.5 w-3.5" />
                        10
                      </Button>
                      <input
                        type="number"
                        aria-label={`${m.name}库存直填`}
                        className="ml-auto w-20 rounded-md border bg-background px-2 py-1 text-right font-mono text-xs"
                        value={stockDraft[m.id] ?? String(value)}
                        onChange={(e) => setStockDraft((d) => ({ ...d, [m.id]: e.target.value }))}
                        onBlur={(e) => {
                          const parsed = Number(e.target.value)
                          if (Number.isFinite(parsed)) {
                            p.onSetStock(m.id, parsed)
                            setStockDraft((d) => {
                              const next = { ...d }
                              delete next[m.id]
                              return next
                            })
                          }
                        }}
                      />
                    </div>
                    {m.note && <p className="mt-2 text-xs leading-5 text-muted-foreground">{m.note}</p>}
                    {negative && <p className="mt-1 text-xs text-destructive">已经是负库存：账上没有这批料。</p>}
                  </div>
                )
              })}
            </div>
          </section>

          {/* ---------- 工单 ---------- */}
          <section className="rounded-2xl border bg-card p-5 shadow-md lg:col-span-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <ClipboardList className="h-4 w-4 text-primary" />
              工单
            </h2>
            <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-border/60 p-3">
              <label className="text-xs text-muted-foreground">
                <span className="mb-1 block">产品</span>
                <select
                  aria-label="沙盘产品"
                  className="rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
                  value={p.productId}
                  onChange={(e) => p.setProductId(e.target.value)}
                >
                  {content.products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                <span className="mb-1 block">数量</span>
                <input
                  type="number"
                  min={1}
                  aria-label="沙盘工单数量"
                  className="w-20 rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
                  value={p.qty}
                  onChange={(e) => p.setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                />
              </label>
              <Button onClick={p.onCreateOrder}>
                <Plus className="mr-2 h-4 w-4" />
                下工单
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {p.orders.length === 0 && (
                <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  还没有工单。先下一张工单，再推进工序看物料流动。
                </p>
              )}
              {p.orders.map((order) => {
                const prod = content.products.find((x) => x.id === order.productId)
                const need = p.needs && p.selectedOrder?.id === order.id ? p.needs : null
                const active = p.selectedOrder?.id === order.id
                return (
                  <article
                    key={order.id}
                    className={`rounded-xl border p-3 ${active ? "border-primary/60 bg-primary/5" : "border-border/60"}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="text-sm font-bold text-foreground underline-offset-2 hover:underline"
                        onClick={() => p.setSelectedOrderId(order.id)}
                      >
                        {order.id}
                      </button>
                      <span className="text-sm text-muted-foreground">
                        {productName(order.productId)} × {order.qty}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          order.status === "blocked"
                            ? "rounded-full border-destructive/40 text-destructive"
                            : order.status === "done"
                              ? "rounded-full border-primary/40 text-primary"
                              : "rounded-full"
                        }
                      >
                        {STATUS_LABEL[order.status]}
                      </Badge>
                    </div>
                    <ol className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                      {(prod?.operations ?? []).map((op, i) => {
                        const done = i <= order.stepIndex
                        return (
                          <li key={op} className="flex items-center gap-1">
                            <span
                              className={`rounded-md px-2 py-1 ${
                                done ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {wcName(op)}
                            </span>
                            {i < (prod?.operations.length ?? 0) - 1 && <span className="text-muted-foreground">→</span>}
                          </li>
                        )
                      })}
                    </ol>
                    {order.shortage && (
                      <p className="mt-2 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
                        缺料停线：{matName(order.shortage.material)} 需 {order.shortage.need}，只有 {order.shortage.have}
                      </p>
                    )}
                    {active && need && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        这一批要用：
                        {Object.entries(need).map(([mid, v]) => (
                          <span key={mid} className="ml-2">
                            {matName(mid)} {v} {matUnit(mid)}（现有 {state.inventory[mid] ?? 0}）
                          </span>
                        ))}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={order.status === "done"}
                        onClick={() => p.onAdvance(order.id)}
                      >
                        <Play className="mr-2 h-3.5 w-3.5" />
                        {order.status === "blocked" ? "补料后重试" : "推进一道工序"}
                      </Button>
                      {order.status !== "done" && (
                        <Button size="sm" variant="outline" onClick={() => p.onCancel(order.id)}>
                          撤回
                        </Button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          {/* ---------- 物料流动 ---------- */}
          <section className="rounded-2xl border bg-card p-5 shadow-md lg:col-span-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Factory className="h-4 w-4 text-primary" />
              物料流动
            </h2>
            {p.selectedOrder ? (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.selectedOrder.id} · {productName(p.selectedOrder.productId)} × {p.selectedOrder.qty}
                  {p.selectedOrder.status === "done" ? " · 已完工入库" : ""}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="rounded-xl border border-border/60 px-3 py-2 text-xs">
                    <p className="font-medium text-foreground">原料</p>
                    <p className="mt-1 text-muted-foreground">
                      {Object.entries(p.needs).map(([mid, v]) => (
                        <span key={mid} className="mr-2">
                          {matName(mid)} {v}
                        </span>
                      ))}
                    </p>
                  </div>
                  {(content.products.find((x) => x.id === p.selectedOrder?.productId)?.operations ?? []).map((op, i) => {
                    const reached = i <= p.selectedOrder!.stepIndex
                    return (
                      <div key={op} className="flex items-center gap-2">
                        <span className="text-muted-foreground">→</span>
                        <div
                          className={`rounded-xl border px-3 py-2 text-xs ${
                            reached ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60"
                          }`}
                        >
                          <p className="font-medium">{wcName(op)}</p>
                          <p className="mt-1 text-muted-foreground">
                            {reached ? "已过" : "待过"}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">→</span>
                    <div
                      className={`rounded-xl border px-3 py-2 text-xs ${
                        p.selectedOrder.status === "done"
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border/60"
                      }`}
                    >
                      <p className="font-medium">成品</p>
                      <p className="mt-1 text-muted-foreground">
                        {state.finished[p.selectedOrder.productId] ?? 0} 台
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">下第一张工单，这里会显示物料怎么流动。</p>
            )}
          </section>

          {/* ---------- BOM ---------- */}
          <section className="rounded-2xl border bg-card p-5 shadow-md">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Wrench className="h-4 w-4 text-primary" />
              BOM 单台用量
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">改错 BOM，再下单看产线先在哪一步断。</p>
            <div className="mt-3 space-y-4">
              {content.products.map((prod) => (
                <div key={prod.id}>
                  <p className="text-sm font-medium text-foreground">{prod.name}</p>
                  <div className="mt-2 space-y-1">
                    {(state.bom[prod.id] ?? []).map((line) => (
                      <div key={line.material} className="flex items-center gap-2 text-xs">
                        <span className="w-16 text-muted-foreground">{matName(line.material)}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`${prod.name}的${matName(line.material)}用量减 1`}
                          onClick={() => p.onSetBomQty(prod.id, line.material, Math.max(0, line.qty - 1))}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-10 text-center font-mono text-foreground">{line.qty}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`${prod.name}的${matName(line.material)}用量加 1`}
                          onClick={() => p.onSetBomQty(prod.id, line.material, line.qty + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <span className="text-muted-foreground">{matUnit(line.material)}/台</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ---------- 事件日志 ---------- */}
          <section className="rounded-2xl border bg-card p-5 shadow-md lg:col-span-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <ScrollText className="h-4 w-4 text-primary" />
              事件日志
            </h2>
            <ul className="mt-3 space-y-1">
              {state.log.map((entry, i) => (
                <li
                  key={`${entry.at}-${i}`}
                  className={`font-mono text-xs leading-6 ${
                    entry.tone === "danger"
                      ? "text-destructive"
                      : entry.tone === "warn"
                        ? "text-amber-600"
                        : entry.tone === "good"
                          ? "text-primary"
                          : "text-muted-foreground"
                  }`}
                >
                  [{entry.at}] {entry.text}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  )
}
