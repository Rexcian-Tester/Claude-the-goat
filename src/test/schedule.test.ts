import { describe, expect, it } from 'vitest'
import { dayProgress, ownTasks } from '../logic/dayStatus'
import { mapReader } from '../logic/reader'
import { nextCatchUp, overdueTasks } from '../logic/overdue'
import { previewShift } from '../logic/shift'
import { buildSchedule } from '../logic/schedule'
import { planDays } from '../data/plan'
import { behindInfo } from '../logic/behind'
import { sched, studyDatesBefore, ticked } from './helpers'

describe('day progress', () => {
  it('complete when all tasks ticked, or manually marked', () => {
    const row = sched.byOrig.get('2026-10-10')!
    expect(dayProgress(mapReader({}), row, sched.rows).status).toBe('none')
    const all = ticked(['2026-10-10'])
    expect(dayProgress(all, row, sched.rows).complete).toBe(true)
    expect(dayProgress(mapReader({ 'day:2026-10-10:done': true }), row, sched.rows).complete).toBe(true)
    const t = ownTasks(planDays.find((d) => d.date === '2026-10-01')!)
    expect(dayProgress(mapReader({ [`task:2026-10-01:0:0`]: true }), sched.byOrig.get('2026-10-01')!, sched.rows).status).toBe('partial')
    expect(t.length).toBeGreaterThan(1)
  })
})

describe('overdue', () => {
  // 30 Oct (current plan) has two topics; its tick keys are reused from the old plan, its "moved" keys are its own
  const d30 = planDays.find((x) => x.date === '2026-10-30')!
  it('carries unticked tasks of a partly done past day, until cleared', () => {
    const today = '2026-10-31'
    const n = ownTasks(d30).length
    const [t0, t1] = ownTasks(d30)
    const m = { [t0.tk]: true } as Record<string, unknown>
    const r = () => mapReader(m)
    expect(overdueTasks(r(), sched.rows, today).filter((t) => t.date === '2026-10-30')).toHaveLength(n - 1)
    m[t1.mk] = 'cleared'
    expect(overdueTasks(r(), sched.rows, today).filter((t) => t.date === '2026-10-30')).toHaveLength(n - 2)
  })

  it('old-plan days are history: never overdue', () => {
    expect(overdueTasks(mapReader({}), sched.rows, '2026-10-27')).toHaveLength(0)
    expect(overdueTasks(mapReader({}), sched.rows, '2026-10-28').every((t) => t.date >= '2026-10-27')).toBe(true)
  })

  it('an old task moved to an old catch-up date (16 Nov) never lands on the current plan\'s 16 Nov', () => {
    const old = ownTasks(planDays.find((x) => x.date === '2026-10-12')!)[0]
    const m = { [old.mk]: '2026-11-16' }
    const p = dayProgress(mapReader(m), sched.byOrig.get('2026-11-16')!, sched.rows)
    expect(p.tasks.some((t) => t.date === '2026-10-12')).toBe(false)
    // and the same topic on its current-plan day (27 Oct) is still open: the old "moved" does not carry
    const reused = ownTasks(sched.byOrig.get('2026-10-27')!).find((t) => t.tk === old.tk)!
    expect(reused.mk).not.toBe(old.mk)
    expect(nextCatchUp(sched.rows, '2026-10-27')).toBeUndefined()
  })

  it('a manually completed past day has nothing overdue', () => {
    expect(overdueTasks(mapReader({ 'day:2026-10-30:done': true }), sched.rows, '2026-10-31').filter((t) => t.date === '2026-10-30')).toHaveLength(0)
  })
})

describe('shift preview (never automatic)', () => {
  it('does nothing when on plan', () => {
    const today = '2026-11-20'
    const p = previewShift(sched.rows, today, ticked(studyDatesBefore(today)))
    expect(p.moves).toEqual([])
    expect(p.debt).toBe(0)
  })

  it('old-plan days are never pulled into the current plan', () => {
    const p = previewShift(sched.rows, '2026-10-27', mapReader({}))
    expect(p.debt).toBe(0)
    expect(p.moves).toEqual([])
  })

  it('3 days behind on 20 Nov: work moves down; what no longer fits by 17 Dec is reported, not dropped', () => {
    const today = '2026-11-20'
    const r = ticked(studyDatesBefore(today).slice(0, -3))
    const p = previewShift(sched.rows, today, r)
    expect(p.debt).toBe(3)
    expect(p.consumedBuffers).toEqual([])
    // the three unfinished days now start today
    expect(p.moves.slice(0, 3).map((m) => m.to)).toEqual(['2026-11-20', '2026-11-21', '2026-11-22'])
    expect(p.unscheduled.length).toBe(3)
    expect(Object.values(p.shifts).every((v) => v === 'unscheduled' || v <= '2026-12-17')).toBe(true)
    expect(Object.keys(p.shifts).every((d) => d >= '2026-10-27')).toBe(true)
  })

  it('accepting the preview fixes the behind count; nothing changes before that', () => {
    const today = '2026-11-20'
    const r = ticked(studyDatesBefore(today).slice(0, -3))
    expect(behindInfo(today, sched.rows, r).lag).toBe(3)
    const p = previewShift(sched.rows, today, r)
    const shifted = buildSchedule(p.shifts)
    expect(behindInfo(today, shifted.rows, r).lag).toBe(0)
    // original schedule is untouched
    expect(sched.byOrig.get('2026-11-19')!.eff).toBe('2026-11-19')
    // and a second preview on the shifted plan is a no-op
    expect(previewShift(shifted.rows, today, r).moves).toEqual([])
  })

  it('completed future days stay put', () => {
    const today = '2026-11-20'
    const r = ticked([...studyDatesBefore(today).slice(0, -2), '2026-11-22'])
    const p = previewShift(sched.rows, today, r)
    expect(p.moves.find((m) => m.row.date === '2026-11-22')).toBeUndefined()
    const s = buildSchedule(p.shifts)
    expect(s.byOrig.get('2026-11-22')!.eff).toBe('2026-11-22')
  })
})

describe('free day', () => {
  it('30 Sep has nothing scheduled: never owed, never a catch-up target', async () => {
    const { nextCatchUp } = await import('../logic/overdue')
    const free = sched.byOrig.get('2026-09-30')!
    expect(free.isFree).toBe(true)
    expect(free.items).toHaveLength(0)
    expect(nextCatchUp(sched.rows, '2026-09-30')?.date).not.toBe('2026-09-30')
    // the reorganised plan has no catch-up days
    expect(planDays.filter((d) => d.isBuffer && !d.isFree)).toEqual([])
  })
})
