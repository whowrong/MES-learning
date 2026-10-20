// 工厂日历周条：工作日、休息日、检修日——交期倒排全按这张时间表
export function CalendarStrip() {
  const days = [
    { d: "一", kind: "work" as const },
    { d: "二", kind: "work" as const },
    { d: "三", kind: "work" as const },
    { d: "四", kind: "work" as const },
    { d: "五", kind: "work" as const },
    { d: "六", kind: "work" as const, note: "旺季加班" },
    { d: "日", kind: "rest" as const, note: "检修日" },
  ]
  return (
    <div className="py-2" role="img" aria-label="工厂日历示意：周一至周六为工作日，周日休息兼设备检修日，交期按工作日倒排">
      <div className="mx-auto grid max-w-sm grid-cols-7 gap-1">
        {days.map((day) => (
          <div
            key={day.d}
            className={`flex flex-col items-center rounded-lg border-2 px-1 py-1.5 text-center ${
              day.kind === "work"
                ? "border-border bg-primary/15"
                : "border-dashed border-border bg-muted"
            }`}
          >
            <span className="text-xs font-bold text-foreground">{day.d}</span>
            <span className="text-xs" aria-hidden>{day.kind === "work" ? "🏭" : "🌙"}</span>
            {day.note && <span className="text-xs leading-3 text-muted-foreground">{day.note}</span>}
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        老板说「5 天交货」，系统按工作日倒排——周日和检修日不干活，承诺前先翻日历
      </p>
    </div>
  )
}
