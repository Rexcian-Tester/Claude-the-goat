import { beforeAll, describe, expect, it, vi } from 'vitest'
import { findArtifact } from '../data/artifacts'
import { examBySlug, examList, examOn, guideFor, setDateOf, setExamDate, time12, undatedList } from '../data/exams'
import { EXAM_DATE } from '../data/plan'
import { K } from '../logic/keys'
import { store } from '../store/store'

// no IndexedDB in tests: the store stays in memory
vi.mock('../store/idb', () => ({ loadAll: async () => ({ fields: {}, meta: {} }), putFields: async () => {}, putMeta: async () => {}, clearFields: async () => {} }))

describe('admission exams (exams.json)', () => {
  it('lists the five dated exams in date order, MIST Unit A the only main one and on the plan\'s exam date', () => {
    expect(examList().map((e) => `${e.date} ${e.tag}`)).toEqual(['2027-01-17 SUST A1', '2027-01-30 CU A', '2027-02-05 MIST C', '2027-02-06 MIST A', '2027-02-13 RU C'])
    expect(examList().filter((e) => e.main).map((e) => e.date)).toEqual([EXAM_DATE])
    expect(examOn('2027-01-17')?.name).toBe('SUST')
    expect(examOn('2027-01-09')).toBeUndefined()
    expect(examOn('2027-01-22')).toBeUndefined()
  })
  it('shows times in 12-hour form', () => {
    expect(examList().map((e) => time12(e.time))).toEqual(['3:00 PM', '11:00 AM', '10:00 AM', '9:00 AM', '11:00 AM'])
    expect(time12('')).toBe('time TBA')
  })
})

describe('exam guide pages (exam-guides.json)', () => {
  it('MIST, SUST, CU and IUT have a page; RU keeps none; IUT starts undated', () => {
    expect(examList().filter((e) => guideFor(e.tag)).map((e) => guideFor(e.tag)!.slug)).toEqual(['sust', 'cu', 'mist'])
    expect(guideFor('RU C')).toBeUndefined()
    expect(undatedList().map((e) => e.tag)).toEqual(['IUT'])
    expect(examBySlug('iut')?.exam.date).toBeNull()
    expect(examBySlug('mist')?.exam.tag).toBe('MIST A')
    expect(examBySlug('ru')).toBeUndefined()
    expect(examBySlug(undefined)).toBeUndefined()
  })
  it('the marks add up to each exam\'s total', () => {
    const sum = (slug: string, i: 1 | 2) => examBySlug(slug)!.guide.split.reduce((s, x) => s + x[i], 0)
    expect([sum('mist', 2), sum('mist', 1)]).toEqual([200, 50])
    expect([sum('sust', 2), sum('sust', 1)]).toEqual([80, 80])
    expect(sum('cu', 1)).toBe(90)
    expect([sum('iut', 2), sum('iut', 1)]).toEqual([100, 100])
    for (const slug of ['mist', 'sust', 'cu', 'iut']) {
      const g = examBySlug(slug)!.guide
      for (const [, q, m] of g.split) expect(q * g.perQ).toBe(m)
    }
  })
  it('every top chapter is a real syllabus chapter, and every link is a claude.ai artifact (never the removed MCQ one)', () => {
    const subj = { Physics: 'Phy', Chemistry: 'Chem', Math: 'Math' } as const
    for (const slug of ['mist', 'sust', 'cu', 'iut']) {
      const g = examBySlug(slug)!.guide
      for (const t of g.top) for (const [ch] of t.chapters) expect(findArtifact(subj[t.subject], ch)?.name, `${slug} ${ch}`).toBe(ch)
      for (const [, url] of g.links) expect(url).toMatch(/^https:\/\/claude\.ai\/artifact\/\w+$/)
      expect(g.links.some(([, url]) => url.includes('C7YPz1vJpwc5QtRg4LKHyy'))).toBe(false)
    }
  })
})

describe('setting the IUT date (synced field plan:examdate:IUT)', () => {
  beforeAll(() => store.init())
  it('a set date puts IUT in date order with a Plan tag; clearing it makes it undated again', () => {
    expect(K.examDate('IUT')).toBe('plan:examdate:IUT')
    setExamDate('IUT', { date: '2027-03-20', time: '10:00' })
    expect(setDateOf('IUT')).toEqual({ date: '2027-03-20', time: '10:00' })
    expect(examList().map((e) => e.tag)).toEqual(['SUST A1', 'CU A', 'MIST C', 'MIST A', 'RU C', 'IUT'])
    expect(examOn('2027-03-20')?.dateSet).toBe(true)
    expect(undatedList()).toEqual([])
    expect(examBySlug('iut')?.exam.date).toBe('2027-03-20')
    // no time yet: still dated, time shows as TBA
    setExamDate('IUT', { date: '2027-03-20', time: '' })
    expect(time12(examOn('2027-03-20')!.time)).toBe('time TBA')
    // a bad value from another device is ignored
    store.set(K.examDate('IUT'), { date: 'soon' })
    expect(setDateOf('IUT')).toBeUndefined()
    setExamDate('IUT', null)
    expect(undatedList().map((e) => e.tag)).toEqual(['IUT'])
    expect(examOn('2027-03-20')).toBeUndefined()
  })
})
