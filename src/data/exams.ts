// Admission exams (site-source/data/exams.json): the My exams card and the exam tags on the Plan. Display only.
import { examsData } from './load'
import type { Exam } from './types'

export const exams: Exam[] = [...examsData.exams].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
export const examsSource = examsData.source
export const examOn = (date: string): Exam | undefined => exams.find((e) => e.date === date)
/** "11:00" -> "11:00 AM" */
export const time12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
