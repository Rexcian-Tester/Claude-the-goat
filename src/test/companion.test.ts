import { describe, expect, it } from 'vitest'
import { buildCompanionSummary } from '../companion/summary'
import { planDays } from '../data/plan'
import { ownTasks } from '../logic/dayStatus'
import { K } from '../logic/keys'

const f = (v: unknown) => ({ v, t: 1, c: 0, d: 'test' })
const THU = '2026-10-15'
const NOW = Date.parse(`${THU}T10:00:00+06:00`)
const row = (date: string) => planDays.find((d) => d.date === date)!

describe('companion summary', () => {
  it('shows today’s topics with their ticks', () => {
    const tasks = ownTasks(row(THU))
    const s = buildCompanionSummary({ [tasks[0].tk]: f(true) }, THU, NOW)
    expect(s.date).toBe(THU)
    expect(s.today.topics.map((t) => t.en)).toEqual(row(THU).items.map((i) => i.en))
    expect(s.today.topics[0].tasks[0]).toEqual({ text: tasks[0].text, state: 'done' })
    expect(s.today.progress).toMatchObject({ ticked: 1, total: tasks.length, complete: false })
    expect(s.daysToExam).toBe(65)
  })

  it('adds up study time and late starts per block, and keeps the routine', () => {
    const s = buildCompanionSummary(
      {
        [K.focusMs(THU, 'study-a')]: f(90 * 60000),
        [K.focusMs(THU, 'study-b')]: f(30 * 60000),
        [K.late(THU, 'study-b')]: f({ min: 25, reason: 'phone', at: NOW }),
      },
      THU,
      NOW,
    )
    const a = s.today.blocks.find((b) => b.id === 'study-a')!
    const b = s.today.blocks.find((b) => b.id === 'study-b')!
    expect(a.studied).toBe(90 * 60000)
    expect(b.late).toEqual({ min: 25, reason: 'phone' })
    expect(s.today.studied).toBe(120 * 60000)
    expect(s.today.blocks.find((x) => x.id === 'lunch')).toMatchObject({ kind: 'break' })
    expect(s.goalMs).toBe(600 * 60000)
  })

  it('counts watch sessions too', () => {
    const at = (hhmm: string) => Date.parse(`${THU}T${hhmm}:00+06:00`)
    const s = buildCompanionSummary({ [`day:${THU}:watch:w-abc123`]: f({ parts: [[at('05:00'), at('05:25')]], src: 'watch' }) }, THU, NOW)
    expect(s.today.blocks.find((b) => b.id === 'study-a')!.studied).toBe(25 * 60000)
  })

  it('reports the last week and unfinished work', () => {
    const yesterday = '2026-10-14'
    const s = buildCompanionSummary(
      { [K.goal(yesterday)]: f('close'), [K.refl(yesterday, 'blocked')]: f('  YouTube after lunch '), [K.focusMs(yesterday, 'study-c')]: f(60 * 60000) },
      THU,
      NOW,
    )
    expect(s.history).toHaveLength(7)
    expect(s.history[0]).toMatchObject({ date: yesterday, goalAnswer: 'close', studied: 60 * 60000, reflection: { blocked: 'YouTube after lunch' } })
    // nothing ticked since the plan started: every earlier study day is owed
    expect(s.behind.lag).toBeGreaterThan(0)
    expect(s.overdue.count).toBeGreaterThan(0)
    expect(s.upcoming.map((u) => u.date)).toEqual(['2026-10-16', '2026-10-17', '2026-10-18'])
  })

  it('ignores deleted fields', () => {
    const s = buildCompanionSummary({ [K.focusMs(THU, 'study-a')]: { v: null } }, THU, NOW)
    expect(s.today.studied).toBe(0)
  })
})
