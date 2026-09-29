import { afterEach, describe, expect, it } from 'vitest'
import { addDays, dhakaDate, diffDays, msUntilDhakaMidnight, setTodayOverride, todayISO } from '../data/dhaka'
import { dateSpanBn, dayRangeBn, dateBn, bn } from '../data/bn'

afterEach(() => setTodayOverride(null))

describe('Asia/Dhaka "today"', () => {
  it('rolls over at 18:00 UTC (00:00 Dhaka), whatever the device timezone', () => {
    expect(dhakaDate(Date.parse('2026-09-29T17:59:59Z'))).toBe('2026-09-29')
    expect(dhakaDate(Date.parse('2026-09-29T18:00:00Z'))).toBe('2026-09-30')
    expect(dhakaDate(Date.parse('2026-12-18T23:59:59+06:00'))).toBe('2026-12-18')
    expect(dhakaDate(Date.parse('2026-12-19T00:00:00+06:00'))).toBe('2026-12-19')
  })
  it('a late-evening US moment is already tomorrow in Dhaka', () => {
    expect(dhakaDate(Date.parse('2026-10-09T20:00:00-07:00'))).toBe('2026-10-10')
  })
  it('date arithmetic is timezone independent', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-14', 1)).toBe('2026-12-15')
    expect(diffDays('2026-09-30', '2026-12-19')).toBe(80)
    expect(diffDays('2026-12-19', '2026-09-30')).toBe(-80)
  })
  it('override wins for testing endgame, and clears', () => {
    setTodayOverride('2026-12-15')
    expect(todayISO(Date.parse('2026-09-29T00:00:00Z'))).toBe('2026-12-15')
    setTodayOverride('garbage')
    expect(todayISO(Date.parse('2026-09-29T00:00:00Z'))).toBe('2026-09-29')
  })
  it('midnight countdown is within a day', () => {
    const v = msUntilDhakaMidnight(Date.parse('2026-09-29T17:59:00Z'))
    expect(v).toBe(60000)
  })
})

describe('Bangla date formatting', () => {
  it('uses Bangla digits and month names', () => {
    expect(bn(2026)).toBe('২০২৬')
    expect(dateBn('2026-10-10')).toBe('১০ অক্টোবর')
  })
  it('compacts consecutive dates the way search cards show them', () => {
    expect(dateSpanBn(['2026-10-10', '2026-10-11'])).toBe('১০ ও ১১ অক্টোবর')
    expect(dateSpanBn(['2026-10-03', '2026-10-04', '2026-10-05'])).toBe('৩–৫ অক্টোবর')
    expect(dateSpanBn(['2026-09-30', '2026-10-01'])).toBe('৩০ সেপ্টেম্বর ও ১ অক্টোবর')
    expect(dateSpanBn(['2026-10-01', '2026-11-05'])).toBe('১ অক্টোবর, ৫ নভেম্বর')
    expect(dayRangeBn([10, 11])).toBe('দিন ১০–১১')
    expect(dayRangeBn([3])).toBe('দিন ৩')
  })
})
