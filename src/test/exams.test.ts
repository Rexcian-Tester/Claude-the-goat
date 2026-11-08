import { describe, expect, it } from 'vitest'
import { examOn, exams, time12 } from '../data/exams'
import { EXAM_DATE } from '../data/plan'

describe('admission exams (exams.json)', () => {
  it('lists the four exams in date order, MIST the only main one and on the plan\'s exam date', () => {
    expect(exams.map((e) => `${e.date} ${e.tag}`)).toEqual(['2027-01-09 RU C', '2027-01-17 SUST A1', '2027-01-22 MIST A', '2027-01-30 CU A'])
    expect(exams.filter((e) => e.main).map((e) => e.date)).toEqual([EXAM_DATE])
    expect(examOn('2027-01-17')?.name).toBe('SUST')
    expect(examOn('2027-01-10')).toBeUndefined()
  })
  it('shows times in 12-hour form', () => {
    expect(exams.map((e) => time12(e.time))).toEqual(['11:00 AM', '3:00 PM', '10:00 AM', '11:00 AM'])
  })
})
