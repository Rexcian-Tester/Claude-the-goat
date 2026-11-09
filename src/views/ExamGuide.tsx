import { findArtifact } from '../data/artifacts'
import { dateEn } from '../data/bn'
import { diffDays, weekdayIndex } from '../data/dhaka'
import { useState } from 'react'
import { examBySlug, setDateOf, setExamDate, time12 } from '../data/exams'
import type { Subject } from '../data/types'
import { useToday } from '../hooks'
import { href, useRoute } from '../router'
import { useStoreVersion } from '../store/store'

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SUBJ: Record<string, Subject> = { Physics: 'Phy', Chemistry: 'Chem', Math: 'Math' }
const left = (n: number) => (n > 1 ? `${n} days left` : n === 1 ? 'Tomorrow' : n === 0 ? 'Today' : 'Done')

/** One university's exam page (#/exam/mist | sust | cu): pattern, marks, what to study, tips and its study artifacts. */
export function ExamGuideView() {
  const route = useRoute()
  const today = useToday()
  useStoreVersion()
  const found = examBySlug(route.param)
  if (!found) return <div className="empty">No guide for this exam. <a href={href.today()}>Back to Today</a></div>
  const { exam: e, guide: g } = found
  const n = e.date ? diffDays(today, e.date) : null
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
          {e.date ? (
            <>
              <span className="small">{WD[weekdayIndex(e.date)]} {dateEn(e.date)} {e.date.slice(0, 4)} · {time12(e.time ?? '')}</span>
              <span className="eg-left num">{left(n!)}</span>
            </>
          ) : (
            <span className="small">{'when' in e ? e.when : 'Date not announced'}</span>
          )}
        </div>
        <p className="small eg-kind">{g.kind}</p>
      </div>

      {(e.date === null || ('dateSet' in e && e.dateSet)) && <ExamDateCard key={JSON.stringify(setDateOf(e.tag) ?? null)} tag={e.tag} name={e.name} />}

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

/** Set the announced date of an exam that has none in exams.json (IUT). Synced, so every device shows it. */
function ExamDateCard({ tag, name }: { tag: string; name: string }) {
  const cur = setDateOf(tag)
  const [date, setDate] = useState(cur?.date ?? '')
  const [time, setTime] = useState(cur?.time ?? '')
  const changed = date !== (cur?.date ?? '') || time !== (cur?.time ?? '')
  return (
    <section className="card" aria-label={`${name} exam date`}>
      <h2>Exam date</h2>
      <p className="small">
        {cur ? `Set: ${dateEn(cur.date)} ${cur.date.slice(0, 4)} · ${time12(cur.time)}. It shows in My exams and on the Plan on every synced device.` : `Not announced yet. When the ${name} circular is out, enter the date here: it syncs to your other devices, counts down in My exams and gets a tag on the Plan.`}
      </p>
      <div className="eg-date">
        <label>Date<input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} /></label>
        <label>Time (optional)<input type="time" value={time} onChange={(ev) => setTime(ev.target.value)} /></label>
        <button type="button" className="btn primary" disabled={!date || !changed} onClick={() => setExamDate(tag, { date, time })}>Save date</button>
        {cur && (
          <button type="button" className="btn" onClick={() => { setExamDate(tag, null); setDate(''); setTime('') }}>Clear</button>
        )}
      </div>
    </section>
  )
}
