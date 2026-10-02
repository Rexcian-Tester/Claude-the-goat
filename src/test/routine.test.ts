import { describe, expect, it } from 'vitest'
import { blockAt, FRIDAY, ROUTINE, routineFor } from '../views/Routine'

const THU = '2026-10-01'
const FRI = '2026-10-02'
const at = (h: number, m = 0, date = THU) => blockAt(h * 60 + m, date).id

describe('daily routine', () => {
  it('finds the block for any minute, including sleep across midnight', () => {
    expect(at(3, 29)).toBe('sleep')
    expect(at(3, 30)).toBe('wake')
    expect(at(4)).toBe('study-a')
    expect(at(12, 30)).toBe('study-b') // Study Block B & Revision, 9 AM – 1 PM
    expect(at(20, 59)).toBe('dinner')
    expect(at(21)).toBe('sleep')
    expect(at(0)).toBe('sleep')
  })
  it('Friday: no agency work, Jumu\'ah 12:30–2:30, study in the afternoon and evening', () => {
    expect(routineFor(FRI)).toBe(FRIDAY)
    expect(routineFor(THU)).toBe(ROUTINE)
    expect(at(12, 29, FRI)).toBe('study-b')
    expect(at(12, 30, FRI)).toBe('jumuah')
    expect(at(14, 30, FRI)).toBe('study-c')
    expect(at(18, 0, FRI)).toBe('study-d')
    expect(FRIDAY.some((b) => b.kind === 'agency')).toBe(false)
  })
  it('both routines cover all 24 hours with no gaps or overlaps', () => {
    for (const list of [ROUTINE, FRIDAY]) {
      expect(list.reduce((n, b) => n + ((b.to - b.from + 1440) % 1440), 0)).toBe(1440)
      for (let m = 0; m < 1440; m++) expect(list.filter((b) => (b.from < b.to ? m >= b.from && m < b.to : m >= b.from || m < b.to))).toHaveLength(1)
    }
  })
})
