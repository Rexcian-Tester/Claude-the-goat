import { describe, expect, it } from 'vitest'
import * as P from '../logic/pomo'
import { addSpan, importEntries, parseSession, sessionDate, subtract, union, watchKey, WATCH_KEY_RE, SPAN_KEY_RE, spanKey, type Span } from '../watch/session'
import { watchSplit } from '../watch/watchTime'

const MIN = 60000
const THU = '2026-10-15' // Study Block A 4:00–7:30 (target 2h50), B 9:00–13:00 (3h15)
const at = (hhmm: string, date = THU) => Date.parse(`${date}T${hhmm}:00+06:00`)
const target = (id: P.StudyBlockId) => P.effectiveTarget(P.blockMinutes(P.studyBlock(id, THU))) * MIN
const none = () => 0
const asObj = (m: Map<P.StudyBlockId, number>) => Object.fromEntries([...m].map(([k, v]) => [k, v / MIN]))
const rec = (...parts: Span[]) => ({ parts, src: 'watch' as const })

describe('watch sessions: validation', () => {
  const now = at('12:00')
  it('accepts a normal session and refuses broken ones', () => {
    expect(parseSession({ id: 'w-abc123', parts: [[at('05:00'), at('05:25')]] }, now)).toEqual({ id: 'w-abc123', parts: [[at('05:00'), at('05:25')]] })
    expect(parseSession({ id: 'x', parts: [[1, 2]] }, now)).toEqual({ error: 'bad-id' })
    expect(parseSession({ id: 'w-abc123', parts: [] }, now)).toEqual({ error: 'bad-parts' })
    expect(parseSession({ id: 'w-abc123', parts: [[at('05:25'), at('05:00')]] }, now)).toEqual({ error: 'bad-parts' })
    expect(parseSession({ id: 'w-abc123', parts: [[at('05:00'), at('05:25')], [at('05:20'), at('05:30')]] }, now)).toEqual({ error: 'parts-overlap' })
    expect(parseSession({ id: 'w-abc123', parts: [[at('05:00'), at('05:00') + 13 * 3600000]] }, now + 13 * 3600000)).toEqual({ error: 'too-long' })
    expect(parseSession({ id: 'w-abc123', parts: [[at('13:00'), at('13:25')]] }, now)).toEqual({ error: 'in-the-future' })
    expect(parseSession({ id: 'w-abc123', parts: [[at('05:00'), at('05:25')]] }, now + 61 * 86400000)).toEqual({ error: 'too-old' })
  })
  it('counts on the Bangladesh day it ended, under the existing day: prefix', () => {
    expect(sessionDate({ parts: [[at('23:50', '2026-10-14'), at('00:15')]] })).toBe(THU)
    expect(watchKey(THU, 'w-abc123')).toBe('day:2026-10-15:watch:w-abc123')
    expect(WATCH_KEY_RE.test(watchKey(THU, 'w-abc123'))).toBe(true)
    expect(SPAN_KEY_RE.test(spanKey(THU, 'k3j9x0aa1b2c'))).toBe(true)
    // every version of the site accepts these keys (merge.ts allow-list)
    expect(/^(task|task-moved|day|refl|q|sub|ch|plan|endgame|note):[^\s]{1,190}$/u.test(watchKey(THU, 'w-abc123'))).toBe(true)
  })
})

describe('watch sessions: intervals', () => {
  it('merges, subtracts and extends stretches', () => {
    expect(union([[5, 8], [1, 3], [3, 4], [7, 9]])).toEqual([[1, 4], [5, 9]])
    expect(subtract([0, 10], [[2, 3], [5, 7]])).toEqual([[0, 2], [3, 5], [7, 10]])
    expect(subtract([0, 10], [[-5, 20]])).toEqual([])
    expect(subtract([0, 10], [])).toEqual([[0, 10]])
    expect(addSpan([[0, 5]], 5, 9)).toEqual([[0, 9]]) // the 5-minute saves join into one stretch
    expect(addSpan(undefined, 1, 2)).toEqual([[1, 2]])
  })
})

describe('watch sessions: counting like site time', () => {
  it('counts to the block the session falls in', () => {
    const r = watchSplit(THU, [rec([at('05:00'), at('05:25')])], [], none, target)
    expect(asObj(r)).toEqual({ 'study-a': 25 })
  })
  it('spills into the earliest block still short when its block is full', () => {
    // Block B already has its full 3h15 from the tablet: a watch session in B's window fills Block A instead
    const base = (id: P.StudyBlockId) => (id === 'study-b' ? target('study-b') : 0)
    const r = watchSplit(THU, [rec([at('10:00'), at('10:25')])], [], base, target)
    expect(asObj(r)).toEqual({ 'study-a': 25 })
  })
  it('a pause is not counted', () => {
    const r = watchSplit(THU, [rec([at('05:00'), at('05:10')], [at('05:20'), at('05:35')])], [], none, target)
    expect(asObj(r)).toEqual({ 'study-a': 25 })
  })
  it('minutes the tablet already logged count once', () => {
    // watch 5:00–5:25, tablet 5:15–5:40: only the watch's 5:00–5:15 is added
    const r = watchSplit(THU, [rec([at('05:00'), at('05:25')])], [[at('05:15'), at('05:40')]], none, target)
    expect(asObj(r)).toEqual({ 'study-a': 15 })
    // fully inside tablet time: nothing added
    expect(watchSplit(THU, [rec([at('05:00'), at('05:25')])], [[at('04:50'), at('06:00')]], none, target).size).toBe(0)
  })
  it('two watch sessions over the same minutes count once', () => {
    const r = watchSplit(THU, [rec([at('05:00'), at('05:25')]), rec([at('05:10'), at('05:35')])], [], none, target)
    expect(asObj(r)).toEqual({ 'study-a': 35 })
  })
})

describe('watch sessions: import', () => {
  const s = { id: 'w-abc123', parts: [[at('05:00'), at('05:25')]] as Span[] }
  it('imports a new session once, and never again', () => {
    expect(importEntries([s, s], () => false)).toEqual([['day:2026-10-15:watch:w-abc123', { parts: s.parts, src: 'watch' }]])
    expect(importEntries([s], (k) => k === 'day:2026-10-15:watch:w-abc123')).toEqual([])
  })
})
