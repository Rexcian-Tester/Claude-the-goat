import { describe, expect, it } from 'vitest'
import { planDays } from '../data/plan'
import { dayProgress, ownTasks } from '../logic/dayStatus'
import { applyEdits, evenSplit, movePart, partsOf, resetTopic, splitPart, undoTarget, versionBefore, type PlanEdits, type PlanVersion } from '../logic/planEdits'
import { mapReader } from '../logic/reader'
import { buildSchedule } from '../logic/schedule'
import { burnUp } from '../logic/stats'

const d1 = planDays.find((d) => d.date === '2026-10-01')!
const chem = d1.items[0] // পরিমাণগত রসায়ন, 4 subtopics
const n = chem.topicList.length
const day = (days: typeof planDays, date: string) => days.find((d) => d.date === date)!

describe('plan edits', () => {
  it('no edits leaves the plan as it is', () => {
    expect(applyEdits(planDays, undefined)).toBe(planDays)
    expect(applyEdits(planDays, { v: 1, topics: {} })).toBe(planDays)
  })

  it('moves a topic to another day, with its ticks and note', () => {
    const e = movePart(undefined, chem.key, n, '0', '2026-10-03', 'only the first two')
    const days = applyEdits(planDays, e)
    expect(day(days, '2026-10-01').items.map((i) => i.ch)).not.toContain(chem.ch)
    const moved = day(days, '2026-10-03').items.at(-1)!
    expect(moved.ch).toBe(chem.ch)
    expect(moved.editNote).toBe('only the first two')
    expect(moved.tks).toEqual(chem.tks) // ticks travel
    expect(moved.parts).toBeUndefined()
  })

  it('a day emptied by moves becomes a free day; moving it back drops the edit', () => {
    let e: PlanEdits | undefined
    for (const it of d1.items) e = movePart(e, it.key, it.topicList.length, '0', '2026-10-05', '')
    const one = day(applyEdits(planDays, e), '2026-10-01')
    expect(one.isFree).toBe(true)
    expect(one.isBuffer).toBe(true)
    for (const it of d1.items) e = movePart(e, it.key, it.topicList.length, '0', '2026-10-01', '')
    expect(e!.topics).toEqual({})
  })

  it('splits into parts on different days, a subtopic may repeat, ticks are kept', () => {
    const e = splitPart(undefined, chem.key, n, '0', [
      { row: '2026-10-01', subs: [0, 1], note: '' },
      { row: '2026-10-02', subs: [1, 2, 3], note: 'velocity graph only' },
    ])
    const days = applyEdits(planDays, e)
    const p1 = day(days, '2026-10-01').items.find((i) => i.src === chem.key)!
    const p2 = day(days, '2026-10-02').items.find((i) => i.src === chem.key)!
    expect([p1.partNo, p1.parts, p2.partNo, p2.parts]).toEqual([1, 2, 2, 2])
    expect(p1.tks).toEqual([chem.tks[0], chem.tks[1]])
    // subtopic 1 is a copy in part 2: its own tick; 2 and 3 keep theirs
    expect(p2.tks[0]).toBe(`${chem.tks[1]}:${p2.pid}`)
    expect(p2.tks.slice(1)).toEqual([chem.tks[2], chem.tks[3]])
    expect(p2.editNote).toBe('velocity graph only')
    // ticking part 1 does not finish part 2
    const r = mapReader({ [chem.tks[0]]: true, [chem.tks[1]]: true })
    const sched = buildSchedule(undefined, e)
    const t2 = ownTasks(sched.byOrig.get('2026-10-02')!).filter((t) => t.item.src === chem.key)
    expect(t2.map((t) => !!r.get(t.tk))).toEqual([false, false, false])
  })

  it('a one-subtopic topic can be split into copies', () => {
    expect(evenSplit([0], 3)).toEqual([[0], [0], [0]])
    expect(evenSplit([0, 1, 2, 3, 4], 2)).toEqual([[0, 1, 2], [3, 4]])
  })

  it('re-splitting a part and resetting', () => {
    let e = splitPart(undefined, chem.key, n, '0', [
      { row: '2026-10-01', subs: [0, 1], note: '' },
      { row: '2026-10-02', subs: [2, 3], note: '' },
    ])
    const second = partsOf(e, chem.key, n)[1]
    e = splitPart(e, chem.key, n, second.id, [
      { row: '2026-10-02', subs: [2], note: '' },
      { row: '2026-10-04', subs: [3], note: 'x' },
    ])
    expect(partsOf(e, chem.key, n).map((p) => [p.row, p.subs])).toEqual([['2026-10-01', [0, 1]], ['2026-10-02', [2]], ['2026-10-04', [3]]])
    // every part's subtopic still on its original tick
    const items = applyEdits(planDays, e).flatMap((d) => d.items).filter((i) => i.src === chem.key)
    expect(items.flatMap((i) => i.tks)).toEqual(chem.tks)
    expect(resetTopic(e, chem.key).topics).toEqual({})
  })

  it('a free day that receives a topic becomes a study day that counts', () => {
    const free = planDays.find((d) => d.isFree)
    if (!free) return
    const e = movePart(undefined, chem.key, n, '0', free.date, '')
    const got = day(applyEdits(planDays, e), free.date)
    expect(got.isFree).toBe(false)
    expect(got.isBuffer).toBe(false)
  })

  it('progress follows the moved topic; the original plan line is unchanged', () => {
    const e = movePart(undefined, chem.key, n, '0', '2026-10-03', '')
    const sched = buildSchedule(undefined, e)
    const r = mapReader(Object.fromEntries(chem.tks.map((k) => [k, true])))
    const row3 = sched.byOrig.get('2026-10-03')!
    expect(dayProgress(r, row3, sched.rows).ticked).toBe(n)
    expect(burnUp(r, sched.rows, '2026-10-10').at(-1)!.planned).toBe(burnUp(r, buildSchedule(undefined).rows, '2026-10-10').at(-1)!.planned)
  })

  it('picks the version to undo the last 24 hours', () => {
    const now = Date.parse('2026-10-02T12:00:00Z')
    const h = [
      { at: now - 30 * 3600000, label: 'a', edits: { v: 1 as const, topics: {} } },
      { at: now - 20 * 3600000, label: 'b', edits: { v: 1 as const, topics: {} } },
      { at: now - 1 * 3600000, label: 'c', edits: { v: 1 as const, topics: {} } },
    ]
    expect(versionBefore(h, now)?.label).toBe('b')
    expect(versionBefore(h.slice(0, 1), now)).toBeNull()
  })
})

describe('dues', () => {
  it('lists unfinished past topics and rescheduled ones until done', async () => {
    const { duesList } = await import('../logic/dues')
    const e = movePart(undefined, chem.key, n, '0', '2026-10-05', 'later')
    const sched = buildSchedule(undefined, e)
    const empty = mapReader({})
    let d = duesList(empty, sched.rows, '2026-10-03')
    // 1 Oct's other topic is overdue; the moved chemistry topic is rescheduled (not overdue)
    expect(d.overdue.some((x) => x.row.date === '2026-10-01')).toBe(true)
    expect(d.overdue.some((x) => x.item.src === chem.key)).toBe(false)
    expect(d.rescheduled.map((x) => x.item.src)).toContain(chem.key)
    // ticking all of it moves it to "done in the last week"
    d = duesList(mapReader(Object.fromEntries(chem.tks.map((k) => [k, true]))), sched.rows, '2026-10-06')
    expect(d.rescheduled.some((x) => x.item.src === chem.key)).toBe(false)
    expect(d.overdue.some((x) => x.item.src === chem.key)).toBe(false)
    expect(d.recentDone.some((x) => x.item.src === chem.key)).toBe(true)
    // a day marked done clears its topics from Dues
    d = duesList(mapReader({ 'day:2026-10-01:done': true }), sched.rows, '2026-10-03')
    expect(d.overdue.some((x) => x.row.date === '2026-10-01')).toBe(false)
  })
})

describe('undo', () => {
  it('repeated undo keeps walking back', () => {
    const v = (at: number, kind?: PlanVersion['kind']): PlanVersion => ({ at, label: String(at), edits: { v: 1, topics: {} }, kind })
    // edit1, edit2, edit3, then two undos
    expect(undoTarget([v(1), v(2), v(3)])?.at).toBe(3)
    expect(undoTarget([v(1), v(2), v(3), v(4, 'undo')])?.at).toBe(2)
    expect(undoTarget([v(1), v(2), v(3), v(4, 'undo'), v(5, 'undo')])?.at).toBe(1)
    expect(undoTarget([v(1), v(2, 'undo')])).toBeNull()
    // a restore counts as a change you can undo
    expect(undoTarget([v(1), v(2, 'restore')])?.at).toBe(2)
  })
})

describe('topic Due / Done marks', () => {
  it('Due wins over ticks and the day mark; Done wins over missing ticks', async () => {
    const { topicMarkKey } = await import('../logic/dayStatus')
    const { duesList, topicOn } = await import('../logic/dues')
    const { behindInfo } = await import('../logic/behind')
    const sched = buildSchedule(undefined)
    const row = sched.byOrig.get('2026-10-01')!
    const [a, b] = row.items
    const allTicked = Object.fromEntries(row.items.flatMap((i) => i.tks).map((k) => [k, true]))
    // everything ticked: the day is done
    expect(dayProgress(mapReader(allTicked), row, sched.rows).complete).toBe(true)
    // mark one chapter Due: ticks stay, but the chapter and the day are not done, and it shows in Dues
    const due = mapReader({ ...allTicked, [topicMarkKey(a)]: 'due' })
    expect(topicOn(due, row, a, sched.rows)).toMatchObject({ done: false, ticked: a.tks.length, mark: 'due' })
    expect(dayProgress(due, row, sched.rows).complete).toBe(false)
    expect(duesList(due, sched.rows, '2026-10-02').overdue.map((x) => x.item)).toEqual([a])
    expect(behindInfo('2026-10-02', sched.rows, due).lag).toBe(1)
    // Due also beats "mark this day done"
    expect(dayProgress(mapReader({ 'day:2026-10-01:done': true, [topicMarkKey(a)]: 'due' }), row, sched.rows).complete).toBe(false)
    // Done with nothing ticked: done; the day needs both chapters
    const done = mapReader({ [topicMarkKey(a)]: 'done', [topicMarkKey(b)]: 'done' })
    expect(dayProgress(done, row, sched.rows).complete).toBe(true)
    expect(dayProgress(mapReader({ [topicMarkKey(a)]: 'done' }), row, sched.rows).complete).toBe(false)
  })

  it('a moved topic keeps its mark (part 0 shares the key)', async () => {
    const { topicMarkKey } = await import('../logic/dayStatus')
    const moved = applyEdits(planDays, movePart(undefined, chem.key, n, '0', '2026-10-03', '')).find((d) => d.date === '2026-10-03')!.items.at(-1)!
    expect(topicMarkKey(moved)).toBe(topicMarkKey(chem))
  })
})

describe('day order and chapter progress', () => {
  it('puts a day\'s topics in the order you dragged them, and keeps it through other edits', async () => {
    const { setOrder } = await import('../logic/planEdits')
    const d3 = planDays.find((d) => d.date === '2026-10-03')!
    // move 1 Oct physics onto 3 Oct, then put it first
    const phy = d1.items[1]
    let e = movePart(undefined, phy.key, phy.topicList.length, '0', '2026-10-03', '')
    const placed = applyEdits(planDays, e).find((d) => d.date === '2026-10-03')!
    expect(placed.items.map((i) => i.ch)).toEqual([d3.items[0].ch, phy.ch])
    e = setOrder(e, '2026-10-03', [placed.items[1].key, placed.items[0].key])
    expect(applyEdits(planDays, e).find((d) => d.date === '2026-10-03')!.items.map((i) => i.ch)).toEqual([phy.ch, d3.items[0].ch])
    // an unrelated edit keeps the order; resetting that topic does too
    e = movePart(e, chem.key, n, '0', '2026-10-05', '')
    expect(e.order?.['2026-10-03']).toHaveLength(2)
    expect(resetTopic(e, chem.key).order?.['2026-10-03']).toHaveLength(2)
    // order alone is an edit (reordering an untouched day)
    const only = setOrder(undefined, '2026-10-01', [d1.items[1].key, d1.items[0].key])
    expect(applyEdits(planDays, only).find((d) => d.date === '2026-10-01')!.items.map((i) => i.key)).toEqual([d1.items[1].key, d1.items[0].key])
  })

  it('subject progress counts whole chapters: done only when every day of it is done', async () => {
    const { subjectChapters } = await import('../logic/stats')
    const { topicMarkKey } = await import('../logic/dayStatus')
    const sched = buildSchedule(undefined)
    const base = subjectChapters(mapReader({}), sched, 'C')
    expect(base.done).toBe(0)
    // পরিমাণগত রসায়ন is on 1, 4 and 7 Oct: finishing 1 Oct only "starts" it
    const later = ['2026-10-04', '2026-10-07'].map((d) => sched.byOrig.get(d)!.items.find((i) => i.ch === chem.ch)!)
    const ticks = Object.fromEntries(chem.tks.map((k) => [k, true]))
    expect(subjectChapters(mapReader(ticks), sched, 'C')).toMatchObject({ done: 0, started: 1 })
    expect(subjectChapters(mapReader({ ...ticks, [topicMarkKey(later[0])]: 'done' }), sched, 'C')).toMatchObject({ done: 0, started: 1 })
    const all = mapReader({ ...ticks, ...Object.fromEntries(later.map((i) => [topicMarkKey(i), 'done'])) })
    expect(subjectChapters(all, sched, 'C')).toMatchObject({ done: 1, total: base.total })
  })
})
