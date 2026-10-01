import { describe, expect, it } from 'vitest'
import * as P from '../logic/pomo'

const C = P.DEFAULT_CONFIG
const MIN = 60000
const hm = (h: number, m = 0) => h * 60 + m

describe('study blocks: targets and schedule', () => {
  it('effective targets follow 25/5 with a 15-minute break after every 4 sessions', () => {
    expect(P.effectiveTarget(240)).toBe(195) // Study Block A: 3h 15m
    expect(P.effectiveTarget(180)).toBe(145) // Study Block B: 2h 25m
    expect(P.effectiveTarget(60)).toBe(50) // Revision
    expect(P.STUDY_BLOCKS.map((b) => b.id)).toEqual(['study-a', 'study-b', 'revision'])
  })
  it('study time counts to the block you are in, else the last one that ended', () => {
    expect(P.attributeBlock(hm(5))).toBe('study-a')
    expect(P.attributeBlock(hm(8, 30))).toBe('study-a') // breakfast: extra time for Block A
    expect(P.attributeBlock(hm(12, 10))).toBe('revision')
    expect(P.attributeBlock(hm(15))).toBe('revision')
    expect(P.attributeBlock(hm(3, 45))).toBe('study-a')
  })
  it('late only inside the block window and past the grace period', () => {
    expect(P.minutesLate('study-a', hm(4, 10), 10)).toBe(0)
    expect(P.minutesLate('study-a', hm(4, 30), 10)).toBe(30)
    expect(P.minutesLate('study-b', hm(8, 30), 10)).toBe(0)
  })
  it('names the non-study block a session would eat into', () => {
    expect(P.collidingBlock(hm(8, 15))?.label).toBe('Breakfast & shower')
    expect(P.collidingBlock(hm(10))).toBeNull()
  })
})

describe('study blocks: session flow', () => {
  it('runs a session, pauses, and ends on wall-clock time', () => {
    let s = P.startFocus(P.idle(), 0, C, 'study-a')
    expect(P.dueAt(s)).toBe(25 * MIN)
    s = P.pause(s, 10 * MIN)
    s = P.resume(s, 20 * MIN)
    expect(P.dueAt(s)).toBe(35 * MIN)
    expect(P.remaining(s, 30 * MIN)).toBe(5 * MIN)
  })
  it('after a session: short break, and a long one after every fourth', () => {
    let s = P.idle()
    for (let i = 1; i <= 4; i++) {
      s = P.startFocus(s, 0, C, 'study-a')
      const e = P.endFocus(s, 25 * MIN, C, false)
      expect(e.studied).toBe(25 * MIN)
      s = P.startBreak(e.state, 25 * MIN, C)
      expect(s.len).toBe((i === 4 ? 15 : 5) * MIN)
      s = P.endBreak(s)
    }
    expect(s.streak).toBe(0)
  })
  it('flow state counts up with no limit and logs only the extra time', () => {
    let s = P.startFocus(P.idle(), 0, C, 'study-a')
    const e = P.endFocus(s, 25 * MIN, C, false)
    s = P.enterFlow(e.state, 26 * MIN)
    expect(P.unlogged(s, 40 * MIN)).toBe(14 * MIN)
    const f = P.stopFlow(s, 46 * MIN, C)
    expect(f.studied).toBe(20 * MIN)
    expect(f.total).toBe(45 * MIN)
    s = P.startBreak(f.state, 46 * MIN, C, 12)
    expect(s.len).toBe(12 * MIN)
  })
  it('auto flow (question timer running) continues from the exact end and logs it all on stop', () => {
    const s = P.startFocus(P.idle(), 0, C, 'study-b')
    const e = P.endFocus(s, 25 * MIN, C, true)
    expect(e.state.phase).toBe('flow')
    expect(e.studied).toBe(0)
    const f = P.stopFlow(e.state, 40 * MIN, C)
    expect(f.studied).toBe(40 * MIN)
    expect(f.state.streak).toBe(1)
  })
})
