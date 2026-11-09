// Admission exams (site-source/data/exams.json): the My exams card and the exam tags on the Plan, plus the guide
// pages (site-source/data/exam-guides.json, #/exam/<slug>). Display only, except one synced field per undated
// exam: its date, once announced, set on its guide page (`plan:examdate:<tag>`, { date, time }).
import { K } from '../logic/keys'
import { store } from '../store/store'
import { examsData, guidesData } from './load'
import type { Exam, ExamGuide, UndatedExam } from './types'

export interface SetDate { date: string; time: string }
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/
/** A valid synced date for an undated exam, or undefined. */
export function setDateOf(tag: string): SetDate | undefined {
  const v = store.field(K.examDate(tag))?.v as Partial<SetDate> | null | undefined
  if (!v || typeof v !== 'object' || typeof v.date !== 'string' || !DATE_RE.test(v.date)) return undefined
  return { date: v.date, time: typeof v.time === 'string' && TIME_RE.test(v.time) ? v.time : '' }
}
/** Save (or clear, with null) the announced date of an undated exam. Syncs to every device. */
export function setExamDate(tag: string, d: SetDate | null) {
  store.set(K.examDate(tag), d && DATE_RE.test(d.date) ? { date: d.date, time: TIME_RE.test(d.time) ? d.time : '' } : null)
}

const raw = examsData.exams
/** Exams with a date (from the JSON, or set on the page for IUT), in date order. Plan tags and countdowns use these. */
export function examList(): Exam[] {
  const out: Exam[] = []
  for (const e of raw) {
    if (e.date !== null) out.push(e)
    else {
      const s = setDateOf(e.tag)
      if (s) out.push({ ...e, date: s.date, time: s.time, dateSet: true })
    }
  }
  return out.sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')))
}
/** Exams whose date is still not announced (IUT until a date is set): listed last in the card. */
export function undatedList(): UndatedExam[] {
  return raw.filter((e): e is UndatedExam => e.date === null && !setDateOf(e.tag))
}
export const examsSource = examsData.source
export const examOn = (date: string): Exam | undefined => examList().find((e) => e.date === date)
/** "11:00" -> "11:00 AM"; no time yet -> "time TBA" */
export const time12 = (hhmm: string) => {
  if (!hhmm) return 'time TBA'
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** The guide page of an exam (MIST, SUST, CU, IUT), or undefined (RU has none). */
export const guideFor = (tag: string): ExamGuide | undefined => guidesData.guides[tag]
/** The exam and its guide for a page slug ("mist" -> MIST A). The exam has date null while IUT's is not set. */
export function examBySlug(slug: string | undefined): { exam: Exam | UndatedExam; guide: ExamGuide } | undefined {
  for (const exam of [...examList(), ...undatedList()]) {
    const guide = guideFor(exam.tag)
    if (guide && guide.slug === slug) return { exam, guide }
  }
  return undefined
}
