import { describe, expect, it } from 'vitest'
import { blockAt, FRIDAY, ROUTINE, routineFor } from '../views/Routine'
import { FRIDAY_BEFORE, ROUTINE_BEFORE } from '../logic/routine'
import { studyBlocks, blockMinutes } from '../logic/pomo'

const TUE = '2026-10-13'
const FRI = '2026-10-16'
const at = (h: number, m = 0, date = TUE) => blockAt(h * 60 + m, date).id

describe('daily routine (full study days)', () => {
  it('Saturday to Thursday: four study blocks, finds the block for any minute', () => {
    expect(routineFor(TUE)).toBe(ROUTINE_BEFORE)
    expect(at(3, 29)).toBe('sleep')
    expect(at(3, 30)).toBe('wake')
    expect(at(4)).toBe('study-a')
    expect(at(7, 30)).toBe('breakfast')
    expect(at(8, 59)).toBe('breakfast')
    expect(at(9)).toBe('study-b')
    expect(at(12, 59)).toBe('study-b')
    expect(at(13)).toBe('lunch')
    expect(at(14)).toBe('study-c')
    expect(at(15, 59)).toBe('study-c')
    expect(at(16)).toBe('refresh')
    expect(at(17, 30)).toBe('study-d')
    expect(at(20, 29)).toBe('study-d')
    expect(at(20, 30)).toBe('checkin')
    expect(at(21)).toBe('sleep')
    expect(at(0)).toBe('sleep')
  })
  it("Friday: B to 12:30, Jumu'ah 12:30–2:30, Block C 2:30–4:00, Block D is weekly recovery", () => {
    expect(routineFor(FRI)).toBe(FRIDAY_BEFORE)
    expect(at(12, 29, FRI)).toBe('study-b')
    expect(at(12, 30, FRI)).toBe('jumuah')
    expect(at(14, 29, FRI)).toBe('jumuah')
    expect(at(14, 30, FRI)).toBe('study-c')
    expect(at(15, 59, FRI)).toBe('study-c')
    expect(at(16, 0, FRI)).toBe('refresh')
    expect(at(17, 30, FRI)).toBe('study-d')
    expect(FRIDAY.find((b) => b.id === 'study-d')!.note).toMatch(/Weekly recovery/)
  })
  it('no agency blocks, and both routines cover all 24 hours with no gaps or overlaps', () => {
    for (const list of [ROUTINE, FRIDAY, ROUTINE_BEFORE, FRIDAY_BEFORE]) {
      expect(list.some((b) => b.id.startsWith('agency') || /agency/i.test(b.label))).toBe(false)
      expect(list.filter((b) => b.kind === 'study').map((b) => b.id)).toEqual(['study-a', 'study-b', 'study-c', 'study-d'])
      expect(list.reduce((n, b) => n + ((b.to - b.from + 1440) % 1440), 0)).toBe(1440)
      for (let m = 0; m < 1440; m++) expect(list.filter((b) => (b.from < b.to ? m >= b.from && m < b.to : m >= b.from || m < b.to))).toHaveLength(1)
    }
  })
  it('from Sun 22 Nov: morning break 7:30–9:30, Block B 9:30–1:00 (Friday 9:30–12:30); earlier days keep 9:00', () => {
    const SUN = '2026-11-22'
    const FRI2 = '2026-11-27'
    expect(routineFor('2026-11-21')).toBe(ROUTINE_BEFORE)
    expect(routineFor(SUN)).toBe(ROUTINE)
    expect(routineFor(FRI2)).toBe(FRIDAY)
    expect(at(9, 0, SUN)).toBe('breakfast')
    expect(at(9, 29, SUN)).toBe('breakfast')
    expect(at(9, 30, SUN)).toBe('study-b')
    expect(at(12, 0, SUN)).toBe('study-b') // the 12:00 PM daily exam stays inside Block B
    expect(at(9, 0, '2026-11-21')).toBe('study-b')
    expect(ROUTINE.find((b) => b.id === 'breakfast')!.label).toBe('Morning break: workout, shower & breakfast')
    expect(at(9, 30, FRI2)).toBe('study-b')
    expect(at(12, 30, FRI2)).toBe('jumuah')
    // targets come from block lengths: Block B is 30 minutes shorter; A, C and D unchanged
    const mins = (d: string) => studyBlocks(d).map((b) => `${b.id} ${blockMinutes(b)}`)
    expect(mins(SUN)).toEqual(['study-a 210', 'study-b 210', 'study-c 120', 'study-d 180'])
    expect(mins('2026-11-21')).toEqual(['study-a 210', 'study-b 240', 'study-c 120', 'study-d 180'])
    expect(mins(FRI2)).toEqual(['study-a 210', 'study-b 180', 'study-c 90', 'study-d 180'])
  })
})
