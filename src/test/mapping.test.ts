import { describe, expect, it } from 'vitest'
import { allChapters, allQuestions, chapterByName, questionById } from '../data/catalog'
import { studyPlan } from '../data/load'
import { chaptersForItem, INTENTIONALLY_UNSCHEDULED, unmatchedPlanItems, PLAN_EXCEPTIONS } from '../data/mapping'
import { chapterSlots, planDays, slotLabel } from '../data/plan'

describe('plan <-> priority-map mapping', () => {
  it('every non-catch-up plan item maps to at least one chapter', () => {
    expect(unmatchedPlanItems()).toEqual([])
  })

  it('catch-up (X) items map to nothing', () => {
    const x = studyPlan.days.flatMap((d) => d.items).filter((i) => i.s === 'X')
    expect(x.length).toBe(2)
    for (const it of x) expect(chaptersForItem(it)).toEqual([])
  })

  it('documented exceptions resolve to every chapter they cover', () => {
    for (const [k, list] of Object.entries(PLAN_EXCEPTIONS)) {
      const [s, ch] = k.split('|')
      const got = chaptersForItem({ s: s as 'P' | 'M', ch })
      expect(got.map((c) => `${c.subject}:${c.n}`)).toEqual(list.map((e) => `${e.subject}:${e.n}`))
    }
  })

  it('every priority-map chapter is scheduled, except the intentionally excluded ones', () => {
    const unscheduled = allChapters.filter((c) => (chapterSlots.get(c.id) ?? []).length === 0)
    const allowed = INTENTIONALLY_UNSCHEDULED.map((e) => chapterByName(e.subject, e.n)!.id)
    expect(unscheduled.map((c) => c.id).sort()).toEqual(allowed.sort())
    // and that exclusion is the one the plan's own meta declares
    expect(studyPlan.meta.intentionallyExcluded.some((s) => s.includes('ল্যাবরেটরির নিরাপদ ব্যবহার'))).toBe(true)
  })

  it('math chapters 6–7 (trigonometry) match directly, with a string chapter number', () => {
    const c = chapterByName('Math', 'ত্রিকোণমিতিক অনুপাত ও সংযুক্ত কোণ')!
    expect(c.no).toBe('6–7')
    expect(chapterSlots.get(c.id)!.length).toBeGreaterThan(0)
  })

  it('chapter and question ids are unique', () => {
    expect(new Set(allChapters.map((c) => c.id)).size).toBe(allChapters.length)
    expect(questionById.size).toBe(allQuestions.length)
  })

  it('plan is continuous 30 Sep – 14 Dec with Day 0 first', () => {
    expect(planDays[0].date).toBe('2026-09-30')
    expect(planDays[0].dayNo).toBe(0)
    expect(planDays.at(-1)!.date).toBe('2026-12-14')
    expect(planDays.length).toBe(76)
  })

  it('labels a class day followed by practice', () => {
    const dyn = allChapters.find((c) => c.en === 'Dynamics')!
    const slots = chapterSlots.get(dyn.id)!
    expect(slots.map((s) => s.date)).toEqual(['2026-10-10', '2026-10-11'])
    expect(slots.map((s) => s.dayNo)).toEqual([10, 11])
    expect(slotLabel(slots)).toBe('ক্লাস দিন + অনুশীলন')
  })
})
