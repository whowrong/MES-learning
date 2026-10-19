// 章节、仪表与进度的内容定义。
// 内容与代码分离：后续新增章节 / 调整文案只改本文件，不动页面组件。

export type ChapterState = "locked" | "open" | "cleared"

export interface ChapterDef {
  id: number
  title: string
  scene: string
  story: string
  tags: string[]
  /** 点击锁定卡片时弹出的「本章将学到什么」提示 */
  lockedTip: string
  /** 当前版本是否已开放游玩（第一周仅第一章） */
  playable: boolean
}

export const CHAPTERS: ChapterDef[] = [
  {
    id: 1,
    title: "调研与认知",
    scene: "进厂第一天",
    story:
      "车间主任操着方言把生产流程说了一遍。把他说的话拖到正确的系统概念上，再拼出从销售订单到成品入库的全流程。",
    tags: ["工单", "工作中心", "工艺路线", "物料分类"],
    lockedTip: "",
    playable: true,
  },
  {
    id: 2,
    title: "静态数据与脏数据",
    scene: "一份灾难级 Excel",
    story:
      "物料编码重复、单位米和根混着写、一行塞两个物料、BOM 层级颠倒。先洗干净再导入——硬塞进去的脏数据，会在后面章节回来找你。",
    tags: ["物料编码", "数据唯一性", "BOM 层级"],
    lockedTip: "这一章教你实施的真实第一课：为什么顾问一半时间在洗数据。物料编码、BOM 层级都在这里过关。",
    playable: true,
  },
  {
    id: 3,
    title: "建模与配置",
    scene: "把工厂装进系统",
    story:
      "在简化版 MES 界面里建两个产品、多级 BOM、两道工序、两个工作中心和工厂日历，然后下达你的第一张工单。",
    tags: ["BOM", "工艺路线", "工作中心", "工厂日历"],
    lockedTip: "这一章教你 BOM 和工艺路线的区别——一张表回答「用什么料」，另一张回答「怎么造」。还会亲手下一张工单。",
    playable: true,
  },
  {
    id: 4,
    title: "执行与报工",
    scene: "兵荒马乱的一天",
    story:
      "给班组派工、审核每个班次的报工：有人多报数量、有人漏报工序、有人把报废报成合格。老板报表上的产量，可能全是假的。",
    tags: ["派工", "报工", "在制品 WIP", "倒冲扣料"],
    lockedTip: "这一章模拟真实的一天生产：派工、报工、合格与报废、倒冲扣料，看数据不准怎么让老板看到假产量。",
    playable: false,
  },
  {
    id: 5,
    title: "质量与库存",
    scene: "账实不符",
    story:
      "质检不合格的批次怎么处理？库位盘点账对不上实物，差异出在哪？原料耗尽突然停线——还要查清库存为什么会变成负数。",
    tags: ["质检", "安全库存", "盘点", "库位"],
    lockedTip: "这一章教你质检三选一（退货 / 返工 / 让步接收）、安全库存怎么设、盘点差异怎么查，以及负库存事故的复盘。",
    playable: false,
  },
  {
    id: 6,
    title: "上线陪产",
    scene: "上线日风暴",
    story:
      "条码打印机坏了、班组长当众发火、网络断了、昨晚数据对不上。限时排定处理顺序、选对沟通话术，最后拿到你的实施顾问评级。",
    tags: ["突发事件优先级", "关键用户", "复盘卡"],
    lockedTip: "这是综合关：上线第一天连环突发事件，考你处理顺序和沟通话术，结局按六项仪表给出顾问评级和复盘报告。",
    playable: false,
  },
]

export interface GaugeDef {
  key: string
  label: string
  unit: string
  /** 车间大白话解释 */
  hint: string
  higherIsBetter: boolean
  /** 进度条满格值 */
  max: number
  defaultValue: number
}

export const GAUGE_DEFS: GaugeDef[] = [
  {
    key: "projectProgress",
    label: "项目进度",
    unit: "%",
    hint: "实施项目推进到哪了，像装修工期表",
    higherIsBetter: true,
    max: 100,
    defaultValue: 0,
  },
  {
    key: "dataAccuracy",
    label: "数据准确率",
    unit: "分",
    hint: "你录进去的基础数据有多少是对的——数据脏，后面全乱",
    higherIsBetter: true,
    max: 100,
    defaultValue: 100,
  },
  {
    key: "inventoryAccuracy",
    label: "库存准确率",
    unit: "分",
    hint: "系统账面库存和货架上实物对得上的比例",
    higherIsBetter: true,
    max: 100,
    defaultValue: 100,
  },
  {
    key: "workerMorale",
    label: "工人配合度",
    unit: "分",
    hint: "车间师傅们愿不愿意用系统——惹毛了他们，报工就是乱填",
    higherIsBetter: true,
    max: 100,
    defaultValue: 70,
  },
  {
    key: "downtimeHours",
    label: "产线停工时长",
    unit: "小时",
    hint: "因为你的决策导致产线停了几小时，老板最盯这个",
    higherIsBetter: false,
    max: 8,
    defaultValue: 0,
  },
  {
    key: "budgetLeft",
    label: "预算工期剩余",
    unit: "%",
    hint: "项目的钱和时间还剩多少，返工和拖延都在烧它",
    higherIsBetter: true,
    max: 100,
    defaultValue: 100,
  },
]

/** 与后端 player_progress collection 字段一一对应（snake_case，禁止改名） */
export interface GaugeValue {
  value: number
  /** 上一次变动前的值，用于首页显示升降标记 */
  prev?: number
}

export interface ProgressRecord {
  id?: string
  chapter_status: Record<string, ChapterState>
  gauges: Record<string, GaugeValue>
  review_queue: string[]
  term_mastery: Record<string, number>
  /** Anki 式复习调度：{ termId: { level, dueAt, lastRatedAt } } */
  review_state?: Record<string, { level: number; dueAt: number; lastRatedAt: number }>
  /** 连续学习打卡：本地日期字符串列表 ["2026-10-17", ...] */
  study_days?: string[]
  /** 面试训练营练习历史（每次模拟面试追加一条） */
  interview_history?: InterviewHistoryEntry[]
  /** 厂型特训营练习历史（每次实战测验追加一条） */
  factory_history?: FactoryHistoryEntry[]
  last_route: string
}

/** 一次模拟面试的存档记录 */
export interface InterviewHistoryEntry {
  /** 本地日期时间串 YYYY-MM-DD HH:mm */
  at: string
  tier: string
  score: number
  total: number
}

/** 一次厂型实战测验的存档记录 */
export interface FactoryHistoryEntry {
  /** 本地日期时间串 YYYY-MM-DD HH:mm */
  at: string
  /** 厂型 type：discrete/flow/hybrid */
  type: string
  score: number
  total: number
}

export function buildDefaultProgress(): ProgressRecord {
  const chapterStatus: Record<string, ChapterState> = {}
  // 新档只解锁第一个可玩章节；后面的可玩章节要靠通关解锁（finishLevel 里推进），
  // 避免多章开放时新玩家跳关。
  let firstPlayableOpened = false
  for (const ch of CHAPTERS) {
    if (ch.playable && !firstPlayableOpened) {
      chapterStatus[String(ch.id)] = "open"
      firstPlayableOpened = true
    } else {
      chapterStatus[String(ch.id)] = "locked"
    }
  }
  const gauges: Record<string, GaugeValue> = {}
  for (const g of GAUGE_DEFS) {
    gauges[g.key] = { value: g.defaultValue }
  }
  return {
    chapter_status: chapterStatus,
    gauges,
    review_queue: [],
    term_mastery: {},
    review_state: {},
    study_days: [],
    interview_history: [],
    factory_history: [],
    last_route: "/home",
  }
}
