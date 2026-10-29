// 实习准备营内容红线扫描：public/content/career-prep/ 下的赛道文件自动发现
// （新增赛道文件会被 import.meta.glob 自动发现，不用改本测试）
import { describe, expect, it } from "vitest"
import termsRaw from "../../../public/content/terms.json"
import indexRaw from "../../../public/content/career-prep/index.json"
import { CAREER_TRACK_ORDER, validateCareerTrack, type CareerTrack } from "@/content/careerPrep"

const trackFiles = import.meta.glob("../../../public/content/career-prep/*.json", { eager: true })

const termIds = new Set((termsRaw.terms as Array<{ id: string }>).map((t) => t.id))

function tracks(): CareerTrack[] {
  return Object.entries(trackFiles)
    .filter(([path]) => !path.endsWith("index.json"))
    .map(([, mod]) => (mod as { default: unknown }).default as CareerTrack)
}

describe("实习准备营清单", () => {
  it("登记的三条赛道文件都存在", () => {
    const index = indexRaw as { tracks: Array<{ id: string; file: string }> }
    expect(index.tracks.length).toBeGreaterThanOrEqual(3)
    const files = new Set(tracks().map((t) => t.trackId))
    for (const entry of index.tracks) {
      expect(files.has(entry.id), `清单登记的 ${entry.file} 没找到对应赛道内容`).toBe(true)
    }
  })

  it("赛道 id 与约定顺序一致", () => {
    const index = indexRaw as { tracks: Array<{ id: string }> }
    expect(index.tracks.map((t) => t.id)).toEqual(CAREER_TRACK_ORDER)
  })

  it("rankTexts 四档评语齐全", () => {
    const index = indexRaw as { rankTexts: Record<string, string> }
    for (const rank of ["S", "A", "B", "C"]) {
      expect(index.rankTexts[rank], `缺 ${rank} 档评语`).toBeTruthy()
      expect(index.rankTexts[rank].length).toBeGreaterThanOrEqual(10)
    }
  })

  it("卷型配置合法（题目数与顺序题数非负）", () => {
    const index = indexRaw as { paperSizes: Array<{ id: string; questionCount: number; orderCount: number }> }
    expect(index.paperSizes.length).toBeGreaterThanOrEqual(2)
    for (const s of index.paperSizes) {
      expect(s.questionCount).toBeGreaterThanOrEqual(0)
      expect(s.orderCount).toBeGreaterThanOrEqual(0)
    }
  })
})

describe("实习准备营内容红线", () => {
  const allQuestionIds = new Set<string>()

  it("每个赛道通过 validateCareerTrack", () => {
    const list = tracks()
    expect(list.length).toBeGreaterThanOrEqual(3)
    for (const track of list) {
      expect(() => validateCareerTrack(track), `赛道 ${track.trackId} 校验失败`).not.toThrow()
    }
  })

  it("题目 id 全局唯一（存档与复习队列按 id 记录）", () => {
    for (const track of tracks()) {
      for (const q of track.questions) {
        expect(allQuestionIds.has(q.id), `题目 id ${q.id} 重复`).toBe(false)
        allQuestionIds.add(q.id)
      }
    }
  })

  it("每题都有足量参考答案与加分点（防空口套话）", () => {
    for (const track of tracks()) {
      for (const q of track.questions) {
        expect(q.reference.length, `${q.id} 参考答案太短`).toBeGreaterThanOrEqual(60)
        expect(q.bonus_points.length, `${q.id} 缺加分点`).toBeGreaterThanOrEqual(1)
        for (const bp of q.bonus_points) {
          expect(bp.length, `${q.id} 加分点太短`).toBeGreaterThanOrEqual(6)
        }
      }
    }
  })

  it("引用的术语都在术语库里", () => {
    for (const track of tracks()) {
      for (const q of track.questions) {
        for (const tid of q.term_ids ?? []) {
          expect(termIds.has(tid), `${q.id} 引用了不存在的术语 ${tid}`).toBe(true)
        }
      }
      for (const c of track.cards) {
        for (const tid of c.term_ids ?? []) {
          expect(termIds.has(tid), `卡片 ${c.id} 引用了不存在的术语 ${tid}`).toBe(true)
        }
      }
    }
  })

  it("卡片要点与常见坑齐全（每张卡至少 3 条要点、1 条坑）", () => {
    for (const track of tracks()) {
      for (const c of track.cards) {
        expect(c.points.length, `卡片 ${c.id} 要点太少`).toBeGreaterThanOrEqual(3)
        expect(c.pitfalls.length, `卡片 ${c.id} 缺常见坑`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it("顺序题步骤 id 唯一且不少于 3 步", () => {
    for (const track of tracks()) {
      for (const o of track.orders ?? []) {
        const ids = o.steps.map((s) => s.id)
        expect(new Set(ids).size, `顺序题 ${o.id} 步骤 id 重复`).toBe(ids.length)
        expect(o.steps.length, `顺序题 ${o.id} 步骤太少`).toBeGreaterThanOrEqual(3)
      }
    }
  })
})
