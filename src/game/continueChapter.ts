import type { ChapterDef, ChapterState } from "@/content/chapters"

/** Pick the next playable chapter, or the latest cleared chapter after the campaign ends. */
export function getContinueChapter(
  chapters: ChapterDef[],
  chapterState: Record<string, ChapterState>,
): ChapterDef | undefined {
  const stateOf = (chapter: ChapterDef) =>
    chapterState[String(chapter.id)] ?? (chapter.playable ? "open" : "locked")
  const playable = chapters.filter((chapter) => chapter.playable)

  return (
    playable.find((chapter) => stateOf(chapter) === "open") ??
    [...playable].reverse().find((chapter) => stateOf(chapter) === "cleared") ??
    playable[0] ??
    chapters[0]
  )
}
