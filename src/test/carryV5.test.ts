import { beforeAll, describe, expect, it, vi } from 'vitest'
import { planDays, itemByKey } from '../data/plan'
import { v5Topics } from '../data/load'
import { carriedAt, carryNotes } from '../logic/carryV5'
import { buildCompanionSummary } from '../companion/summary'
import { dayProgress, ownTasks, taskState, topicMark, topicMarkKey } from '../logic/dayStatus'
import { K } from '../logic/keys'
import { movePart, resetTopic, type PlanEdits } from '../logic/planEdits'
import { mapReader } from '../logic/reader'
import { buildSchedule } from '../logic/schedule'
import { defaultRows, deleteRow, resetToFile, scheduleRows, undoLast } from '../data/examSchedule'
import { store } from '../store/store'
import { commitEdits, currentEdits, resetPlan } from '../planner/actions'

vi.mock('../store/idb', () => ({ loadAll: async () => ({ fields: {}, meta: {} }), putFields: async () => {}, putMeta: async () => {}, clearFields: async () => {} }))
beforeAll(() => store.init())

const at = (d: string, i = 0) => planDays.find((x) => x.date === d)!.items[i]
const item = at('2026-11-25')
const src = v5Topics[item.key][0].slice(0, v5Topics[item.key][0].lastIndexOf(':'))
const markKey = topicMarkKey(item)
const task = ownTasks(planDays.find((x) => x.date === '2026-11-25')!)[0]
const oldMove = `task-moved:${v5Topics[item.key][0]}`
const edits = (note: string, row = '2026-11-20'): PlanEdits => ({ v: 1, topics: { [src]: { parts: [{ id: '0', row, subs: item.topicList.map((_, i) => i), note }] } } })

describe('what was saved on v5 topics shows on their v6 topics', () => {
  it('maps every moved topic, micro-task for micro-task', () => {
    const moved = planDays.filter((d) => d.date >= '2026-11-23' && d.date <= '2027-01-04').flatMap((d) => d.items)
    expect(Object.keys(v5Topics).sort()).toEqual(moved.map((i) => i.key).sort())
    for (const i of moved) expect(v5Topics[i.key]).toHaveLength(i.topicList.length)
    expect(src.startsWith('2026-11-20:')).toBe(true)
  })
  it('Due / Done carries, and a v6 value always wins', () => {
    for (const m of ['due', 'done']) expect(topicMark(mapReader({ [K.topicMark(src)]: m }), item)).toBe(m)
    expect(topicMark(mapReader({ [K.topicMark(src)]: 'done', [markKey]: 'due' }), item)).toBe('due')
    expect(topicMark(mapReader({ [K.topicMark(src)]: 'done', [markKey]: null }), item)).toBeUndefined()
    expect(topicMark(mapReader({}), item)).toBeUndefined()
  })
  it('24 Nov (two v5 days): Done only when both were done; Due when either was', () => {
    const two = at('2026-11-24')
    const [a, b] = [...new Set(v5Topics[two.key].map((x) => x.slice(0, x.lastIndexOf(':'))))]
    const ka = K.topicMark(a), kb = K.topicMark(b)
    expect(topicMark(mapReader({ [ka]: 'done' }), two)).toBeUndefined()
    expect(topicMark(mapReader({ [ka]: 'done', [kb]: 'done' }), two)).toBe('done')
    expect(topicMark(mapReader({ [ka]: 'done', [kb]: 'due' }), two)).toBe('due')
    const ticked = Object.fromEntries(two.tks.filter((_, i) => v5Topics[two.key][i].startsWith(`${b}:`)).map((k) => [k, true]))
    expect(topicMark(mapReader({ [ka]: 'done', ...ticked }), two)).toBe('done')
  })
  it('a topic split in v5 is Done only when every part was', () => {
    const e: PlanEdits = { v: 1, topics: { [src]: { parts: [{ id: '0', row: '2026-11-20', subs: [0, 1] }, { id: 'ab', row: '2026-11-21', subs: [2, 3] }] } } }
    const one = { [K.edits]: e, [K.topicMark(src)]: 'done' }
    expect(topicMark(mapReader(one), item)).toBeUndefined()
    expect(topicMark(mapReader({ ...one, [K.topicMark(src, 'ab')]: 'done' }), item)).toBe('done')
  })
  it('cleared carries, "moved to <date>" does not, and Undo stays undone', () => {
    expect(taskState(mapReader({ [oldMove]: 'cleared' }), task)).toBe('cleared')
    expect(taskState(mapReader({ [oldMove]: '2026-11-22' }), task)).toBe('open')
    expect(taskState(mapReader({ [oldMove]: 'cleared', [task.mk]: '' }), task)).toBe('open')
    expect(taskState(mapReader({ [oldMove]: 'cleared', [task.mk]: null }), task)).toBe('open')
    expect(carriedAt(mapReader({ [oldMove]: 'cleared' }, { [oldMove]: 123 }), task.mk)).toBe(123)
  })
  it('a carried mark completes the day, also for the companion app', () => {
    const sched = buildSchedule(undefined)
    const row = sched.byOrig.get('2026-11-25')!
    expect(dayProgress(mapReader({ [K.topicMark(src)]: 'done' }), row, sched.rows).complete).toBe(true)
    const f = { [K.topicMark(src)]: { v: 'done', t: 1, c: 0, d: 'x' } }
    expect(JSON.stringify(buildCompanionSummary(f, '2026-11-25', Date.parse('2026-11-25T06:00:00Z')))).toContain('"mark":"done"')
  })
  it('a note shows on the v6 day, without replaying a v5 move', () => {
    const shown = buildSchedule(undefined, edits('my note', '2026-12-20')).byOrig.get('2026-11-25')!.items[0]
    expect(shown.editNote).toBe('my note')
    expect(shown.tks).toEqual(item.tks)
    expect(shown.mks).toEqual(item.mks)
    expect(topicMarkKey(shown)).toBe(markKey)
  })
  it('a note written or removed under v6 is respected', () => {
    const base = carryNotes(edits('old'))!
    const changed = movePart(base, item.key, item.topicList.length, '0', '2026-11-25', 'new')
    expect(buildSchedule(undefined, changed).byOrig.get('2026-11-25')!.items[0].editNote).toBe('new')
    const removed = resetTopic(changed, item.key)
    expect(buildSchedule(undefined, removed).byOrig.get('2026-11-25')!.items[0].editNote).toBeUndefined()
  })
  it('planner saves keep a removal, Undo brings the note back, Reset clears it', () => {
    store.set(K.edits, edits('old'))
    commitEdits(resetTopic(currentEdits(), item.key), 'remove')
    expect(currentEdits()!.topics[item.key]).toBeUndefined()
    const before = Object.values(Object.fromEntries(store.fields)).map((f) => f.v as { label?: string; edits?: PlanEdits }).find((v) => v?.label === 'remove')!
    expect(carryNotes(before.edits)!.topics[item.key].parts[0].note).toBe('old')
    resetPlan()
    expect(currentEdits()).toBeUndefined()
    expect(itemByKey.has(item.key)).toBe(true)
  })
})

describe('SUST Final Model 2 in saved exam schedules', () => {
  it('joins a saved copy once, leaving your dates and statuses alone; a delete stays, Undo restores', () => {
    const mine = defaultRows.filter((r) => r.id !== 'x103').map((r) => (r.id === 'x20' ? { ...r, date: '2026-12-29', status: '50/64' } : r))
    store.set(K.examSched, { rows: mine, at: 1, v: 6 })
    expect(scheduleRows().filter((r) => r.id === 'x103')).toHaveLength(1)
    expect(scheduleRows().find((r) => r.id === 'x20')).toMatchObject({ date: '2026-12-29', status: '50/64' })
    deleteRow('x103')
    expect(scheduleRows().some((r) => r.id === 'x103')).toBe(false)
    undoLast()
    expect(scheduleRows().some((r) => r.id === 'x103')).toBe(true)
    store.set(K.examSched, { rows: mine, at: 1, v: 5 })
    expect(scheduleRows()).toHaveLength(defaultRows.length)
    resetToFile()
  })
})
