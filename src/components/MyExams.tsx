import { dateEn } from '../data/bn'
import { diffDays, weekdayIndex } from '../data/dhaka'
import { exams, examsSource, time12 } from '../data/exams'
import type { Exam } from '../data/types'

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const left = (today: string, e: Exam) => {
  const n = diffDays(today, e.date)
  return n > 1 ? `${n} days left` : n === 1 ? 'Tomorrow' : n === 0 ? 'Today' : 'Done'
}

/** All admission exams in date order with days left; MIST (the main one) stands out. */
export function MyExams({ today }: { today: string }) {
  return (
    <section className="card my-exams" aria-label="My exams">
      <h2>My exams</h2>
      <ol className="mx-list">
        {exams.map((e) => {
          const n = diffDays(today, e.date)
          return (
            <li key={e.tag} className={`mx ${e.main ? 'main' : ''} ${n < 0 ? 'past' : ''}`}>
              <div className="mx-h">
                <span className="mx-name">
                  {e.name} <span className="mx-unit">{e.unit}</span>
                  {e.main && <span className="tag mx-main">Main</span>}
                </span>
                <span className="mx-left num">{left(today, e)}</span>
              </div>
              <div className="mx-when small">
                {WD[weekdayIndex(e.date)]} {dateEn(e.date)} {e.date.slice(0, 4)} · {time12(e.time)}
              </div>
              <div className="mx-meta small">{e.format} · Calculator: {e.calculator}</div>
              <div className="mx-subj small">{e.subjects}</div>
            </li>
          )
        })}
      </ol>
      <p className="small mx-note">{examsSource}</p>
    </section>
  )
}
