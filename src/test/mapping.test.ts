import { describe, expect, it } from 'vitest'
import { allChapters, allQuestions, chapterByName, questionById } from '../data/catalog'
import { studyPlan } from '../data/load'
import { chaptersForItem, SKIPPED_BY_CHOICE, unmatchedPlanItems, PLAN_EXCEPTIONS } from '../data/mapping'
import { chapterSlots, planDays, slotLabel } from '../data/plan'

describe('plan <-> priority-map mapping', () => {
  it('every non-catch-up plan item maps to at least one chapter', () => {
    expect(unmatchedPlanItems()).toEqual([])
  })

  it('Revision Phase (R) items map to nothing', () => {
    const x = studyPlan.days.flatMap((d) => d.items).filter((i) => i.s === 'X' || i.s === 'R')
    expect(x.length).toBe(10)
    for (const it of x) expect(chaptersForItem(it)).toEqual([])
  })

  it('documented exceptions resolve to every chapter they cover', () => {
    for (const [k, list] of Object.entries(PLAN_EXCEPTIONS)) {
      const [s, ch] = k.split('|')
      const got = chaptersForItem({ s: s as 'P' | 'M', ch })
      expect(got.map((c) => `${c.subject}:${c.n}`)).toEqual(list.map((e) => `${e.subject}:${e.n}`))
    }
  })

  it('every priority-map chapter is scheduled, except the ones skipped by choice', () => {
    const unscheduled = allChapters.filter((c) => (chapterSlots.get(c.id) ?? []).length === 0)
    expect(unscheduled.map((c) => c.n).sort()).toEqual([...SKIPPED_BY_CHOICE].sort())
    expect([...SKIPPED_BY_CHOICE].sort()).toEqual(['বাস্তব সংখ্যা ও অসমতা', 'যোগাশ্রয়ী প্রোগ্রাম'].sort())
    for (const n of SKIPPED_BY_CHOICE) expect(chapterByName('Math', n)).toBeDefined()
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

  it('plan is continuous 30 Sep – 17 Dec with Day 0 first (syllabus to 5 Dec, Revision Phase 6–17 Dec)', () => {
    expect(planDays[0].date).toBe('2026-09-30')
    expect(planDays[0].dayNo).toBe(0)
    expect(planDays.at(-1)!.date).toBe('2026-12-17')
    expect(planDays.length).toBe(79)
    planDays.forEach((d, i) => expect(d.date).toBe(new Date(Date.UTC(2026, 8, 30 + i)).toISOString().slice(0, 10)))
    expect(planDays.filter((d) => d.phase === 'Prime Phase').map((d) => d.date)).toEqual(planDays.filter((d) => d.date >= '2026-10-27' && d.date <= '2026-12-05').map((d) => d.date))
    expect(planDays.filter((d) => d.phase === 'Revision Phase')).toHaveLength(12)
  })

  it('labels a class day followed by practice', () => {
    const dyn = allChapters.find((c) => c.en === 'Dynamics')!
    const slots = chapterSlots.get(dyn.id)!
    expect(slots.map((s) => s.date)).toEqual(['2026-10-10', '2026-10-11'])
    expect(slots.map((s) => s.dayNo)).toEqual([10, 11])
    expect(slotLabel(slots)).toBe('ক্লাস দিন + অনুশীলন')
  })
})
