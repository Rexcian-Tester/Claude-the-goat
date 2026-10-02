import { useEffect, useState } from 'react'
import { bn, dateBn, dateEn, dayRangeBn, qnBn, SUBJ_BN, yearBn } from '../data/bn'
import type { PlanItem } from '../data/plan'
import { studyPlan } from '../data/load'
import { addDays } from '../data/dhaka'
import { dayProgress, movedTo, ownTasks, taskState, type TaskRef } from '../logic/dayStatus'
import { K } from '../logic/keys'
import { nextCatchUp, overdueTasks } from '../logic/overdue'
import type { Row, Schedule } from '../logic/schedule'
import { itemTier } from '../logic/stats'
import { href } from '../router'
import { store, useField } from '../store/store'
import { useReader, useToday } from '../hooks'
import { TopicControls } from '../planner/PlanTools'
import { Check, FieldCheck, Panel, QuestionRow, Rating, SubjectChip, TierPill } from '../components/ui'
import type { Chapter } from '../data/types'

export function KindBadges({ item }: { item: PlanItem }) {
  return (
    <>
      {item.k === 'cls' && <span className="badge cls">ক্লাস দিন</span>}
      {item.k === 'half' && <span className="badge half">আধা দিন</span>}
      {item.k === 'buf' && <span className="badge buf">ধরা-পড়ার দিন</span>}
    </>
  )
}

export function ItemHeader({ item }: { item: PlanItem }) {
  const tier = itemTier(item)
  const [first, ...more] = item.chapters
  return (
    <div className="item">
      <div className="top">
        <SubjectChip s={item.s} />
        {first ? <a className="ch" href={href.chapter(first.id)}>{item.ch}</a> : <span className="ch">{item.ch}</span>}
        {item.parts && <span className="tag part-tag">Part {item.partNo}/{item.parts}</span>}
      </div>
      <div className="meta">
        {tier && <TierPill tier={tier} />}
        <span className="part">{item.part}</span>
        <KindBadges item={item} />
      </div>
      {more.length > 0 && (
        <div className="small">
          আরও: {more.map((c, i) => <span key={c.id}>{i > 0 && ', '}<a href={href.chapter(c.id)}>{SUBJ_BN[c.subject]} · {c.n}</a></span>)}
        </div>
      )}
      {item.m && <div className="note">{item.m}</div>}
      {item.editNote && <div className="edit-note"><span aria-hidden="true">📝</span> {item.editNote}</div>}
    </div>
  )
}

export function TaskLine({ t, origin }: { t: TaskRef; origin?: boolean }) {
  const r = useReader()
  const key = t.tk
  const checked = useField<boolean>(key, false)
  const state = taskState(r, t)
  const to = movedTo(r, t)
  return (
    <div>
      <Check checked={checked} onChange={(v) => store.set(key, v)}>
        <span className="bn" style={{ fontFamily: 'var(--body)' }}>{t.text}</span>
        {origin && <span className="small"> · {dateBn(t.date)} থেকে</span>}
        {state === 'moved' && to && <span className="tag"> {dateBn(to)}-এ সরানো হয়েছে</span>}
        {state === 'cleared' && <span className="tag"> বাদ দেওয়া হয়েছে</span>}
      </Check>
      {(state === 'moved' || state === 'cleared') && !checked && (
        <button className="btn sm" style={{ marginLeft: 40 }} onClick={() => store.set(t.mk, '')}>Undo</button>
      )}
    </div>
  )
}

/** Own tasks for one plan item */
export function ItemTasks({ row, item }: { row: Row; item: PlanItem }) {
  return (
    <div className="tasks">
      {ownTasks(row).filter((t) => t.item === item).map((t) => <TaskLine key={t.key} t={t} />)}
    </div>
  )
}

export function DayProgressBar({ row, rows }: { row: Row; rows: Row[] }) {
  const r = useReader()
  const p = dayProgress(r, row, rows)
  return (
    <div className="meter">
      <div className="mh">
        <span>{p.ticked}/{p.total} micro-tasks</span>
        <span className={`status ${p.complete ? 'done' : p.status === 'partial' ? 'partial' : ''}`}>{p.complete ? (p.manual && p.ticked < p.total ? 'Done (marked)' : 'Done') : p.status === 'partial' ? 'In progress' : 'Not started'}</span>
      </div>
      <span className="bar"><i style={{ width: `${p.ratio * 100}%` }} /></span>
    </div>
  )
}

export function LeftNote({ date }: { date: string }) {
  const k = K.dayLeft(date)
  const v = useField<string>(k, '')
  return (
    <div className="field">
      <label htmlFor={`left-${date}`}>What's left — anything unfinished</label>
      <textarea id={`left-${date}`} className="input" rows={2} value={v} placeholder="e.g. Q7 of the chapter-end questions, second half of the topics" onChange={(e) => store.set(k, e.target.value)} />
    </div>
  )
}

function NumField({ k, label, min, max, step }: { k: string; label: string; min: number; max: number; step: number }) {
  const stored = useField<number | null>(k, null)
  const [txt, setTxt] = useState(stored === null ? '' : String(stored))
  useEffect(() => {
    setTxt((cur) => (stored === null ? (cur === '' ? '' : cur) : Number(cur) === stored ? cur : String(stored)))
  }, [stored])
  return (
    <div className="field">
      <label htmlFor={k}>{label}</label>
      <input id={k} className="input" type="number" inputMode="decimal" min={min} max={max} step={step} value={txt} onChange={(e) => {
        setTxt(e.target.value)
        const n = parseFloat(e.target.value)
        store.set(k, Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null)
      }} />
    </div>
  )
}
function TextField({ k, label }: { k: string; label: string }) {
  const v = useField<string>(k, '')
  return (
    <div className="field">
      <label htmlFor={k}>{label}</label>
      <input id={k} className="input" value={v} onChange={(e) => store.set(k, e.target.value)} maxLength={300} />
    </div>
  )
}
export function Reflection({ date }: { date: string }) {
  const focus = useField<number | undefined>(K.refl(date, 'focus'), undefined)
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="grid2">
        <NumField k={K.refl(date, 'hours')} label="Hours studied" min={0} max={24} step={0.5} />
        <div className="field">
          <span className="label" id={`focus-${date}`}>Focus (1 = scattered, 5 = locked in)</span>
          <Rating value={focus} onChange={(n) => store.set(K.refl(date, 'focus'), n ?? null)} label="Focus rating" />
        </div>
      </div>
      <TextField k={K.refl(date, 'well')} label="What went well" />
      <TextField k={K.refl(date, 'blocked')} label="What blocked me" />
      <TextField k={K.refl(date, 'first')} label="Tomorrow's first move" />
    </div>
  )
}

/** Real MIST questions for a chapter, to solve at the end of its last scheduled day. */
export function ChapterEnd({ chapter }: { chapter: Chapter }) {
  const all = chapter.topics.flatMap((t) => t.subs.flatMap((s) => s.qs))
  const real = all.filter((q) => !q.m)
  const mt = all.filter((q) => q.m)
  return (
    <div className="card accent">
      <div className="card-h">
        <h3>Chapter end · solve the real MIST questions</h3>
        <a className="chip-s" href={href.chapter(chapter.id)}>{chapter.n}</a>
      </div>
      {real.length === 0 ? (
        <div className="empty">MIST has never asked a question from this chapter in the analysed papers. Work the textbook examples instead.</div>
      ) : (
        <div>{real.map((q) => <QuestionRow key={q.id} q={q} />)}</div>
      )}
      {mt.length > 0 && (
        <Panel title={`Model-test questions (${bn(mt.length)})`}>
          <div>{mt.map((q) => <QuestionRow key={q.id} q={q} />)}</div>
        </Panel>
      )}
    </div>
  )
}

export function chaptersEndingOn(row: Row, sched: Schedule): Chapter[] {
  const out: Chapter[] = []
  for (const it of row.items)
    for (const c of it.chapters) {
      const s = sched.slots.get(c.id) ?? []
      if (s.length && s[s.length - 1].row.date === row.date && !out.includes(c)) out.push(c)
    }
  return out
}

/** Full day content used by Today and by the Plan day sheet. */
/** A study day's topics and micro-tasks (plus tasks moved in from earlier days) with its progress bar. */
export function DayTasks({ row, sched }: { row: Row; sched: Schedule }) {
  const r = useReader()
  const today = useToday()
  const p = dayProgress(r, row, sched.rows)
  const inbound = p.tasks.filter((t) => t.date !== row.date)
  return (
    <>
      {row.items.map((item) => (
        <div key={item.key} className="stack" style={{ gap: 6 }}>
          <ItemHeader item={item} />
          {item.k !== 'buf' && <TopicControls row={row} item={item} sched={sched} today={today} />}
          <ItemTasks row={row} item={item} />
        </div>
      ))}
      {inbound.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <h3>Moved here from earlier days</h3>
          <div className="tasks">{inbound.map((t) => <TaskLine key={t.key} t={t} origin />)}</div>
        </div>
      )}
      <DayProgressBar row={row} rows={sched.rows} />
    </>
  )
}

export function DayBody({ row, sched, today }: { row: Row; sched: Schedule; today: string }) {
  if (row.isFree)
    return (
      <div className="stack">
        {row.note ? <div className="free-note">✓ {row.note}</div> : <p className="muted">খালি দিন। এই দিনের কাজ অন্য দিনে সরানো হয়েছে, আজ কিছু নির্ধারিত নেই।</p>}
        {row.eff && row.eff <= today && (
          <div className="card">
            <h3>End-of-day reflection · 30 seconds</h3>
            <Reflection date={row.date} />
          </div>
        )}
      </div>
    )
  const dayDone = K.dayDone(row.date)
  return (
    <div className="stack">
      <DayTasks row={row} sched={sched} />
      <FieldCheck k={dayDone}>Mark this day done (even if some micro-tasks are unticked)</FieldCheck>
      {chaptersEndingOn(row, sched).map((c) => <ChapterEnd key={c.id} chapter={c} />)}
      <LeftNote date={row.date} />
      {row.eff && row.eff <= today && (
        <div className="card">
          <h3>End-of-day reflection · 30 seconds</h3>
          <Reflection date={row.date} />
        </div>
      )}
    </div>
  )
}

export function OverdueList({ sched, today }: { sched: Schedule; today: string }) {
  const r = useReader()
  const list = overdueTasks(r, sched.rows, today)
  const catchUp = nextCatchUp(sched.rows, today)
  if (!list.length) return null
  const byDate = new Map<string, TaskRef[]>()
  for (const t of list) byDate.set(t.date, [...(byDate.get(t.date) ?? []), t])
  const move = (t: TaskRef) => catchUp && store.set(t.mk, catchUp.eff!)
  const clear = (t: TaskRef) => store.set(t.mk, 'cleared')
  return (
    <div className="card" id="overdue" style={{ borderColor: 'var(--warn)' }}>
      <div className="card-h">
        <h3 style={{ color: 'var(--warn)' }}>Overdue · {list.length} unfinished</h3>
        <span className="small">{catchUp ? `Next catch-up day: ${dateBn(catchUp.eff!)}` : 'No catch-up day left. Consider shifting the plan.'}</span>
      </div>
      {[...byDate.entries()].map(([date, tasks]) => (
        <div key={date} className="stack" style={{ gap: 2 }}>
          <div className="row-flex" style={{ justifyContent: 'space-between' }}>
            <div className="small"><b>{dateBn(date)}</b> · {tasks[0].item.ch} <span className="muted">({dateEn(date)})</span></div>
            <span className="row-flex">
              <button className="btn sm" disabled={!catchUp} onClick={() => tasks.forEach(move)}>Move all{catchUp ? ` to ${dateBn(catchUp.eff!)}` : ''}</button>
              <button className="btn sm" onClick={() => confirm(`Clear all ${tasks.length} unfinished tasks from ${dateEn(date)}?`) && tasks.forEach(clear)}>Clear all</button>
            </span>
          </div>
          {tasks.map((t) => (
            <div key={t.key} className="task-row">
              <div className="grow"><TaskLine t={t} /></div>
              <span className="row-flex" style={{ flexWrap: 'nowrap' }}>
                <button className="btn sm" disabled={!catchUp} onClick={() => move(t)} aria-label={`Move to catch-up day: ${t.text}`}>Move</button>
                <button className="btn sm" onClick={() => clear(t)} aria-label={`Clear: ${t.text}`}>Clear</button>
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** One-line pointer near the top of Today so overdue work is never out of sight. */
export function OverdueJump({ sched, today }: { sched: Schedule; today: string }) {
  const r = useReader()
  const n = overdueTasks(r, sched.rows, today).length
  if (!n) return null
  return (
    <a className="banner warn" style={{ textDecoration: 'none', color: 'inherit' }} href="#overdue" onClick={(e) => { e.preventDefault(); document.getElementById('overdue')?.scrollIntoView({ block: 'start' }) }}>
      <span><b>{n} unfinished micro-task{n === 1 ? '' : 's'}</b> from earlier days. Jump to Overdue ↓</span>
    </a>
  )
}

export function DayMini({ row }: { row: Row | undefined }) {
  if (!row) return <p className="muted">Nothing scheduled.</p>
  return (
    <div className="stack" style={{ gap: 8 }}>
      {row.items.map((it) => <ItemHeader key={it.key} item={it} />)}
    </div>
  )
}

export function Methods() {
  return (
    <>
      <Panel title="How every study day runs">
        <ol className="plain method">{studyPlan.meta.dailyMethod.map((m, i) => <li key={i}>{m}</li>)}</ol>
      </Panel>
      <Panel title="If you fall behind">
        <ol className="plain rules">{studyPlan.meta.ifBehind.map((m, i) => <li key={i}>{m}</li>)}</ol>
      </Panel>
    </>
  )
}
export const rangeOf = (nos: number[]) => dayRangeBn(nos)
export { addDays, yearBn, qnBn }
