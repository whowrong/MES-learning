// 演练专用环境提示语 + 生产环境警示。
//
// 出现在用户真正要填连接信息的地方（数据库连接登记、服务器连接登记），
// 而不是只写在文档里：先讲清破坏性风险，再对疑似生产的主机名要求二次确认。
import { AlertTriangle, ShieldAlert } from "lucide-react"
import { looksLikeProduction } from "@/game/labScripts"

export const DRILL_NOTICE_TEXT =
  "请只填可破坏、演练专用的数据库与服务器：站内演练会执行删除、重建、清库、杀进程、改防火墙、重启服务等操作。生产环境、重要数据环境请勿填入；建议用一次性实例，或随时能从快照重建的环境。"

export function DrillEnvironmentNotice({
  host,
  confirmed,
  onConfirmChange,
  target,
}: {
  host: string
  /** 是否已确认「这是演练环境」 */
  confirmed: boolean
  onConfirmChange: (v: boolean) => void
  /** db / server */
  target: "db" | "server"
}) {
  const prod = looksLikeProduction(host)
  return (
    <div className="mt-2 space-y-2">
      <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{DRILL_NOTICE_TEXT}</span>
      </p>
      {prod && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-destructive">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              主机名 <b className="font-mono">{host}</b> 看起来像生产环境（包含 prod / 生产 / 正式 / production）。
              本站演练会执行删除、重建、清库、杀进程、改防火墙、重启服务等破坏性操作，请确认这确实是可丢弃的演练{target === "db" ? "数据库" : "服务器"}。
            </span>
          </p>
          <label className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-foreground">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => onConfirmChange(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-[var(--primary)]"
            />
            <span>我确认这是演练专用环境（可破坏、随时可重建），不是生产环境。</span>
          </label>
        </div>
      )}
    </div>
  )
}
