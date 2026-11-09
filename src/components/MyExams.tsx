import { dateEn } from '../data/bn'
import { diffDays, weekdayIndex } from '../data/dhaka'
import { exams, examsSource, guideFor, time12, undatedExams } from '../data/exams'
import type { Exam } from '../data/types'
import { href } from '../router'

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const left = (today: string, e: Exam) => {
  const n = diffDays(today, e.date)
  return n > 1 ? `${n} days left` : n === 1 ? 'Tomorrow' : n === 0 ? 'Today' : 'Done'
}

/** All admission exams in date order with days left; MIST (the main one) stands out. MIST, SUST and CU open their
 *  guide page; an exam with no date yet (IUT) comes last with its study links right in the card. */
export function MyExams({ today }: { today: string }) {
  return (
    <section className="card my-exams" aria-label="My exams">
      <h2>My exams</h2>
      <ol className="mx-list">
        {exams.map((e) => {
          const n = diffDays(today, e.date)
          const g = guideFor(e.tag)
          const body = (
            <>
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
              {g && <div className="mx-open small">Pattern, marks &amp; study guide <span aria-hidden="true">›</span></div>}
            </>
          )
          return (
            <li key={e.tag} className={`mx ${e.main ? 'main' : ''} ${n < 0 ? 'past' : ''} ${g ? 'has-guide' : ''}`}>
              {g ? <a className="mx-a" href={href.exam(g.slug)} aria-label={`${e.name} ${e.unit}: exam pattern and study guide`}>{body}</a> : body}
            </li>
          )
        })}
        {undatedExams.map((e) => (
          <li key={e.tag} className="mx undated">
            <div className="mx-h">
              <span className="mx-name">
                {e.name} <span className="mx-unit">{e.unit}</span>
                <span className="tag mx-fun">Just for fun</span>
              </span>
              <span className="mx-left num">TBA</span>
            </div>
            <div className="mx-when small">{e.when}</div>
            <div className="mx-meta small">{e.format}</div>
            <div className="mx-subj small">{e.subjects}</div>
            {e.links && (
              <div className="mx-links">
                {e.links.map((l, i) => (
                  <a key={l.url} className={`btn sm ${i === 0 ? 'primary' : ''}`} href={l.url} target="_blank" rel="noopener noreferrer">
                    {i === 0 ? '📝' : '📘'} {l.label}
                  </a>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      <p className="small mx-note">{examsSource}</p>
    </section>
  )
}
