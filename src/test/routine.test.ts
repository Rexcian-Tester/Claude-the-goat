import { describe, expect, it } from 'vitest'
import { blockAt, ROUTINE } from '../views/Routine'

const at = (h: number, m = 0) => blockAt(h * 60 + m).id

describe('daily routine', () => {
  it('finds the block for any minute, including sleep across midnight', () => {
    expect(at(3, 29)).toBe('sleep')
    expect(at(3, 30)).toBe('wake')
    expect(at(4)).toBe('study-a')
    expect(at(12, 30)).toBe('revision')
    expect(at(20, 59)).toBe('dinner')
    expect(at(21)).toBe('sleep')
    expect(at(0)).toBe('sleep')
  })
  it('covers all 24 hours with no gaps or overlaps', () => {
    const total = ROUTINE.reduce((n, b) => n + ((b.to - b.from + 1440) % 1440), 0)
    expect(total).toBe(1440)
    for (let m = 0; m < 1440; m++) expect(ROUTINE.filter((b) => (b.from < b.to ? m >= b.from && m < b.to : m >= b.from || m < b.to))).toHaveLength(1)
  })
})
