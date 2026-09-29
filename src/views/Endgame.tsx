import { useState } from 'react'
import { dateBn, dateLongBn, SUBJ_BN, TIER_BN, yearBn, qnBn } from '../data/bn'
import { MODEL_TESTS, YEARS } from '../data/catalog'
import { diffDays } from '../data/dhaka'
import { EXAM_DATE, REST_DATE } from '../data/plan'
import { K } from '../logic/keys'
import { revisionList, type RevisionItem } from '../logic/stats'
import { href } from '../router'
import { store, useField } from '../store/store'
import { useReader, useSchedule } from '../hooks'
import { Timer } from '../components/Timer'
import { FieldCheck, TierPill } from '../components/ui'
import { Accountability, RemindersCard } from './Habits'

const DEFAULT_EXAM = [
  'Admit card',
  'Pens (bring spares)',
  'Calculator: check the rules printed on your admit card / notice, and bring only what they allow',
  'Any other documents your admit card / notice lists',
  'Water and something light to eat',
  'Phone charged, alarm set',
  'Early night',
]
export function ExamChecklist() {
  const custom = useField<string[]>(K.examCustom, [])
  const travel = useField<string>(K.exam('travel'), '')
  const [txt, setTxt] = useState('')
  return (
    <div className="card">
      <h2>Exam checklist</h2>
      <div className="field">
        <label htmlFor="travel">Travel time to the centre (minutes) and when you'll leave</label>
        <input id="travel" className="input" value={travel} onChange={(e) => store.set(K.exam('travel'), e.target.value)} placeholder="e.g. 75 min, leave 6:30" />
      </div>
      <div className="tasks">
        {DEFAULT_EXAM.map((t, i) => <FieldCheck key={i} k={K.exam(`d${i}`)}>{t}</FieldCheck>)}
        {custom.map((t, i) => (
          <div key={i} className="row-flex" style={{ flexWrap: 'nowrap' }}>
            <div className="grow"><FieldCheck k={K.exam(`c${i}`)}>{t}</FieldCheck></div>
            <button className="btn sm" onClick={() => store.set(K.examCustom, custom.filter((_, j) => j !== i))} aria-label={`Remove ${t}`}>Remove</button>
          </div>
        ))}
      </div>
      <form className="row-flex" onSubmit={(e) => { e.preventDefault(); if (txt.trim()) { store.set(K.examCustom, [...custom, txt.trim()]); setTxt('') } }}>
        <input className="input grow" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Add your own item" aria-label="Add checklist item" />
        <button className="btn" type="submit">Add</button>
      </form>
    </div>
  )
}

const PAPERS = [...YEARS.map((y) => ({ id: y, label: `${yearBn(y)} প্রশ্নপত্র` })), ...MODEL_TESTS.map((m) => ({ id: m, label: yearBn(m) }))]
function PaperChecklist() {
  return (
    <div className="card">
      <h3>Papers checklist</h3>
      <p className="small">One full timed paper each morning, then fix every mistake. Tick a paper when you've sat it, and note your score.</p>
      <div className="grid2">
        {PAPERS.map((p) => <PaperRow key={p.id} id={p.id} label={p.label} />)}
      </div>
    </div>
  )
}
function PaperRow({ id, label }: { id: string; label: string }) {
  const score = useField<string>(K.paper(id) + ':score', '')
  return (
    <div className="row-flex" style={{ flexWrap: 'nowrap', justifyContent: 'space-between' }}>
      <div className="grow"><FieldCheck k={K.paper(id)}>{label}</FieldCheck></div>
      <input className="input" style={{ width: 90 }} value={score} onChange={(e) => store.set(K.paper(id) + ':score', e.target.value)} placeholder="Score" aria-label={`Score for ${label}`} />
    </div>
  )
}

function RevisionRow({ it }: { it: RevisionItem }) {
  const link =
    it.kind === 'question' ? href.chapter(it.chapter.id, it.id) : it.kind === 'chapter' ? href.chapter(it.chapter.id) : it.chapter ? href.chapter(it.chapter.id) : null
  return (
    <FieldCheck k={K.rev(it.kind + ':' + it.id)}>
      <span className="row-flex">
        {it.kind === 'chapter' && <span className="tag zero">confidence {it.confidence}/5</span>}
        {it.kind === 'question' && <span className={`tag ${it.status === 'wrong' ? 'zero' : ''}`}>{it.status}</span>}
        {it.kind === 'repeat' && <span className="tag mt">Repeat</span>}
        <TierPill tier={it.tier} />
      </span>
      <br />
      {it.kind === 'chapter' ? <b>{it.chapter.n}</b> : it.label}
      {it.kind === 'question' && <span className="small"> · {SUBJ_BN[it.chapter.subject]} · {it.chapter.n} · {yearBn(it.ref.split('|')[0])} প্রশ্ন {qnBn(it.ref.split('|')[1])}</span>}
      {it.kind === 'repeat' && <span className="small"> · {it.where}</span>}
      {link && <> <a href={link} onClick={(e) => e.stopPropagation()} className="small">Open</a></>}
    </FieldCheck>
  )
}

export function RevisionListCard() {
  const r = useReader()
  const list = revisionList(r)
  const tiers = ['T1', 'T2', 'T3', 'T4'] as const
  return (
    <div className="stack">
      <h2>Revision list</h2>
      <p className="small">{list.length} items: every question you marked wrong or revisit, every Repeats question, and every chapter with confidence ≤ 2. Sorted by tier.</p>
      {tiers.map((t) => {
        const items = list.filter((x) => x.tier === t)
        if (!items.length) return null
        return (
          <div key={t} className="card">
            <h3>{TIER_BN[t]} <span className="small">· {items.length}</span></h3>
            <div className="tasks">{items.map((it) => <RevisionRow key={it.kind + it.id} it={it} />)}</div>
          </div>
        )
      })}
    </div>
  )
}

export function EndgameView({ today }: { today: string }) {
  const minutes = useField<number>(K.exam('minutes'), 90)
  const daysLeft = diffDays(today, EXAM_DATE)
  const sched = useSchedule()

  if (today > EXAM_DATE)
    return (
      <div className="view">
        <div className="page-h"><h1>The exam is over</h1></div>
        <div className="banner info">Well done for getting through it. Your data stays here; see <a href={href.progress()}>Progress</a> for the full picture.</div>
      </div>
    )
  if (today === EXAM_DATE)
    return (
      <div className="view">
        <div className="page-h"><div className="eyebrow"><span className="eb-bn">{dateLongBn(today)}</span></div><h1>Today is the MIST exam</h1></div>
        <div className="card accent"><h2>You've done the work.</h2><p>Read each question fully, take the marks you can get first, and keep an eye on time.</p></div>
        <ExamChecklist />
      </div>
    )
  if (today === REST_DATE)
    return (
      <div className="view">
        <div className="page-h"><div className="eyebrow"><span className="eb-bn">{dateLongBn(today)}</span></div><h1>Rest day</h1></div>
        <div className="card accent">
          <h2>Pure mental rest.</h2>
          <p>No new problems, no re-solving. Sleep on time. The exam is tomorrow.</p>
        </div>
        <ExamChecklist />
      </div>
    )
  return (
    <div className="view">
      <div className="page-h">
        <div className="eyebrow">Endgame · <span className="eb-bn">{dateBn(today)}</span> · {daysLeft} days to the exam</div>
        <h1>Revision and model tests</h1>
        <p className="small">One full timed paper this morning, then fix every mistake. Re-solve the Repeats list.</p>
      </div>
      <div className="card accent">
        <h2>Timed model test</h2>
        <Timer id="model-test" minutes={minutes} onMinutes={(m) => store.set(K.exam('minutes'), m)} label="Pens down. Now mark it and fix every mistake." big />
      </div>
      <div className="grid2 habits">
        <RemindersCard />
        <Accountability sched={sched} />
      </div>
      <PaperChecklist />
      <RevisionListCard />
    </div>
  )
}
