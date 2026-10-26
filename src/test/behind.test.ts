import { describe, expect, it } from 'vitest'
import { behindInfo, lagLabel, phaseOf } from '../logic/behind'
import { mapReader } from '../logic/reader'
import { sched, studyDatesBefore, ticked } from './helpers'

describe('behind / ahead', () => {
  it('is zero on day 0 evening before anything is due', () => {
    const b = behindInfo('2026-09-30', sched.rows, mapReader({}))
    expect(b.lag).toBe(0) // day 0 is today, not yet owed
    expect(b.showBanner).toBe(false)
  })

  it('counts from the reorganised plan: On plan on 27 Oct, whatever was left in the old plan', () => {
    // nothing ticked at all: the old plan's 1–26 Oct are history, not owed
    expect(behindInfo('2026-10-27', sched.rows, mapReader({})).lag).toBe(0)
    expect(lagLabel(behindInfo('2026-10-27', sched.rows, mapReader({})).lag)).toBe('On plan')
    expect(behindInfo('2026-10-28', sched.rows, mapReader({})).lag).toBe(1)
  })

  it('exactly on plan: everything before today ticked', () => {
    const today = '2026-11-20'
    const b = behindInfo(today, sched.rows, ticked(studyDatesBefore(today)))
    expect(b.lag).toBe(0)
    expect(lagLabel(b.lag)).toBe('On plan')
  })

  it('counts each missed study day, and only shows the banner above 2 days', () => {
    const today = '2026-11-20'
    const dates = studyDatesBefore(today)
    expect(behindInfo(today, sched.rows, ticked(dates.slice(0, -2))).lag).toBe(2)
    expect(behindInfo(today, sched.rows, ticked(dates.slice(0, -2))).showBanner).toBe(false)
    const b3 = behindInfo(today, sched.rows, ticked(dates.slice(0, -3)))
    expect(b3.lag).toBe(3)
    expect(b3.showBanner).toBe(true)
    expect(lagLabel(3)).toBe('3 days behind')
    expect(lagLabel(1)).toBe('1 day behind')
  })

  it('finishing today and future days early makes you ahead', () => {
    const today = '2026-11-20'
    const b = behindInfo(today, sched.rows, ticked([...studyDatesBefore(today), '2026-11-20', '2026-11-21']))
    expect(b.lag).toBe(-2)
    expect(lagLabel(b.lag)).toBe('2 days ahead')
  })

  it('a manually-marked day counts as done; a partly ticked day does not', () => {
    const today = '2026-10-30'
    const r = ticked(['2026-10-27', '2026-10-28'], { 'day:2026-10-29:done': true })
    expect(behindInfo(today, sched.rows, r).lag).toBe(0)
    const t29 = sched.byOrig.get('2026-10-29')!.items[0].tks[0]
    expect(behindInfo(today, sched.rows, mapReader({ [t29]: true })).lag).toBe(3)
  })

  it('days left counts to 19 Dec and phase follows the Dhaka date', () => {
    expect(behindInfo('2026-09-29', sched.rows, mapReader({})).daysLeft).toBe(81)
    expect(behindInfo('2026-12-19', sched.rows, mapReader({})).daysLeft).toBe(0)
    expect(phaseOf('2026-09-29')).toBe('before')
    expect(phaseOf('2026-10-05')).toBe('study')
    // the Revision Phase (6–17 Dec) is plan days; 18 Dec rest, 19 Dec exam
    expect(phaseOf('2026-12-15')).toBe('study')
    expect(phaseOf('2026-12-17')).toBe('study')
    expect(phaseOf('2026-12-18')).toBe('rest')
    expect(phaseOf('2026-12-19')).toBe('exam')
  })
})
