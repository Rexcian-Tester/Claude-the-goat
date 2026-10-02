import { useEffect, useState } from 'react'
import { todayISO } from '../data/dhaka'
import { K, type LateStart } from '../logic/keys'
import * as P from '../logic/pomo'
import { useField, useStoreVersion } from '../store/store'
import { blockAt } from '../views/Routine'
import { actions, clock12, dhakaMinute, fmtDur, loggedMs, setConfig, targetMs, usePomo } from './engine'
import { pickQuote, QUOTES } from './quotes'
import { useReader, useSchedule, useToday } from '../hooks'
import { isEndgame, phaseOf } from '../logic/behind'
import { href } from '../router'
import { DayProgressBar } from '../views/day'
import { SubjectChip } from '../components/ui'
import { dayProgress, taskState } from '../logic/dayStatus'
import type { Row, Schedule } from '../logic/schedule'

/** re-render every `ms` (the clock, the countdown) */
export function useTick(ms = 1000) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    const vis = () => document.visibilityState === 'visible' && setNow(Date.now())
    document.addEventListener('visibilitychange', vis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [ms])
  return now
}

export const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`
}
const PHASE: Record<P.Phase, string> = { idle: 'Ready when you are', focus: 'Focus', ask: 'Session done', flow: 'Flow state', pickBreak: 'Flow finished', break: 'Break', ready: 'Break over' }

/** what the big number shows and how full the ring is */
export function timerView(s: P.PomoState, now: number) {
  if (s.phase === 'flow') return { big: mmss(P.elapsed(s, now)), frac: 1, sub: 'counting up · no limit' }
  if (s.phase === 'focus' || s.phase === 'break') return { big: mmss(P.remaining(s, now)), frac: s.len ? P.remaining(s, now) / s.len : 0, sub: `of ${mmss(s.len)}` }
  return { big: '00:00', frac: 0, sub: '' }
}

function Clock({ now, study }: { now: number; study: boolean }) {
  const t = new Date(now + 6 * 3600000)
  const h = t.getUTCHours()
  const min = dhakaMinute(now)
  const cur = blockAt(min)
  const left = (cur.to - min + 1440) % 1440
  const next = P.STUDY_BLOCKS.find((b) => b.from > min)
  return (
    <div className="sb-clock">
      <div className="sb-time" aria-label="Bangladesh time">
        {h % 12 || 12}:{String(t.getUTCMinutes()).padStart(2, '0')}<small>:{String(t.getUTCSeconds()).padStart(2, '0')}</small>
        <span>{h < 12 ? 'AM' : 'PM'}</span>
      </div>
      {study && (
        <div className="sb-now">
          <span className={`sb-kind ${cur.kind}`}>{cur.label}</span>
          <span className="small">{left >= 60 ? `${Math.floor(left / 60)}h ${left % 60}m` : `${left}m`} left{next && next.id !== cur.id ? ` · next ${next.label} at ${clock12(next.from)}` : ''}</span>
        </div>
      )}
    </div>
  )
}

function Timer({ now }: { now: number }) {
  const { s, c } = usePomo()
  const v = timerView(s, now)
  const R = 104
  const C = 2 * Math.PI * R
  const counting = s.phase === 'focus' || s.phase === 'flow' || s.phase === 'break'
  const paused = counting && !P.running(s)
  const brk = s.phase === 'break'
  const label = brk ? (s.breakKind === 'long' ? 'Long break' : s.breakKind === 'custom' ? 'Break' : 'Short break') : PHASE[s.phase]
  return (
    <div className={`focus-hero sb-hero ${brk ? 'brk' : ''} ${s.phase === 'flow' ? 'flow' : ''} ${paused ? 'paused' : ''}`}>
      <div className="fc-top">
        <span className="fc-q">{label}{s.mode === 'study' && s.block && (counting || s.phase === 'ask') && <span> · {P.studyBlock(s.block).label}</span>}</span>
        {paused && <span className="fc-paused">Paused</span>}
      </div>
      <div className="fc-dial">
        <svg className="fc-ring" viewBox="0 0 240 240" aria-hidden="true">
          <circle className="trk" cx="120" cy="120" r={R} />
          <circle className="val" cx="120" cy="120" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - v.frac)} />
        </svg>
        <div key={s.phase} className="fc-center">
          <span className="fc-spent" role="timer" aria-live="off">{counting ? v.big : mmss(c.focus * 60000)}</span>
          <span className="fc-sub">{counting ? v.sub : `${c.focus} min focus · ${c.short} min break`}</span>
        </div>
      </div>
      <div className="sb-dots" aria-label={`${s.streak} of ${c.every} sessions before the long break`}>
        {Array.from({ length: c.every }, (_, i) => <i key={i} className={i < s.streak ? 'on' : ''} />)}
        <span>{c.long}-min break after {c.every}</span>
      </div>
      {s.phase === 'idle' || s.phase === 'ready' ? (
        <button type="button" className="fc-done" onClick={actions.start}>{s.phase === 'ready' ? 'Start next session' : 'Start focus'}</button>
      ) : s.phase === 'ask' ? (
        <div className="fc-ctl two">
          <button type="button" className="fc-b" onClick={actions.takeBreak}>Start break</button>
          <button type="button" className="fc-b" onClick={actions.flow}>Flow state</button>
        </div>
      ) : s.phase === 'pickBreak' ? null : (
        <div className="fc-ctl">
          <button type="button" className="fc-b" onClick={paused ? actions.resume : actions.pause}>{paused ? 'Resume' : 'Pause'}</button>
          {brk ? (
            <button type="button" className="fc-b" onClick={actions.skipBreak}>Skip break</button>
          ) : (
            <button type="button" className="fc-b" onClick={actions.stop}>{s.phase === 'flow' ? 'Stop flow' : 'Stop'}</button>
          )}
          <button type="button" className="fc-b ghost" onClick={() => confirm('Reset the timer? Study time done so far still counts.') && actions.reset()}>Reset</button>
        </div>
      )}
    </div>
  )
}

function BlockRow({ id, date, live }: { id: P.StudyBlockId; date: string; live: number }) {
  const b = P.studyBlock(id)
  const done = loggedMs(date, id) + live
  const target = targetMs(id)
  const late = useField<LateStart | undefined>(K.late(date, id), undefined)
  const pct = Math.min(1, done / target)
  return (
    <div className={`sb-row ${pct >= 1 ? 'done' : ''}`}>
      <div className="sb-row-h">
        <span className="sb-row-l">
          <b>{b.label}{late && <span className="tag" title={late.reason}>{late.min} min late</span>}</b>
          <span className="small">{clock12(b.from)} – {clock12(b.to)}</span>
        </span>
        <span className="num">{fmtDur(done)} / {fmtDur(target)}{pct >= 1 && ' ✓'}</span>
      </div>
      <span className="bar"><i style={{ width: `${pct * 100}%` }} /></span>
    </div>
  )
}

function Settings() {
  const { c } = usePomo()
  const [raw, setRaw] = useState(() => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, String(v)])) as Record<keyof P.PomoConfig, string>)
  const field = (k: keyof P.PomoConfig, label: string, min: number, max: number) => (
    <div className="field">
      <label htmlFor={`pc-${k}`}>{label}</label>
      <input
        id={`pc-${k}`}
        className="input"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={raw[k]}
        onChange={(e) => {
          setRaw({ ...raw, [k]: e.target.value })
          const n = Math.round(Number(e.target.value))
          if (e.target.value !== '' && n >= min && n <= max) setConfig({ ...c, [k]: n })
        }}
      />
    </div>
  )
  return (
    <details className="panel">
      <summary>Timer settings</summary>
      <div className="panel-b stack">
        <div className="grid3 sb-set">
          {field('focus', 'Focus (min)', 1, 180)}
          {field('short', 'Short break (min)', 1, 60)}
          {field('long', 'Long break (min)', 1, 90)}
          {field('every', 'Long break after (sessions)', 1, 12)}
          {field('grace', 'Late after (min)', 0, 60)}
        </div>
        <p className="small">Targets with these settings: {P.STUDY_BLOCKS.map((b) => `${b.label} ${fmtDur(targetMs(b.id, c))}`).join(' · ')}. Changes apply from the next session.</p>
        <button type="button" className="btn sm" onClick={() => {
          setConfig(P.DEFAULT_CONFIG)
          setRaw(Object.fromEntries(Object.entries(P.DEFAULT_CONFIG).map(([k, v]) => [k, String(v)])) as Record<keyof P.PomoConfig, string>)
        }}>Back to 25 / 5 / 15</button>
      </div>
    </details>
  )
}

/** Just the day's chapters (subject + chapter + part) with how many of each one's micro-tasks are ticked. */
function TaskNames({ row, sched }: { row: Row; sched: Schedule }) {
  const r = useReader()
  const p = dayProgress(r, row, sched.rows)
  const inbound = p.tasks.filter((t) => t.date !== row.date)
  return (
    <>
      {row.isBuffer && <span className="badge buf" style={{ alignSelf: 'flex-start' }}>ধরা-পড়ার দিন</span>}
      <div className="sb-task-list">
        {row.items.map((item) => {
          const mine = p.tasks.filter((t) => t.item === item)
          const done = mine.filter((t) => taskState(r, t) === 'done').length
          const all = mine.length > 0 && done === mine.length
          const first = item.chapters[0]
          return (
            <a key={item.key} className={`sb-task ${all ? 'done' : ''}`} href={first ? href.chapter(first.id) : href.plan(row.date)}>
              <SubjectChip s={item.s} />
              <span className="sb-task-n">
                <b>{item.ch}{item.parts ? <span className="tag part-tag">Part {item.partNo}/{item.parts}</span> : null}</b>
                <small>{item.part}</small>
                {item.editNote && <small className="edit-note-s">📝 {item.editNote}</small>}
              </span>
              <span className="sb-task-st">{all ? '✓' : `${done}/${mine.length}`}</span>
            </a>
          )
        })}
      </div>
      {inbound.length > 0 && <p className="small">+ {inbound.length} task{inbound.length === 1 ? '' : 's'} moved here from earlier days</p>}
      <DayProgressBar row={row} rows={sched.rows} />
    </>
  )
}

/** Today's study day from the Plan, with the same tick boxes (ticks here and in Plan / Today are the same). */
function TodayTasks() {
  const today = useToday()
  const sched = useSchedule()
  const phase = phaseOf(today)
  const row = sched.byEff.get(today)
  return (
    <div className="card accent sb-tasks">
      <div className="card-h">
        <h2>Today's tasks</h2>
        <span className="small">
          {row ? <>Day {row.dayNo} · {row.phase} · </> : null}
          <a href={href.plan(today)}>Open in Plan</a>
        </span>
      </div>
      {isEndgame(today) || phase === 'after' ? (
        <p className="muted">The study plan is over: revision list and model tests. See <a href={href.today()}>Today</a>.</p>
      ) : phase === 'before' ? (
        <p className="muted">The plan hasn't started yet.</p>
      ) : !row ? (
        <p className="muted">No study day sits on today's date (the plan was shifted). Check the <a href={href.plan()}>Plan</a>.</p>
      ) : row.isFree ? (
        row.note ? <div className="free-note">✓ {row.note}</div> : <p className="muted">খালি দিন। আজ কিছু নির্ধারিত নেই।</p>
      ) : (
        <TaskNames row={row} sched={sched} />
      )}
    </div>
  )
}

export function StudyBlocks() {
  const now = useTick(1000)
  const { s, c } = usePomo()
  useStoreVersion()
  const date = todayISO(now)
  const study = s.mode === 'study'
  const live = (id: P.StudyBlockId) => (study && s.block === id ? P.unlogged(s, now) : 0)
  const total = P.STUDY_BLOCKS.reduce((n, b) => n + loggedMs(date, b.id) + live(b.id), 0)
  const target = P.STUDY_BLOCKS.reduce((n, b) => n + targetMs(b.id), 0)
  const frac = Math.min(1, total / target)
  // a new line every 10% of the day's target, so it changes as you go
  const q = pickQuote(QUOTES, Math.floor(frac * 10) + Number(date.slice(8)))
  const busy = s.phase === 'focus' || s.phase === 'flow' || s.phase === 'break'
  return (
    <div className="stack sb-stack">
      <div className="seg sb-mode slide" role="group" aria-label="Timer mode" style={{ ['--i' as string]: study ? 0 : 1, ['--n' as string]: 2 }}>
        <button type="button" aria-pressed={study} disabled={busy && !study} onClick={() => actions.setMode('study')}>Study Focus Pomodoro</button>
        <button type="button" aria-pressed={!study} disabled={busy && study} onClick={() => actions.setMode('normal')}>Normal Pomodoro</button>
      </div>
      <p key={s.mode} className="small sb-mode-h">
        {study ? 'Follows your Routine: time counts toward the study block you are in, late starts are logged and a block ticks itself in Routine when you hit its target.' : 'A plain 25 / 5 timer. Nothing is logged against your study blocks.'}
      </p>
      <Clock now={now} study={study} />
      <Timer now={now} />
      {study && (
        <div className="card">
          <div className="card-h">
            <h2>Today's study blocks</h2>
            <span className="num">{fmtDur(total)} / {fmtDur(target)}</span>
          </div>
          <span className="bar sb-total"><i style={{ width: `${frac * 100}%` }} /></span>
          {P.STUDY_BLOCKS.map((b) => <BlockRow key={b.id} id={b.id} date={date} live={live(b.id)} />)}
          <p className="small">Targets are the study time a block allows with {c.focus}-min sessions and the breaks between them.</p>
        </div>
      )}
      <blockquote className="sb-quote">“{q.text}” <cite>{q.by}</cite></blockquote>
      <TodayTasks />
      <Settings />
    </div>
  )
}
