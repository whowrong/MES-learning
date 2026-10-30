import { BookOpen, Factory, FlaskConical, Video, Server, Database, Target, ArrowRight, ClipboardCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SpotlightCard } from "@/components/bits/SpotlightCard"

interface ModuleEntriesProps {
  reviewCount: number
  interviewCount: number
  factoryCount: number
  opsCount: number
  dbCount: number
  careerCount: number
  deliveryCount: number
  /** 自由沙盘是否已解锁（第三章通关后为 true） */
  sandboxUnlocked: boolean
  onGlossary: () => void
  onInterview: () => void
  onFactoryTypes: () => void
  onOpsTraining: () => void
  onDbTraining: () => void
  onCareerPrep: () => void
  onDelivery: () => void
  onSandbox: () => void
}

const CARD_ENTER =
  "animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"

export function ModuleEntries({ reviewCount, interviewCount, factoryCount, opsCount, dbCount, careerCount, deliveryCount, sandboxUnlocked, onGlossary, onInterview, onFactoryTypes, onOpsTraining, onDbTraining, onCareerPrep, onDelivery, onSandbox }: ModuleEntriesProps) {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">常驻模块</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <SpotlightCard
            className={`group h-full rounded-2xl bg-card shadow-md ${CARD_ENTER}`}
          >
            <button
              type="button"
              onClick={onGlossary}
              style={{ animationDelay: "0ms" }}
              className="relative flex h-full w-full items-start gap-4 p-6 text-left focus-visible:shadow-[var(--focus-ring)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground transition-transform duration-300 group-hover:scale-110">
                <BookOpen className="h-6 w-6" />
              </span>
              <span className="flex h-full flex-col">
                <span className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">术语卡库</span>
                  {reviewCount > 0 && (
                    <Badge className="rounded-full bg-destructive text-destructive-foreground">
                      {reviewCount} 张待复习
                    </Badge>
                  )}
                </span>
                <span className="mt-1 text-sm leading-6 text-muted-foreground">
                  工单、BOM、倒冲扣料……每个概念一张卡，配车间大白话解释。
                  标记「不熟」的卡会按间隔重复回到复习队列，像背单词一样把它们焊进脑子。
                </span>
                <span className="mt-auto inline-flex items-center pt-3 text-sm font-medium text-primary">
                  进入卡库
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </span>
            </button>
          </SpotlightCard>
          <SpotlightCard
            className={`group h-full rounded-2xl bg-card shadow-md [animation-delay:80ms] ${CARD_ENTER}`}
          >
            <button
              type="button"
              onClick={onInterview}
              className="relative flex h-full w-full items-start gap-4 p-6 text-left focus-visible:shadow-[var(--focus-ring)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform duration-300 group-hover:scale-110">
                <Video className="h-6 w-6" />
              </span>
              <span className="flex h-full flex-col">
                <span className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">面试训练营</span>
                  {interviewCount > 0 && (
                    <Badge variant="outline" className="rounded-full text-muted-foreground">
                      已练 {interviewCount} 场
                    </Badge>
                  )}
                </span>
                <span className="mt-1 text-sm leading-6 text-muted-foreground">
                  实习到校招再到社招六档难度，面试官口吻的真实场景题：单选、多选、判断、简答自评。
                  每题附参考答案和加分点，答完出得分和面试官锐评，错题自动进复习队列。
                </span>
                <span className="mt-auto inline-flex items-center pt-3 text-sm font-medium text-primary">
                  进入训练营
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </span>
            </button>
          </SpotlightCard>
          <SpotlightCard
            className={`group h-full rounded-2xl bg-card shadow-md [animation-delay:160ms] ${CARD_ENTER}`}
          >
            <button
              type="button"
              onClick={onFactoryTypes}
              className="relative flex h-full w-full items-start gap-4 p-6 text-left focus-visible:shadow-[var(--focus-ring)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform duration-300 group-hover:scale-110">
                <Factory className="h-6 w-6" />
              </span>
              <span className="flex h-full flex-col">
                <span className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">厂型特训营</span>
                  {factoryCount > 0 && (
                    <Badge variant="outline" className="rounded-full text-muted-foreground">
                      已训 {factoryCount} 场
                    </Badge>
                  )}
                </span>
                <span className="mt-1 text-sm leading-6 text-muted-foreground">
                  离散、流水线、混合三种厂型，调研重点和建模方式完全不同。
                  先翻厂型档案学脾气，再打一场该厂型专属的场景实战测验。
                </span>
                <span className="mt-auto inline-flex items-center pt-3 text-sm font-medium text-primary">
                  进厂调研
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </span>
            </button>
          </SpotlightCard>
          <SpotlightCard
            className={`group h-full rounded-2xl bg-card shadow-md [animation-delay:240ms] ${CARD_ENTER}`}
          >
            <button
              type="button"
              onClick={onOpsTraining}
              className="relative flex h-full w-full items-start gap-4 p-6 text-left focus-visible:shadow-[var(--focus-ring)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform duration-300 group-hover:scale-110">
                <Server className="h-6 w-6" />
              </span>
              <span className="flex h-full flex-col">
                <span className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">运维训练营</span>
                  <Badge variant="outline" className="rounded-full bg-primary/10 text-primary">
                    严肃实操
                  </Badge>
                  {opsCount > 0 && (
                    <Badge variant="outline" className="rounded-full text-muted-foreground">
                      已训 {opsCount} 次
                    </Badge>
                  )}
                </span>
                <span className="mt-1 text-sm leading-6 text-muted-foreground">
                  以 MES 为中心、ERP / WMS 为辅的运维实操：Linux 与 Windows 服务器模拟终端真敲命令，
                  云环境和三系统集成排障演练。危险命令会被拦截并讲后果，练完出 SOP 报告。
                </span>
                <span className="mt-auto inline-flex items-center pt-3 text-sm font-medium text-primary">
                  开始训练
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </span>
            </button>
          </SpotlightCard>
          <SpotlightCard
            className={`group h-full rounded-2xl bg-card shadow-md [animation-delay:320ms] ${CARD_ENTER}`}
          >
            <button
              type="button"
              onClick={onDbTraining}
              className="relative flex h-full w-full items-start gap-4 p-6 text-left focus-visible:shadow-[var(--focus-ring)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform duration-300 group-hover:scale-110">
                <Database className="h-6 w-6" />
              </span>
              <span className="flex h-full flex-col">
                <span className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">数据库实操营</span>
                  <Badge variant="outline" className="rounded-full bg-primary/10 text-primary">
                    真实 SQL
                  </Badge>
                  {dbCount > 0 && (
                    <Badge variant="outline" className="rounded-full text-muted-foreground">
                      已练 {dbCount} 组
                    </Badge>
                  )}
                </span>
                <span className="mt-1 text-sm leading-6 text-muted-foreground">
                  MES 业务库上真刀真枪写 SQL：查数口径、多表关联、洗脏数据、出报表，
                  每条语句真实执行、按结果校验判分。还能连接你自己的 MySQL / SQL Server / PostgreSQL 练真实环境。
                </span>
                <span className="mt-auto inline-flex items-center pt-3 text-sm font-medium text-primary">
                  开始实操
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </span>
            </button>
          </SpotlightCard>
          <SpotlightCard
            className={`group h-full rounded-2xl bg-card shadow-md [animation-delay:400ms] ${CARD_ENTER}`}
          >
            <button
              type="button"
              onClick={onCareerPrep}
              className="relative flex h-full w-full items-start gap-4 p-6 text-left focus-visible:shadow-[var(--focus-ring)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform duration-300 group-hover:scale-110">
                <Target className="h-6 w-6" />
              </span>
              <span className="flex h-full flex-col">
                <span className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">实习准备营</span>
                  <Badge variant="outline" className="rounded-full bg-primary/10 text-primary">
                    方向 1 / 4
                  </Badge>
                  {careerCount > 0 && (
                    <Badge variant="outline" className="rounded-full text-muted-foreground">
                      已练 {careerCount} 场
                    </Badge>
                  )}
                </span>
                <span className="mt-1 text-sm leading-6 text-muted-foreground">
                  两条求职方向的知识点卡片与组卷测验：ERP/MES/WMS 边界、实施九步与数据迁移、
                  工业协议与网关、IO 点表与联机试运行，外加 SQL、Linux 与文档底座。
                  答错的术语自动进复习队列。
                </span>
                <span className="mt-auto inline-flex items-center pt-3 text-sm font-medium text-primary">
                  开始准备
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </span>
            </button>
          </SpotlightCard>
          <SpotlightCard
            className={`group h-full rounded-2xl bg-card shadow-md [animation-delay:360ms] ${CARD_ENTER}`}
          >
            <button
              type="button"
              onClick={onDelivery}
              className="relative flex h-full w-full items-start gap-4 p-6 text-left focus-visible:shadow-[var(--focus-ring)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform duration-300 group-hover:scale-110">
                <ClipboardCheck className="h-6 w-6" />
              </span>
              <span className="flex h-full flex-col">
                <span className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">交付物工作区</span>
                  <Badge variant="outline" className="rounded-full bg-primary/10 text-primary">
                    上线陪产
                  </Badge>
                  {deliveryCount > 0 && (
                    <Badge variant="outline" className="rounded-full text-muted-foreground">
                      已练 {deliveryCount} 场
                    </Badge>
                  )}
                </span>
                <span className="mt-1 text-sm leading-6 text-muted-foreground">
                  操作手册、需求调研记录、上线验收单、培训课件大纲：先讲清怎么写，再在站内写一稿，
                  系统按版本号、角色矩阵、截图占位、验收判定、回滚方案这些必备要素逐条校验。
                </span>
                <span className="mt-auto inline-flex items-center pt-3 text-sm font-medium text-primary">
                  进入工作区
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </span>
            </button>
          </SpotlightCard>
          <button
            type="button"
            onClick={onSandbox}
            style={{ animationDelay: "400ms" }}
            className="flex h-full items-start gap-4 rounded-2xl border-2 border-dashed border-border bg-card p-6 text-left opacity-80 shadow-md transition-all duration-300 hover:opacity-100 focus-visible:shadow-[var(--focus-ring)] animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <FlaskConical className="h-6 w-6" />
            </span>
            <span className="flex h-full flex-col">
              <span className="flex items-center gap-2">
                <span className="text-lg font-bold text-foreground">自由沙盘</span>
                {sandboxUnlocked ? (
                  <Badge className="rounded-full bg-primary text-primary-foreground">已开放</Badge>
                ) : (
                  <Badge variant="outline" className="rounded-full text-muted-foreground">
                    第三章通关后开放
                  </Badge>
                )}
              </span>
              <span className="mt-1 text-sm leading-6 text-muted-foreground">
                不限流程的实验场：随便建工单、改库存、看物料方块在工序之间流动，
                亲手验证「BOM 错了整条线会怎样」。
              </span>
              <span className="mt-auto inline-flex items-center pt-3 text-sm font-medium text-primary">
                {sandboxUnlocked ? "进入沙盘" : "先用剧情关卡练基本功"}
                {sandboxUnlocked && <ArrowRight className="ml-1 h-4 w-4" />}
              </span>
            </span>
          </button>
        </div>
      </div>
    </section>
  )
}
