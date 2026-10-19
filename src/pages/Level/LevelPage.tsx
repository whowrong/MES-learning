import { AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LevelHeader } from "@/components/level/LevelHeader"
import { StoryIntro } from "@/components/level/StoryIntro"
import { MatchStage } from "@/components/level/MatchStage"
import { JudgeStage } from "@/components/level/JudgeStage"
import { QuizStage } from "@/components/level/QuizStage"
import { FillStage } from "@/components/level/FillStage"
import { SortStage } from "@/components/level/SortStage"
import { StageResult } from "@/components/level/StageResult"
import { FeedbackPanel } from "@/components/level/FeedbackPanel"
import { TermCardDialog } from "@/components/level/TermCardDialog"
import type { useLevel } from "./useLevel"

export function LevelPage(p: ReturnType<typeof useLevel>) {
  const chapterTitle = p.level
    ? `第${p.level.chapter}章 · ${p.level.title}`
    : p.chapterMeta
      ? `第${p.chapterMeta.id}章 · ${p.chapterMeta.title}`
      : "关卡"
  const scene = p.level?.scene ?? p.chapterMeta?.scene ?? ""
  // 顶栏进度点按本关实际包含的玩法关生成（顺序跟随内容文件）
  const headerStages = (p.level?.stages ?? []).map((s) => s.type)
  const activeQuoteGiven = p.activeWrongQuote ? p.matchAnswers[p.activeWrongQuote.id] ?? "" : ""
  const activeQuoteGivenTerm = p.terms[activeQuoteGiven]?.term ?? ""
  const activeQuoteExpectedTerm = p.activeWrongQuote ? p.terms[p.activeWrongQuote.answer]?.term ?? "" : ""

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/40 to-card">
      <LevelHeader
        chapterTitle={chapterTitle}
        scene={scene}
        phase={p.phase}
        stages={headerStages}
        onGoHome={p.goHome}
      />
      <main className="pb-16">
        {p.loading && (
          <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">正在进厂，先把车间情况摸一遍…</p>
          </div>
        )}

        {!p.loading && p.loadError && (
          <div className="mx-auto max-w-xl px-6 py-20">
            <div className="rounded-2xl bg-card p-6 text-center shadow-md">
              <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
              <p className="mt-3 text-sm leading-6 text-foreground">{p.loadError}</p>
              <Button
                onClick={p.goHome}
                className="mt-4 rounded-full bg-primary text-primary-foreground focus-visible:shadow-[var(--focus-ring)]"
              >
                回章节地图
              </Button>
            </div>
          </div>
        )}

        {!p.loading && !p.loadError && p.level && (
          <>
            {p.phase === "story" && (
              <StoryIntro
                level={p.level}
                terms={p.terms}
                storyIdx={p.storyIdx}
                storyTotal={p.storyTotal}
                onNext={p.nextStory}
                onOpenTerm={p.openTermCard}
              />
            )}

            {p.phase === "match" && p.matchStageView && (
              <MatchStage
                stage={p.matchStageView}
                terms={p.terms}
                answers={p.matchAnswers}
                selectedQuote={p.selectedQuote}
                results={p.matchResults}
                matchCorrect={p.matchCorrect}
                allPlaced={p.matchAllPlaced}
                nextStageLabel={p.nextStageLabel}
                onSelectQuote={p.selectQuote}
                onAssignConcept={p.assignConcept}
                onClearQuote={p.clearQuoteAnswer}
                onSubmit={p.submitMatch}
                onOpenFeedback={p.openQuoteFeedback}
                onOpenTerm={p.openTermCard}
                onNextStage={p.advanceAfterMatch}
              />
            )}

            {p.phase === "judge" && p.judgeStage && p.judgeQuestionView && (
              <JudgeStage
                title={p.judgeStage.title}
                intro={p.judgeStage.intro}
                problemIdx={p.judgeIdx}
                problemTotal={p.judgeTotal}
                question={p.judgeQuestionView}
                terms={p.terms}
                onPick={p.pickJudgeAnswer}
                onSubmit={p.submitJudgeProblem}
                onNext={p.nextJudgeProblem}
                onOpenTerm={p.openTermCard}
              />
            )}

            {p.phase === "quiz" && p.quizStage && p.quizQuestionView && (
              <QuizStage
                title={p.quizStage.title}
                intro={p.quizStage.intro}
                questionIdx={p.quizIdx}
                questionTotal={p.quizTotal}
                question={p.quizQuestionView}
                terms={p.terms}
                onPick={p.pickQuizOption}
                onSubmit={p.submitQuizQuestion}
                onNext={p.nextQuizQuestion}
                onOpenTerm={p.openTermCard}
              />
            )}

            {p.phase === "fill" && p.fillStage && p.fillQuestionView && (
              <FillStage
                title={p.fillStage.title}
                intro={p.fillStage.intro}
                questionIdx={p.fillIdx}
                questionTotal={p.fillTotal}
                question={p.fillQuestionView}
                terms={p.terms}
                onPick={p.pickFillOption}
                onSubmit={p.submitFillQuestion}
                onTimeout={p.submitFillTimeout}
                onNext={p.nextFillQuestion}
                onOpenTerm={p.openTermCard}
              />
            )}

            {p.phase === "match" && !p.matchStage && p.sortStage && (
              <SortStage
                stage={p.sortStage}
                stepViews={p.sortStepViews}
                attempts={p.sortAttempts}
                maxAttempts={p.sortMaxAttempts}
                revealed={p.sortRevealed}
                wrongCount={p.sortWrongCount}
                submitted={p.sortSubmitted}
                saving={p.saving}
                onMove={p.moveStep}
                onSubmit={p.submitSort}
                onFinish={() => void p.finishLevel()}
              />
            )}

            {p.phase === "sort" && p.sortStage && (
              <SortStage
                stage={p.sortStage}
                stepViews={p.sortStepViews}
                attempts={p.sortAttempts}
                maxAttempts={p.sortMaxAttempts}
                revealed={p.sortRevealed}
                wrongCount={p.sortWrongCount}
                submitted={p.sortSubmitted}
                saving={p.saving}
                onMove={p.moveStep}
                onSubmit={p.submitSort}
                onFinish={() => void p.finishLevel()}
              />
            )}

            {p.phase === "result" && (
              <StageResult
                level={p.level}
                deltas={p.resultDeltas}
                score={p.chapterScore}
                breakdown={p.scoreBreakdown}
                newReviewTerms={p.newReviewTerms}
                terms={p.terms}
                saveError={p.saveError}
                onGoHome={p.goHome}
                onOpenTerm={p.openTermCard}
              />
            )}
          </>
        )}
      </main>
      <FeedbackPanel
        quote={p.activeWrongQuote}
        givenTerm={activeQuoteGivenTerm}
        expectedTerm={activeQuoteExpectedTerm}
        onClose={p.closeFeedback}
      />
      <TermCardDialog term={p.termCard} onClose={p.closeTermCard} />
    </div>
  )
}
