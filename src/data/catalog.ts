import { priorityMap } from './load'
import type { Chapter, RawChapter, Subject } from './types'

export const SUBJECTS: Subject[] = ['Phy', 'Chem', 'Math']

/** Stable chapter id: subject-paper-no-slug, e.g. Phy-1-3-dynamics (chapter numbers alone repeat, e.g. Math 2nd paper has two chapter 10s). */
export function chapterId(subject: Subject, c: Pick<RawChapter, 'p' | 'no' | 'en'>): string {
  const paper = c.p.includes('১') ? 1 : 2
  const slug = c.en.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${subject}-${paper}-${String(c.no).replace(/[–-]/g, '_')}-${slug}`
}

function enrich(subject: Subject, c: RawChapter): Chapter {
  const id = chapterId(subject, c)
  return {
    ...c,
    id,
    subject,
    paper: c.p.includes('১') ? 1 : 2,
    topics: c.topics.map((t, ti) => ({
      ...t,
      id: `${id}:t${ti}`,
      subs: t.subs.map((s, si) => ({
        ...s,
        id: `${id}:t${ti}:s${si}`,
        qs: s.qs.map((q) => ({ ...q, id: `${id}:${q.y}:${q.q}`, chapterId: id, topicIdx: ti, subIdx: si })),
      })),
    })),
  }
}

export const chaptersBySubject: Record<Subject, Chapter[]> = {
  Phy: priorityMap.chapters.Phy.map((c) => enrich('Phy', c)),
  Chem: priorityMap.chapters.Chem.map((c) => enrich('Chem', c)),
  Math: priorityMap.chapters.Math.map((c) => enrich('Math', c)),
}
export const allChapters: Chapter[] = SUBJECTS.flatMap((s) => chaptersBySubject[s])
export const chapterById = new Map(allChapters.map((c) => [c.id, c]))
export const chapterByName = (subject: Subject, n: string): Chapter | undefined =>
  chaptersBySubject[subject].find((c) => c.n === n)

export const allQuestions = allChapters.flatMap((c) => c.topics.flatMap((t) => t.subs.flatMap((s) => s.qs)))
export const questionById = new Map(allQuestions.map((q) => [q.id, q]))
export const realQuestions = allQuestions.filter((q) => !q.m)

export const YEARS = ['2015-16', '2016-17', '2017-18', '2018-19', '2019-20', '2020-21', '2021-22', '2022-23', '2023-24']
export const SHORT_SYLLABUS_YEARS = ['2021-22', '2022-23', '2023-24']
export const MODEL_TESTS = ['MT1', 'MT2', 'MT3', 'MT4', 'MT5']
