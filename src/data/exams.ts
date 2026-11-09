// Admission exams (site-source/data/exams.json): the My exams card and the exam tags on the Plan, plus the guide
// pages (site-source/data/exam-guides.json, #/exam/<slug>). Display only.
import { examsData, guidesData } from './load'
import type { Exam, ExamGuide, UndatedExam } from './types'

/** Exams with a date, in date order (the Plan tags and the countdowns use these). */
export const exams: Exam[] = examsData.exams
  .filter((e): e is Exam => e.date !== null)
  .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
/** Exams whose date is not announced yet (IUT): listed last in the card, nowhere else. */
export const undatedExams: UndatedExam[] = examsData.exams.filter((e): e is UndatedExam => e.date === null)
export const examsSource = examsData.source
export const examOn = (date: string): Exam | undefined => exams.find((e) => e.date === date)
/** "11:00" -> "11:00 AM" */
export const time12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** The guide page of an exam (MIST, SUST, CU), or undefined (RU, IUT have none). */
export const guideFor = (tag: string): ExamGuide | undefined => guidesData.guides[tag]
/** The exam and its guide for a page slug ("mist" -> MIST A). */
export function examBySlug(slug: string | undefined): { exam: Exam; guide: ExamGuide } | undefined {
  for (const exam of exams) {
    const guide = guideFor(exam.tag)
    if (guide && guide.slug === slug) return { exam, guide }
  }
  return undefined
}
