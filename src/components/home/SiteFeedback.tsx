import { FormEvent, useState } from "react"
import { MessageSquareText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getPocketBaseUrl, pbFetch } from "@/lib/pb"

type FeedbackState = "idle" | "sending" | "sent" | "error"

/** Small public comment form; submitted notes are stored in the private PocketBase collection. */
export function SiteFeedback() {
  const [message, setMessage] = useState("")
  const [website, setWebsite] = useState("")
  const [state, setState] = useState<FeedbackState>("idle")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || trimmed.length > 1200) return
    setState("sending")
    try {
      const response = await pbFetch(`${getPocketBaseUrl()}/api/site_feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, page_path: window.location.pathname, website }),
      })
      if (!response.ok) throw new Error("feedback_submit_failed")
      setMessage("")
      setWebsite("")
      setState("sent")
    } catch {
      setState("error")
    }
  }

  return (
    <section aria-labelledby="site-feedback-title" className="mx-auto mt-8 max-w-2xl rounded-2xl border border-border bg-card/90 p-5 text-left shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageSquareText className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 id="site-feedback-title" className="font-semibold text-foreground">给网站提个建议</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">哪里难懂、哪里好用，或想增加什么内容，都可以留言。</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="sr-only" htmlFor="site-feedback-message">反馈内容</label>
        <textarea
          id="site-feedback-message"
          required
          maxLength={1200}
          rows={4}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value)
            if (state !== "sending") setState("idle")
          }}
          placeholder="写下你的想法……"
          className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm leading-6 outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        <label className="pointer-events-none absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-h-5 text-sm" role="status" aria-live="polite">
            {state === "sent" && <span className="text-primary">谢谢你，反馈已收到！</span>}
            {state === "error" && <span className="text-destructive">暂时没提交成功，请稍后再试。</span>}
          </p>
          <Button type="submit" disabled={state === "sending" || !message.trim()} className="rounded-full">
            {state === "sending" ? "提交中…" : "提交反馈"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">请勿填写密码、联系方式或其他敏感信息。</p>
      </form>
    </section>
  )
}
