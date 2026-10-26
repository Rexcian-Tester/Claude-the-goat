import { describe, expect, it } from 'vitest'
import { studyPlan } from '../data/load'
import { PLAN_REBASE, SYLLABUS_END, planDays } from '../data/plan'
import { chapterByName } from '../data/catalog'
import { ownTasks, topicMark } from '../logic/dayStatus'
import { topicOn } from '../logic/dues'
import { applyEdits, movePart, splitPart } from '../logic/planEdits'
import { mapReader } from '../logic/reader'
import { buildSchedule } from '../logic/schedule'
import { chapterCompletion } from '../logic/stats'
import { FINISHED_MARKER, finishedMarks } from '../planner/markFinished'
import { sched } from './helpers'

const row = (d: string) => sched.byOrig.get(d)!

describe('plan reorganised on 27 Oct', () => {
  it('keeps the old plan before 27 Oct exactly, and marks it as history', () => {
    expect(PLAN_REBASE).toBe('2026-10-27')
    expect(SYLLABUS_END).toBe('2026-12-05')
    const old = studyPlan.days.filter((d) => d.date < PLAN_REBASE)
    expect(old).toHaveLength(27)
    // old items keep their position-based keys (no ix, no tk)
    for (const d of old) for (const it of d.items) expect(it.ix === undefined && it.tk === undefined).toBe(true)
    expect(planDays.filter((d) => d.archived).map((d) => d.date)).toEqual(old.map((d) => d.date))
    expect(row('2026-10-26').items[0].ch).toBe('অন্তরীকরণ')
  })

  it('new topics never share an id with an old one (Due/Done marks and planner edits stay apart)', () => {
    const keys = planDays.flatMap((d) => d.items.map((i) => i.key))
    expect(new Set(keys).size).toBe(keys.length)
    for (const d of planDays.filter((x) => !x.archived)) for (const it of d.items) expect(it.itemIdx).toBeGreaterThanOrEqual(10)
  })

  it('a micro-task reused from the old plan shows its old tick on the new day', () => {
    // গুণগত রসায়ন (finish) on 27 Oct reuses 12–13 Oct's micro-tasks
    const it = row('2026-10-27').items.find((i) => i.ch === 'গুণগত রসায়ন')!
    expect(it.tks.slice(0, 4)).toEqual([0, 1, 2, 3].map((j) => `task:2026-10-12:0:${j}`))
    const r = mapReader({ 'task:2026-10-12:0:0': true, 'task:2026-10-12:0:1': true })
    expect(topicOn(r, row('2026-10-27'), it, sched.rows).ticked).toBe(2)
    // every reused key really exists in the old plan
    const oldKeys = new Set(planDays.flatMap((d) => d.items.flatMap((i) => i.tks)).filter((k) => k < `task:${PLAN_REBASE}`))
    for (const d of planDays.filter((x) => !x.archived))
      for (const i of d.items) for (const k of i.tks) if (!k.startsWith(`task:${d.date}:`)) expect(oldKeys.has(k) || k.slice(5, 15) >= PLAN_REBASE).toBe(true)
  })

  it('moving or splitting a reused topic keeps its old ticks', () => {
    const it = row('2026-10-28').items[0] // স্থিতিবিদ্যা, reuses 8–9 Oct
    const n = it.topicList.length
    const e = splitPart(movePart(undefined, it.key, n, '0', '2026-10-29', ''), it.key, n, '0', [
      { row: '2026-10-29', subs: [0, 1, 2], note: '' },
      { row: '2026-10-30', subs: [3, 4, 5, 6], note: '' },
    ])
    const days = applyEdits(planDays, e)
    const p1 = days.find((d) => d.date === '2026-10-29')!.items.find((i) => i.src === it.key)!
    const p2 = days.find((d) => d.date === '2026-10-30')!.items.find((i) => i.src === it.key)!
    expect(p1.tks).toEqual(it.tks.slice(0, 3))
    expect(p2.tks).toEqual(it.tks.slice(3))
    expect(p1.tks[0]).toBe('task:2026-10-08:0:0')
  })

  it('an old-plan topic moved past 27 Oct stays on its old day', () => {
    const it = row('2026-10-22').items[0] // ফাংশন (old plan)
    const days = applyEdits(planDays, movePart(undefined, it.key, it.topicList.length, '0', '2026-10-30', ''))
    expect(days.find((d) => d.date === '2026-10-22')!.items.some((i) => i.src === it.key)).toBe(true)
    expect(days.find((d) => d.date === '2026-10-30')!.items.some((i) => i.src === it.key)).toBe(false)
  })

  it('a chapter finished in the old plan stays finished, even though the new plan has it again', () => {
    const fn = chapterByName('Math', 'ফাংশন ও ফাংশনের লেখচিত্র')!
    const only = (c: { id: string }) => c.id === fn.id
    expect(chapterCompletion(mapReader({}), sched, only).done).toBe(0)
    const oldDone = mapReader({ 'task:2026-10-21:0:status': 'done', 'task:2026-10-22:0:status': 'done' })
    expect(chapterCompletion(oldDone, sched, only).done).toBe(1)
    // finishing it on the new day counts too
    const newDone = mapReader(Object.fromEntries(row('2026-10-27').items[0].tks.map((k) => [k, true])))
    expect(chapterCompletion(newDone, sched, only).done).toBe(1)
  })

  it('skipped-by-choice chapters are not counted as remaining work', () => {
    const math = chapterCompletion(mapReader({}), sched, (c) => c.subject === 'Math')
    const ids = ['বাস্তব সংখ্যা ও অসমতা', 'যোগাশ্রয়ী প্রোগ্রাম'].map((n) => chapterByName('Math', n)!.id)
    expect(ids.every((id) => (sched.slots.get(id) ?? []).length === 0)).toBe(true)
    expect(math.total).toBe(18) // 20 Math chapters minus the two skipped
  })
})

describe('one-time Done for the chapters you finished in the old plan', () => {
  it('marks every old-plan topic of those seven chapters, once', () => {
    const marks = finishedMarks(() => undefined, 1)
    const keys = marks.map(([k]) => k)
    expect(keys.at(-1)).toBe(FINISHED_MARKER)
    const chs = new Set(
      planDays.filter((d) => d.archived).flatMap((d) => d.items.filter((i) => keys.includes(`task:${i.key}:status`)).map((i) => i.ch)),
    )
    expect([...chs].sort()).toEqual(['অন্তরীকরণ', 'কাজ, শক্তি ও ক্ষমতা', 'গতিবিদ্যা', 'নিউটনিয়ান বলবিদ্যা', 'পরিবেশ রসায়ন', 'ভেক্টর', 'ম্যাট্রিক্স ও নির্ণায়ক'].sort())
    // 3 Oct, 5 Oct, 6 Oct, 10–11 Oct, 14–15 Oct, 17 Oct, 24–26 Oct
    expect(keys.length - 1).toBe(11)
    expect(keys.every((k) => k === FINISHED_MARKER || k < `task:${PLAN_REBASE}`)).toBe(true)
    // nothing else is touched: not কর্মমুখী রসায়ন, nothing in the new plan
    expect(keys).not.toContain('task:2026-10-02:1:status')
    // already done: left alone; marker present: nothing at all
    const get = (k: string) => (k === 'task:2026-10-03:0:status' ? 'done' : undefined)
    expect(finishedMarks(get, 1).map(([k]) => k)).not.toContain('task:2026-10-03:0:status')
    expect(finishedMarks((k) => (k === FINISHED_MARKER ? 1 : undefined), 1)).toEqual([])
  })

  it('after it runs, those chapters count as finished', () => {
    const r = mapReader(Object.fromEntries(finishedMarks(() => undefined, 1)))
    const ids = ['ভেক্টর', 'গতিবিদ্যা'].map((n) => chapterByName('Phy', n)!.id)
    expect(chapterCompletion(r, sched, (c) => ids.includes(c.id)).done).toBe(2)
    expect(topicMark(r, row('2026-10-26').items[0])).toBe('done')
    expect(ownTasks(row('2026-10-26')).length).toBeGreaterThan(0)
  })

  it('works on split parts too', () => {
    const it = row('2026-10-24').items[0]
    const e = splitPart(undefined, it.key, it.topicList.length, '0', [
      { row: '2026-10-24', subs: [0], note: '' },
      { row: '2026-10-25', subs: [1], note: '' },
    ])
    const marks = finishedMarks((k) => (k === 'plan:edits' ? e : undefined), 1).map(([k]) => k)
    const s = buildSchedule(undefined, e)
    const parts = s.rows.flatMap((d) => d.items).filter((i) => i.src === it.key)
    expect(parts).toHaveLength(2)
    for (const p of parts) expect(marks).toContain(`task:${it.key}${p.pid !== '0' ? `#${p.pid}` : ''}:status`)
  })
})
