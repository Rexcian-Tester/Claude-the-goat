import { findArtifact } from '../data/artifacts'
import { dateEn } from '../data/bn'
import { diffDays, weekdayIndex } from '../data/dhaka'
import { examBySlug, time12 } from '../data/exams'
import type { Subject } from '../data/types'
import { useToday } from '../hooks'
import { href, useRoute } from '../router'

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SUBJ: Record<string, Subject> = { Physics: 'Phy', Chemistry: 'Chem', Math: 'Math' }
const left = (n: number) => (n > 1 ? `${n} days left` : n === 1 ? 'Tomorrow' : n === 0 ? 'Today' : 'Done')

/** One university's exam page (#/exam/mist | sust | cu): pattern, marks, what to study, tips and its study artifacts. */
export function ExamGuideView() {
  const route = useRoute()
  const today = useToday()
  const found = examBySlug(route.param)
  if (!found) return <div className="empty">No guide for this exam. <a href={href.today()}>Back to Today</a></div>
  const { exam: e, guide: g } = found
  const n = diffDays(today, e.date)
  const totalQ = g.split.reduce((s, x) => s + x[1], 0)
  const totalM = g.split.reduce((s, x) => s + x[2], 0)
  const maxM = Math.max(...g.split.map((x) => x[2]))
  return (
    <div className="view exam-guide">
      <div className="page-h">
        <div className="eyebrow"><a href={href.today()}>Today</a> › My exams</div>
        <h1>{g.title}</h1>
        <div className="row-flex">
          {e.main && <span className="tag mx-main">Main</span>}
          <span className="small">{WD[weekdayIndex(e.date)]} {dateEn(e.date)} {e.date.slice(0, 4)} · {time12(e.time)}</span>
          <span className="eg-left num">{left(n)}</span>
        </div>
        <p className="small eg-kind">{g.kind}</p>
      </div>

      <section className="card" aria-label="Question pattern">
        <h2>Question pattern</h2>
        <div className="stat-grid eg-stats">
          {g.stats.map(([k, v]) => (
            <div key={k} className="stat"><span>{k}</span><b>{v}</b></div>
          ))}
        </div>
        <table className="eg-split">
          <thead><tr><th>Subject</th><th>Questions</th><th>Marks</th><th aria-hidden="true" /></tr></thead>
          <tbody>
            {g.split.map(([s, q, m]) => (
              <tr key={s}>
                <td>{s}</td>
                <td className="num">{q} × {g.perQ}</td>
                <td className="num"><b>{m}</b></td>
                <td className="eg-barcell" aria-hidden="true"><div className="bar"><i style={{ width: `${(m / maxM) * 100}%` }} /></div></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>Total</td><td className="num">{totalQ}</td><td className="num"><b>{totalM}</b></td><td /></tr></tfoot>
        </table>
        <ul className="eg-hist small">{g.history.map((h) => <li key={h}>{h}</li>)}</ul>
      </section>

      <section className="card" aria-label={`${e.name} guidelines`}>
        <h2>{e.name} guidelines</h2>
        <ol className="eg-tips">{g.tips.map((t) => <li key={t}>{t}</li>)}</ol>
      </section>

      <section className="card" aria-label="What to study">
        <h2>What to study</h2>
        <p className="small">Most asked chapters in {g.topFrom}. The number is how many questions came from that chapter. 📘 opens its artifact.</p>
        <div className="eg-top">
          {g.top.map((t) => {
            const most = t.chapters[0]?.[1] ?? 1
            return (
              <div key={t.subject} className="eg-sub">
                <h3>{t.subject}</h3>
                <ol>
                  {t.chapters.map(([ch, c]) => {
                    const a = findArtifact(SUBJ[t.subject], ch)
                    return (
                      <li key={ch}>
                        <span className="eg-ch">
                          {ch}
                          {a?.status === 'ready' && a.link && <a className="eg-art" href={a.link} target="_blank" rel="noopener noreferrer" aria-label={`Open the ${ch} artifact`}>📘</a>}
                          {a?.skipped && <span className="tag">Skipped</span>}
                        </span>
                        <span className="eg-count num">{c}</span>
                        <span className="bar" aria-hidden="true"><i style={{ width: `${(c / most) * 100}%` }} /></span>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )
          })}
          <div className="eg-sub">
            <h3>English</h3>
            <ol>
              {g.english.map(([k, c]) => (
                <li key={k}>
                  <span className="eg-ch">{k}</span>
                  <span className="eg-count num">{c}</span>
                  <span className="bar" aria-hidden="true"><i style={{ width: `${(c / (g.english[0]?.[1] ?? 1)) * 100}%` }} /></span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="card" aria-label="Study materials">
        <h2>Study materials</h2>
        <div className="eg-links">
          {g.links.map(([label, url, note], i) => (
            <a key={url} className={`btn ${i === 0 ? 'primary' : ''} eg-link`} href={url} target="_blank" rel="noopener noreferrer">
              <span aria-hidden="true">{i === 0 ? '📝' : '📘'}</span>
              <span className="eg-lt">{label}{note && <small>{note}</small>}</span>
            </a>
          ))}
        </div>
      </section>

      <p className="small mx-note">{g.source}</p>
    </div>
  )
}
