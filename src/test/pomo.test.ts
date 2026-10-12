import { describe, expect, it } from 'vitest'
import * as P from '../logic/pomo'

const C = P.DEFAULT_CONFIG
const MIN = 60000
const hm = (h: number, m = 0) => h * 60 + m

const THU = '2026-10-15'
const FRI = '2026-10-16'
describe('study blocks: targets and schedule', () => {
  it('effective targets follow 25/5 with a 15-minute break after every 4 sessions', () => {
    expect(P.effectiveTarget(240)).toBe(195) // a 4-hour block: 3h 15m
    expect(P.effectiveTarget(210)).toBe(170) // 3.5 hours
    expect(P.effectiveTarget(180)).toBe(145)
    expect(P.effectiveTarget(120)).toBe(100)
    expect(P.effectiveTarget(60)).toBe(50)
  })
  it('every day has Study Blocks A, B & Revision, C and D; Friday shifts C', () => {
    expect(P.studyBlocks(THU).map((b) => [b.id, b.from / 60, b.to / 60])).toEqual([['study-a', 4, 7.5], ['study-b', 9, 13], ['study-c', 14, 16.5], ['study-d', 17.5, 20]])
    expect(P.studyBlocks(FRI).map((b) => [b.id, b.from / 60, b.to / 60])).toEqual([['study-a', 4, 7.5], ['study-b', 9, 12.5], ['study-c', 14.5, 16.5], ['study-d', 17.5, 20]])
    // per-block targets from the unchanged 25/5 + 15-after-4 cycle
    const t = (d: string) => P.studyBlocks(d).map((b) => P.effectiveTarget(P.blockMinutes(b)))
    expect(t(THU)).toEqual([170, 195, 120, 120]) // 2h50 · 3h15 · 2h00 · 2h00
    expect(t(FRI)).toEqual([170, 170, 100, 120]) // 2h50 · 2h50 · 1h40 · 2h00
    expect(P.studyBlock('study-b', THU).label).toBe('Study Block B & Revision')
  })
  it('study time counts to the block you are in, else the last one that ended', () => {
    expect(P.attributeBlock(hm(5), THU)).toBe('study-a')
    expect(P.attributeBlock(hm(8), THU)).toBe('study-a') // breakfast: extra time for Block A
    expect(P.attributeBlock(hm(12, 10), THU)).toBe('study-b')
    expect(P.attributeBlock(hm(13, 30), THU)).toBe('study-b') // lunch
    expect(P.attributeBlock(hm(15), THU)).toBe('study-c')
    expect(P.attributeBlock(hm(14, 15), FRI)).toBe('study-b') // Jumu'ah
    expect(P.attributeBlock(hm(19), FRI)).toBe('study-d')
    expect(P.attributeBlock(hm(3, 45), THU)).toBe('study-a')
  })
  it('late only inside the block window and past the grace period, for every block', () => {
    expect(P.minutesLate('study-a', hm(4, 10), 10, THU)).toBe(0)
    expect(P.minutesLate('study-a', hm(4, 30), 10, THU)).toBe(30)
    expect(P.minutesLate('study-b', hm(8, 30), 10, THU)).toBe(0)
    expect(P.minutesLate('study-b', hm(9, 25), 10, THU)).toBe(25)
    expect(P.minutesLate('study-c', hm(14, 20), 10, THU)).toBe(20)
    expect(P.minutesLate('study-c', hm(14, 20), 10, FRI)).toBe(0) // C starts 2:30 on Friday
    expect(P.minutesLate('study-d', hm(18, 10), 10, FRI)).toBe(40)
    expect(P.blockIn(hm(9, 25), THU)?.id).toBe('study-b')
  })
  it('names the non-study block a session would eat into (Jumu\'ah on Fridays)', () => {
    expect(P.collidingBlock(hm(8), THU)?.label).toBe('Breakfast & shower')
    expect(P.collidingBlock(hm(13, 30), THU)?.label).toBe('Lunch & nap')
    expect(P.collidingBlock(hm(10), THU)).toBeNull()
    expect(P.collidingBlock(hm(13), FRI)?.id).toBe('jumuah')
    expect(P.collidingBlock(hm(20, 45), THU)?.label).toBe('Check-in & wind down')
  })
})

describe('study blocks: where study time counts', () => {
  const at = (date: string, h: number, m = 0) => Date.parse(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+06:00`)
  const target = (id: P.StudyBlockId) => P.effectiveTarget(P.blockMinutes(P.studyBlock(id, THU))) * MIN
  it('a session running from breakfast into Block B is split at 9:00', () => {
    const got = P.splitStudy(at(THU, 8, 50), at(THU, 9, 15), THU, () => 0, target)
    expect(got).toEqual([['study-a', 10 * MIN], ['study-b', 15 * MIN]])
  })
  it('once Block B is full, extra time goes back to Block A if it is short', () => {
    const done = (id: P.StudyBlockId) => (id === 'study-b' ? target('study-b') : id === 'study-a' ? 60 * MIN : 0)
    expect(P.splitStudy(at(THU, 11), at(THU, 11, 30), THU, done, target)).toEqual([['study-a', 30 * MIN]])
  })
  it('when every block is full, time stays with the block you are in', () => {
    expect(P.splitStudy(at(THU, 11), at(THU, 11, 20), THU, (id) => target(id), target)).toEqual([['study-b', 20 * MIN]])
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

describe('daily total bar (Goal 10h · Minimum 9h)', () => {
  const H = 3600000
  it('is defined once: minimum 9h (540 min), goal 10h (600 min)', () => {
    expect([P.DAILY_MINIMUM_MIN, P.DAILY_GOAL_MIN]).toEqual([540, 600])
    expect(P.dailyBar(0).mark).toBe(0.9)
  })
  it('fills toward the goal, green past the minimum, gold at the goal, never over full', () => {
    expect(P.dailyBar(0)).toMatchObject({ frac: 0, state: 'normal' })
    expect(P.dailyBar(6 * H)).toMatchObject({ frac: 0.6, state: 'normal' })
    expect(P.dailyBar(9 * H)).toMatchObject({ frac: 0.9, state: 'good' })
    expect(P.dailyBar(9.5 * H)).toMatchObject({ frac: 0.95, state: 'good' })
    expect(P.dailyBar(10.5 * H)).toMatchObject({ frac: 1, state: 'goal' })
  })
})
