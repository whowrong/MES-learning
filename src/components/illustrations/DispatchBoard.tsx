// 派工板：一张工单拆到人，谁干多少、何时交，白纸黑字
export function DispatchBoard() {
  return (
    <div className="py-2" role="img" aria-label="派工示意：一张 100 件的焊接工单拆派给三位师傅，各带数量和交期">
      <div className="mx-auto flex max-w-sm flex-col items-center">
        <div className="w-full rounded-xl border-2 border-primary bg-primary/15 px-3 py-2 text-center shadow-sm">
          <p className="font-mono text-xs text-primary">WO-0042 · 焊接工序</p>
          <p className="text-sm font-bold text-foreground">椅架 100 件 · 周三前交</p>
        </div>
        <div className="relative mt-0 flex w-full justify-center gap-8">
          <div className="absolute left-[18%] right-[18%] top-0 h-3 border-x-2 border-b-2 border-border" aria-hidden />
        </div>
        <div className="mt-0 grid w-full grid-cols-3 gap-2">
          {[
            { who: "王师傅", qty: "40 件" },
            { who: "李师傅", qty: "35 件" },
            { who: "张师傅", qty: "25 件" },
          ].map((p) => (
            <div key={p.who} className="rounded-xl border-2 border-border bg-card px-2 py-2 text-center shadow-sm">
              <p className="text-xs font-bold text-foreground">{p.who}</p>
              <p className="font-mono text-xs text-primary">{p.qty}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        任务落到人头上，报工、工资、追溯才有锚点；改派谁、几点改的，系统全留痕
      </p>
    </div>
  )
}
