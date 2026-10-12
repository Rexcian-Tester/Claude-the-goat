import { describe, expect, it } from 'vitest'
import { blockAt, FRIDAY, ROUTINE, routineFor } from '../views/Routine'

const TUE = '2026-10-13'
const FRI = '2026-10-16'
const at = (h: number, m = 0, date = TUE) => blockAt(h * 60 + m, date).id

describe('daily routine (full study days)', () => {
  it('Saturday to Thursday: four study blocks, finds the block for any minute', () => {
    expect(routineFor(TUE)).toBe(ROUTINE)
    expect(at(3, 29)).toBe('sleep')
    expect(at(3, 30)).toBe('wake')
    expect(at(4)).toBe('study-a')
    expect(at(7, 30)).toBe('breakfast')
    expect(at(8, 59)).toBe('breakfast')
    expect(at(9)).toBe('study-b')
    expect(at(12, 59)).toBe('study-b')
    expect(at(13)).toBe('lunch')
    expect(at(14)).toBe('study-c')
    expect(at(16, 30)).toBe('refresh')
    expect(at(17, 30)).toBe('study-d')
    expect(at(20)).toBe('dinner')
    expect(at(20, 30)).toBe('checkin')
    expect(at(21)).toBe('sleep')
    expect(at(0)).toBe('sleep')
  })
  it("Friday: B to 12:30, Jumu'ah 12:30–2:30, Block C 2:30–4:30, Block D is weekly recovery", () => {
    expect(routineFor(FRI)).toBe(FRIDAY)
    expect(at(12, 29, FRI)).toBe('study-b')
    expect(at(12, 30, FRI)).toBe('jumuah')
    expect(at(14, 29, FRI)).toBe('jumuah')
    expect(at(14, 30, FRI)).toBe('study-c')
    expect(at(16, 30, FRI)).toBe('refresh')
    expect(at(17, 30, FRI)).toBe('study-d')
    expect(FRIDAY.find((b) => b.id === 'study-d')!.note).toMatch(/Weekly recovery/)
  })
  it('no agency blocks, and both routines cover all 24 hours with no gaps or overlaps', () => {
    for (const list of [ROUTINE, FRIDAY]) {
      expect(list.some((b) => b.id.startsWith('agency') || /agency/i.test(b.label))).toBe(false)
      expect(list.filter((b) => b.kind === 'study').map((b) => b.id)).toEqual(['study-a', 'study-b', 'study-c', 'study-d'])
      expect(list.reduce((n, b) => n + ((b.to - b.from + 1440) % 1440), 0)).toBe(1440)
      for (let m = 0; m < 1440; m++) expect(list.filter((b) => (b.from < b.to ? m >= b.from && m < b.to : m >= b.from || m < b.to))).toHaveLength(1)
    }
  })
})
