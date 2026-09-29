import { describe, expect, it } from 'vitest'
import { active, finish, markAlerted, next, pause, plan, report, resume, start, tag, view } from '../logic/focus'

const cfg = { totalMin: 150, cycleMin: 3, startQ: 1 }
const MIN = 60000

describe('focus timer', () => {
  it('plans questions from total and cycle length', () => {
    expect(plan(cfg)).toMatchObject({ count: 50, lastQ: 50 })
    expect(plan({ totalMin: 10, cycleMin: 3, startQ: 21 })).toMatchObject({ count: 4, startQ: 21, lastQ: 24 })
  })

  it('does not count paused time', () => {
    let s = start(cfg, 0)
    s = pause(s, 2 * MIN)
    expect(active(s, 10 * MIN)).toBe(2 * MIN)
    s = resume(s, 10 * MIN)
    expect(active(s, 11 * MIN)).toBe(3 * MIN)
  })

  it('prompts once per question when the cycle runs out, and keeps counting overtime', () => {
    let s = start(cfg, 0)
    expect(view(s, 2 * MIN).due).toBe(false)
    expect(view(s, 3 * MIN).due).toBe(true)
    s = markAlerted(s)
    const v = view(s, 4 * MIN)
    expect(v.due).toBe(false)
    expect(v.overtime).toBe(true)
    expect(v.spent).toBe(4 * MIN)
  })

  it('logs each question and resets the per-question clock', () => {
    let s = start(cfg, 0)
    s = next(s, 2 * MIN)
    s = next(s, 6 * MIN)
    expect(s.laps).toEqual([{ q: 1, ms: 2 * MIN }, { q: 2, ms: 4 * MIN }])
    expect(view(s, 7 * MIN).spent).toBe(MIN)
    expect(s.alerted).toBe(false)
  })

  it('ends after the last question', () => {
    let s = start({ totalMin: 6, cycleMin: 3, startQ: 1 }, 0)
    s = next(s, MIN)
    expect(s.done).toBe(false)
    s = next(s, 2 * MIN)
    expect(s.done).toBe(true)
    expect(active(s, 99 * MIN)).toBe(2 * MIN)
  })

  it('finishing early keeps a question you actually worked on', () => {
    let s = start(cfg, 0)
    s = next(s, MIN)
    expect(finish(s, MIN + 2000).laps).toHaveLength(1)
    expect(finish(s, 2 * MIN).laps).toHaveLength(2)
  })

  it('tags and summarises', () => {
    expect(tag(3 * MIN, 3 * MIN)).toBe('ontime')
    expect(tag(2 * MIN, 3 * MIN)).toBe('early')
    expect(tag(4 * MIN, 3 * MIN)).toBe('over')
    let s = start(cfg, 0)
    s = next(s, 2 * MIN)
    s = next(s, 6 * MIN)
    s = finish(s, 6 * MIN)
    expect(report(s)).toMatchObject({ n: 2, avg: 3 * MIN, fastest: 2 * MIN, slowest: 4 * MIN, early: 1, over: 1, total: 6 * MIN })
  })
})
