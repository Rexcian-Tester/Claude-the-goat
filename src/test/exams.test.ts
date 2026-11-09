import { describe, expect, it } from 'vitest'
import { findArtifact } from '../data/artifacts'
import { examBySlug, examOn, exams, guideFor, time12, undatedExams } from '../data/exams'
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

describe('exam guide pages (exam-guides.json)', () => {
  it('MIST, SUST and CU have a page; RU keeps none; IUT is undated and has no page', () => {
    const withPage = exams.filter((e) => guideFor(e.tag)).map((e) => guideFor(e.tag)!.slug)
    expect(withPage).toEqual(['sust', 'mist', 'cu'])
    expect(guideFor('RU C')).toBeUndefined()
    expect(undatedExams.map((e) => e.tag)).toEqual(['IUT'])
    expect(guideFor('IUT')).toBeUndefined()
    expect(examOn('2027-03-01')).toBeUndefined()
    expect(undatedExams[0].links?.[0].url).toBe('https://claude.ai/artifact/GgUb1wULf2sqWEKNry573U')
    expect(examBySlug('mist')?.exam.tag).toBe('MIST A')
    expect(examBySlug('ru')).toBeUndefined()
    expect(examBySlug(undefined)).toBeUndefined()
  })
  it('the marks add up to each exam\'s total', () => {
    const total = (slug: string) => examBySlug(slug)!.guide.split.reduce((s, x) => s + x[2], 0)
    const qs = (slug: string) => examBySlug(slug)!.guide.split.reduce((s, x) => s + x[1], 0)
    expect([total('mist'), qs('mist')]).toEqual([200, 50])
    expect([total('sust'), qs('sust')]).toEqual([80, 80])
    expect(qs('cu')).toBe(90)
    for (const slug of ['mist', 'sust', 'cu']) {
      const g = examBySlug(slug)!.guide
      for (const [, q, m] of g.split) expect(q * g.perQ).toBe(m)
    }
  })
  it('every top chapter is a real syllabus chapter, and every link is a claude.ai artifact (never the removed MCQ one)', () => {
    const subj = { Physics: 'Phy', Chemistry: 'Chem', Math: 'Math' } as const
    for (const slug of ['mist', 'sust', 'cu']) {
      const g = examBySlug(slug)!.guide
      for (const t of g.top) for (const [ch] of t.chapters) expect(findArtifact(subj[t.subject], ch)?.name, `${slug} ${ch}`).toBe(ch)
      for (const [, url] of g.links) expect(url).toMatch(/^https:\/\/claude\.ai\/artifact\/\w+$/)
      expect(g.links.some(([, url]) => url.includes('C7YPz1vJpwc5QtRg4LKHyy'))).toBe(false)
    }
  })
})
