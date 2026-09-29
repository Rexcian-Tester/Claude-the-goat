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
    const t = ownTasks(planDays.find((d) => d.date === '2026-09-30')!)
    expect(dayProgress(mapReader({ [`task:2026-09-30:0:0`]: true }), sched.byOrig.get('2026-09-30')!, sched.rows).status).toBe('partial')
    expect(t.length).toBeGreaterThan(1)
  })
})

describe('overdue', () => {
  it('carries unticked tasks of a partly done past day, until cleared or moved', () => {
    const today = '2026-10-02'
    const d = planDays.find((x) => x.date === '2026-10-01')!
    const n = ownTasks(d).length
    const m = { 'task:2026-10-01:0:0': true } as Record<string, unknown>
    const r = () => mapReader(m)
    expect(overdueTasks(r(), sched.rows, today).filter((t) => t.date === '2026-10-01')).toHaveLength(n - 1)
    m['task-moved:2026-10-01:0:1'] = 'cleared'
    expect(overdueTasks(r(), sched.rows, today).filter((t) => t.date === '2026-10-01')).toHaveLength(n - 2)
    m['task-moved:2026-10-01:0:2'] = '2026-11-16'
    expect(overdueTasks(r(), sched.rows, today).filter((t) => t.date === '2026-10-01')).toHaveLength(n - 3)
    // once the catch-up day has passed and it is still not done, it is overdue again
    expect(overdueTasks(r(), sched.rows, '2026-11-17').some((t) => t.key === '2026-10-01:0:2')).toBe(true)
  })

  it('moved tasks show up (and can be ticked) on the catch-up day and count toward it', () => {
    const m: Record<string, unknown> = { 'task-moved:2026-10-01:0:0': '2026-11-16' }
    const buf = sched.byOrig.get('2026-11-16')!
    const p = dayProgress(mapReader(m), buf, sched.rows)
    expect(p.tasks.some((t) => t.key === '2026-10-01:0:0')).toBe(true)
    expect(p.complete).toBe(false)
    expect(nextCatchUp(sched.rows, '2026-10-05')!.eff).toBe('2026-11-16')
    expect(nextCatchUp(sched.rows, '2026-11-17')!.eff).toBe('2026-12-14')
    expect(nextCatchUp(sched.rows, '2026-12-15')).toBeUndefined()
  })

  it('a manually completed past day has nothing overdue', () => {
    expect(overdueTasks(mapReader({ 'day:2026-10-01:done': true }), sched.rows, '2026-10-02').filter((t) => t.date === '2026-10-01')).toHaveLength(0)
  })
})

describe('shift preview (never automatic)', () => {
  it('does nothing when on plan', () => {
    const today = '2026-10-20'
    const p = previewShift(sched.rows, today, ticked(studyDatesBefore(today)))
    expect(p.moves).toEqual([])
    expect(p.debt).toBe(0)
  })

  it('3 days behind on 20 Oct: work moves down and the 16 Nov catch-up day absorbs one, then 14 Dec', () => {
    const today = '2026-10-20'
    const dates = studyDatesBefore(today)
    const r = ticked(dates.slice(0, -3))
    const p = previewShift(sched.rows, today, r)
    expect(p.debt).toBe(3)
    expect(p.consumedBuffers.map((b) => b.date)).toEqual(['2026-11-16', '2026-12-14'])
    // the three unfinished days now start today
    expect(p.moves.slice(0, 3).map((m) => m.to)).toEqual(['2026-10-20', '2026-10-21', '2026-10-22'])
    // nothing lands after 14 Dec; the one row that does not fit is reported, not silently dropped
    expect(p.unscheduled.length).toBe(1)
    expect(p.unscheduled[0].isBuffer).toBe(false)
    expect(Object.values(p.shifts).every((v) => v === 'unscheduled' || v <= '2026-12-14')).toBe(true)
  })

  it('accepting the preview fixes the behind count; nothing changes before that', () => {
    const today = '2026-10-20'
    const r = ticked(studyDatesBefore(today).slice(0, -3))
    expect(behindInfo(today, sched.rows, r).lag).toBe(3)
    const p = previewShift(sched.rows, today, r)
    const shifted = buildSchedule(p.shifts)
    expect(behindInfo(today, shifted.rows, r).lag).toBe(0)
    // original schedule is untouched
    expect(sched.byOrig.get('2026-10-19')!.eff).toBe('2026-10-19')
    // and a second preview on the shifted plan is a no-op
    expect(previewShift(shifted.rows, today, r).moves).toEqual([])
  })

  it('with only one day behind and a buffer ahead, slip is absorbed without unscheduling anything', () => {
    const today = '2026-10-20'
    const r = ticked(studyDatesBefore(today).slice(0, -1))
    const p = previewShift(sched.rows, today, r)
    expect(p.consumedBuffers.map((b) => b.date)).toEqual(['2026-11-16'])
    expect(p.unscheduled).toEqual([])
    // days after the 16 Nov buffer are untouched
    expect(p.moves.every((m) => (m.from ?? '') < '2026-11-16')).toBe(true)
  })

  it('completed future days stay put', () => {
    const today = '2026-10-20'
    const r = ticked([...studyDatesBefore(today).slice(0, -2), '2026-10-22'])
    const p = previewShift(sched.rows, today, r)
    expect(p.moves.find((m) => m.row.date === '2026-10-22')).toBeUndefined()
    const s = buildSchedule(p.shifts)
    expect(s.byOrig.get('2026-10-22')!.eff).toBe('2026-10-22')
  })
})
