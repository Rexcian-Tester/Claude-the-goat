import { describe, expect, it } from 'vitest'
import { repeats } from '../data/repeats'
import { mapReader } from '../logic/reader'
import { burnUp, movingAvg, questionStats, revisionList, streak, weakestChapters } from '../logic/stats'
import { allChapters, realQuestions } from '../data/catalog'
import { sched, ticked } from './helpers'

describe('repeats linking', () => {
  it('links most Repeats entries to real questions', () => {
    const linked = repeats.filter((r) => r.questionIds.length > 0)
    expect(repeats).toHaveLength(19)
    expect(linked.length).toBeGreaterThanOrEqual(12)
    // the Cannizzaro repeat lands on Chemistry
    const c = repeats.find((r) => r.question.includes('ক্যানিজারো'))!
    expect(c.questionIds.every((id) => id.startsWith('Chem-'))).toBe(true)
  })
})

describe('progress stats', () => {
  it('question counts: 244 real questions', () => {
    expect(realQuestions).toHaveLength(244)
    const r = mapReader({ [`q:${realQuestions[0].id}:status`]: 'solved', [`q:${realQuestions[1].id}:status`]: 'wrong' })
    const all = questionStats(r)
    expect(all.total).toBe(244)
    expect(all.solved).toBe(1)
    expect(all.wrong).toBe(1)
  })
  it('weakest chapters: low confidence in a high tier comes first', () => {
    const t1 = allChapters.find((c) => c.tier === 'T1')!
    const t4 = allChapters.find((c) => c.tier === 'T4')!
    const r = mapReader({ [`ch:${t1.id}:confidence`]: 2, [`ch:${t4.id}:confidence`]: 1 })
    expect(weakestChapters(r)[0].chapter.id).toBe(t1.id)
    expect(weakestChapters(mapReader({}))).toEqual([])
  })
  it('revision list: wrong/revisit + all repeats + confidence<=2, sorted by tier', () => {
    const t1 = allChapters.find((c) => c.tier === 'T1')!
    const t3 = allChapters.find((c) => c.tier === 'T3')!
    const q3 = t3.topics[0].subs[0].qs[0]
    const r = mapReader({ [`ch:${t1.id}:confidence`]: 2, [`ch:${t3.id}:confidence`]: 3, [`q:${q3.id}:status`]: 'revisit' })
    const list = revisionList(r)
    expect(list.filter((x) => x.kind === 'repeat')).toHaveLength(19)
    expect(list.some((x) => x.kind === 'chapter' && x.id === t3.id)).toBe(false)
    expect(list.some((x) => x.kind === 'question' && x.id === q3.id)).toBe(true)
    const tiers = list.map((x) => x.tier)
    expect([...tiers].sort()).toEqual(tiers)
  })
  it('streak counts consecutive completed days, today not yet breaking it', () => {
    const r = ticked(['2026-10-01', '2026-10-02', '2026-10-03'])
    expect(streak(r, sched.rows, '2026-10-04')).toBe(3)
    expect(streak(r, sched.rows, '2026-10-05')).toBe(0) // 4 Oct missed -> broken
  })
  it('burn-up: planned follows the calendar, actual follows completions', () => {
    const b = burnUp(ticked(['2026-10-01']), sched.rows, '2026-10-02')
    expect(b).toHaveLength(3)
    expect(b[2].planned).toBe(2) // 30 Sep is a free day
    expect(b[2].actual).toBe(1)
  })
  it('7-day moving average ignores gaps and only shows on days with data', () => {
    expect(movingAvg([2, undefined, 4], 7)).toEqual([2, undefined, 3])
  })
})
