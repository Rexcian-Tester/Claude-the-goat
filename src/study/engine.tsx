import { useEffect, useState, useSyncExternalStore } from 'react'
import { todayISO } from '../data/dhaka'
import { K, type LateStart } from '../logic/keys'
import * as P from '../logic/pomo'
import { studyBlock, type StudyBlockId } from '../logic/pomo'
import { store } from '../store/store'
import { askNotify, beep, notify, unlockAudio, useWakeLock } from '../components/alarm'
import { DONE_QUOTES, pickQuote, QUOTES } from './quotes'
import { blockAt, ROUTINE } from '../views/Routine'

/* One Study Blocks timer for the whole app. It lives outside any page, so it keeps running (and its pop-ups
 * appear) while you use the question timer or anything else. Timer state is per device (localStorage); the study
 * time it logs, late starts and Routine ticks sync like the rest of your progress. */

const LS = 'mist-pomo'
const LS_CFG = 'mist-pomo-config'
const LS_DAY = 'mist-pomo-day'
const read = <T,>(k: string, def: T): T => {
  try {
    const v = localStorage.getItem(k)
    return v ? { ...def, ...(JSON.parse(v) as T) } : def
  } catch {
    return def
  }
}
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

/** Bangladesh time of day, minutes after midnight (UTC+6, no daylight saving) */
export const dhakaMinute = (now = Date.now()) => Math.floor(((now + 6 * 3600000) % 86400000) / 60000)

/* ---------- store ---------- */
interface DayInfo {
  date: string
  /** non-study Routine blocks you agreed to study into today */
  ok: string[]
  /** study blocks whose target was celebrated / end was announced / start was announced today */
  celebrated: string[]
  ended: string[]
  started: string[]
}
type Dialog =
  | { type: 'collide'; block: (typeof ROUTINE)[number] }
  | { type: 'late'; block: StudyBlockId; min: number }
  | { type: 'celebrate'; block: StudyBlockId; quote: number }
  | { type: 'blockEnd'; block: StudyBlockId }
  | null

let state: P.PomoState = read(LS, P.idle())
let config: P.PomoConfig = read(LS_CFG, P.DEFAULT_CONFIG)
let day: DayInfo = read(LS_DAY, { date: '', ok: [], celebrated: [], ended: [], started: [] })
let dialog: Dialog = null
let pendingStart = false
let version = 0
const ls = new Set<() => void>()
const emit = () => {
  version++
  ls.forEach((l) => l())
}
const subscribe = (fn: () => void) => (ls.add(fn), () => ls.delete(fn))
export const usePomo = () => {
  useSyncExternalStore(subscribe, () => version)
  return { s: state, c: config, dialog }
}
export const getPomo = () => state

function setState(n: P.PomoState) {
  state = n
  write(LS, n)
  emit()
}
export function setConfig(c: P.PomoConfig) {
  config = c
  write(LS_CFG, c)
  emit()
}
function today(): DayInfo {
  const d = todayISO()
  if (day.date !== d) day = { date: d, ok: [], celebrated: [], ended: [], started: [] }
  return day
}
function saveDay() {
  write(LS_DAY, day)
}
const setDialog = (d: Dialog) => {
  dialog = d
  emit()
}

/* ---------- study time per block (synced) ---------- */
export const targetMs = (id: StudyBlockId, c = config) => P.effectiveTarget(P.blockMinutes(studyBlock(id)), c) * 60000
export const loggedMs = (date: string, id: StudyBlockId) => store.get<number>(K.focusMs(date, id)) ?? 0
function logStudy(ms: number) {
  if (ms <= 0 || state.mode !== 'study' || !state.block) return
  const date = todayISO()
  const id = state.block
  const total = loggedMs(date, id) + ms
  store.set(K.focusMs(date, id), Math.round(total))
  const d = today()
  if (total >= targetMs(id) && !d.celebrated.includes(id)) {
    d.celebrated.push(id)
    saveDay()
    store.set(K.routine(date, id), true) // tick the block in Routine
    beep(2)
    notify(`${studyBlock(id).label} complete`, 'Target reached. Well done.')
    setDialog({ type: 'celebrate', block: id, quote: Math.floor(Math.random() * 1e6) })
  }
}

/** is a question-timer session running right now (it lives in localStorage, see Focus.tsx) */
function questionRunning() {
  try {
    const q = JSON.parse(localStorage.getItem('mist-focus') ?? 'null') as { runFrom: number | null; done: boolean } | null
    return !!q && q.runFrom !== null && !q.done
  } catch {
    return false
  }
}

/* ---------- actions (called from the UI) ---------- */
export const actions = {
  setMode(mode: P.PomoState['mode']) {
    if (state.phase === 'focus' || state.phase === 'flow' || state.phase === 'break') return
    setState({ ...P.idle(mode) })
  },
  /** Start a study session, checking first for a collision with a non-study block and for a late start. */
  start() {
    unlockAudio()
    askNotify()
    const now = Date.now()
    const min = dhakaMinute(now)
    if (state.mode === 'study') {
      const d = today()
      const coll = P.collidingBlock(min)
      if (coll && !d.ok.includes(coll.id)) {
        pendingStart = true
        return setDialog({ type: 'collide', block: coll })
      }
      const block = P.attributeBlock(min)
      const late = P.minutesLate(block, min, config.grace)
      if (late && loggedMs(d.date, block) === 0 && !store.get(K.late(d.date, block))) {
        pendingStart = true
        return setDialog({ type: 'late', block, min: late })
      }
      return setState(P.startFocus(state, now, config, block))
    }
    setState(P.startFocus(state, now, config, null))
  },
  agreeCollide() {
    const d = today()
    if (dialog?.type === 'collide') d.ok.push(dialog.block.id)
    saveDay()
    setDialog(null)
    if (pendingStart) (pendingStart = false), actions.start()
  },
  cancel() {
    pendingStart = false
    setDialog(null)
  },
  submitLate(reason: string) {
    if (dialog?.type !== 'late') return
    const rec: LateStart = { min: dialog.min, reason: reason.trim() || 'No reason given', at: Date.now() }
    store.set(K.late(today().date, dialog.block), rec)
    const block = dialog.block
    setDialog(null)
    pendingStart = false
    setState(P.startFocus(state, Date.now(), config, block))
  },
  closeDialog: () => setDialog(null),
  pause: () => setState(P.pause(state, Date.now())),
  resume: () => setState(P.resume(state, Date.now())),
  takeBreak: () => setState(P.startBreak(state, Date.now(), config)),
  flow: () => setState(P.enterFlow(state, Date.now())),
  stopFlow() {
    const r = P.stopFlow(state, Date.now(), config)
    logStudy(r.studied)
    setState(r.state)
  },
  breakFor(minutes: number) {
    setState(P.startBreak(state, Date.now(), config, Math.max(1, Math.min(120, Math.round(minutes)))))
  },
  skipBreak: () => setState({ ...P.endBreak(state), len: 0 }),
  /** end the current study session early; the time done still counts */
  stop() {
    if (state.phase === 'flow') return actions.stopFlow()
    const r = P.stopFocus(state, Date.now())
    logStudy(r.studied)
    setState({ ...r.state, len: 0 }) // len 0: no "break over" pop-up for a session you stopped yourself
  },
  reset() {
    if (state.phase === 'focus') logStudy(P.elapsed(state, Date.now()))
    if (state.phase === 'flow') logStudy(P.unlogged(state, Date.now()))
    setState(P.idle(state.mode))
  },
}

/* ---------- the clock: phase ends, block start/end announcements ---------- */
function tick() {
  const now = Date.now()
  const due = P.dueAt(state)
  if (due !== null && now >= due) {
    if (state.phase === 'focus') {
      const auto = questionRunning()
      const r = P.endFocus(state, due, config, auto)
      logStudy(r.studied)
      setState(r.state)
      beep(auto ? 1 : 2)
      notify(auto ? 'Flow state on' : 'Session done', auto ? 'You are solving questions, so the study timer keeps counting.' : 'Take your break, or keep going in flow state.')
    } else if (state.phase === 'break') {
      setState(P.endBreak(state))
      beep(3)
      notify('Break over', 'Back to it: start the next session.')
    }
  }
  // block start reminders and block-end summaries (study mode only)
  if (state.mode !== 'study') return
  const d = today()
  const min = dhakaMinute(now)
  let changed = false
  for (const b of P.STUDY_BLOCKS) {
    if (min >= b.from && min < b.from + 5 && !d.started.includes(b.id)) {
      d.started.push(b.id)
      changed = true
      notify(`${b.label} starts now`, 'Open MIST Prep and start your first session.')
    }
    // the block is over: say so once the session running into it has finished (it runs its natural course)
    if (min >= b.to && min < b.to + 60 && !d.ended.includes(b.id) && !dialog && !P.isStudy(state) && loggedMs(d.date, b.id) > 0) {
      d.ended.push(b.id)
      changed = true
      if (!d.celebrated.includes(b.id)) setDialog({ type: 'blockEnd', block: b.id })
    }
  }
  if (changed) saveDay()
}

/* ---------- pop-ups, mounted once in App ---------- */
const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`
}
export const fmtDur = (ms: number) => {
  const m = Math.round(ms / 60000)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}
export const clock12 = (min: number) => {
  const h = Math.floor(min / 60) % 24
  return `${h % 12 || 12}:${String(min % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
/** what comes after a study block ends: the routine block now, and the next study block */
export function afterBlock(id: StudyBlockId) {
  const b = studyBlock(id)
  const nowBlock = blockAt(b.to)
  const next = P.STUDY_BLOCKS.find((x) => x.from >= b.to)
  return { nowBlock, next }
}

function Dlg({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="dlg-scrim" role="presentation">
      <div className="dlg" role="alertdialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>
  )
}

const REASONS = ['Overslept', 'Phone / social media', 'Felt tired or unwell', 'Family / home', 'Got distracted']

function LateForm({ block, min }: { block: StudyBlockId; min: number }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  return (
    <Dlg label="Late start">
      <div className="dlg-ic" aria-hidden="true">⏱️</div>
      <p className="dlg-t">You're starting {studyBlock(block).label} {min} min late.</p>
      <p className="dlg-s">What happened? It's saved under Progress → Late starts.</p>
      <div className="late-chips">
        {REASONS.map((r) => <button key={r} type="button" className="fc-b" aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</button>)}
      </div>
      <input className="input late-in" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else (optional)" maxLength={200} />
      <button type="button" className="fc-done" disabled={!reason && !note.trim()} onClick={() => actions.submitLate([reason, note.trim()].filter(Boolean).join(': '))}>Save and start</button>
      <button type="button" className="fc-b" onClick={() => actions.submitLate('')}>Start without a reason</button>
      <button type="button" className="fc-b ghost" onClick={actions.cancel}>Cancel</button>
    </Dlg>
  )
}

function PickBreak({ total }: { total: number }) {
  const [m, setM] = useState(String(state.breakKind === 'long' ? config.long : config.short))
  return (
    <Dlg label="Flow state finished">
      <div className="dlg-ic" aria-hidden="true">🌊</div>
      <p className="dlg-t">Flow session: {mmss(total)} of focus.</p>
      <p className="dlg-s">How long a break do you want?</p>
      <div className="late-chips">
        {[5, 10, 15, 20, 30].map((x) => <button key={x} type="button" className="fc-b" aria-pressed={m === String(x)} onClick={() => setM(String(x))}>{x} min</button>)}
      </div>
      <input className="input late-in" type="number" inputMode="numeric" min={1} max={120} value={m} onChange={(e) => setM(e.target.value)} aria-label="Break minutes" />
      <button type="button" className="fc-done" disabled={!(Number(m) >= 1)} onClick={() => actions.breakFor(Number(m))}>Start {Number(m) || 0}-min break</button>
      <button type="button" className="fc-b ghost" onClick={actions.skipBreak}>Skip the break</button>
    </Dlg>
  )
}

export function StudyEngineHost() {
  const { s, dialog: dlg } = usePomo()
  useEffect(() => {
    tick()
    const id = setInterval(tick, 1000)
    const vis = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', vis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [])
  useWakeLock(P.running(s))

  if (dlg?.type === 'collide')
    return (
      <Dlg label="Study into another block?">
        <div className="dlg-ic" aria-hidden="true">⚠️</div>
        <p className="dlg-t">It's {dlg.block.label} time ({clock12(dlg.block.from)} – {clock12(dlg.block.to)}).</p>
        <p className="dlg-s">Studying now eats into {dlg.block.label}. Are you willing to study more?</p>
        <button type="button" className="fc-done" onClick={actions.agreeCollide}>Yes, keep studying</button>
        <button type="button" className="fc-b ghost" onClick={actions.cancel}>No</button>
      </Dlg>
    )
  if (dlg?.type === 'late') return <LateForm block={dlg.block} min={dlg.min} />
  if (dlg?.type === 'celebrate') {
    const q = pickQuote(DONE_QUOTES, dlg.quote)
    const { nowBlock, next } = afterBlock(dlg.block)
    return (
      <Dlg label="Block complete">
        <div className="dlg-ic" aria-hidden="true">🏆</div>
        <p className="dlg-t">{studyBlock(dlg.block).label} complete!</p>
        <p className="dlg-s">You hit your {fmtDur(targetMs(dlg.block))} target. Ticked in Routine.</p>
        <blockquote className="dlg-q">“{q.text}” <cite>{q.by}</cite></blockquote>
        {next && <p className="dlg-s">Next: {nowBlock.kind === 'study' ? `${nowBlock.label} starts now` : `${nowBlock.label} time`}. {next.id !== nowBlock.id && `See you at ${clock12(next.from)} for ${next.label}.`}</p>}
        <button type="button" className="fc-done" onClick={actions.closeDialog}>Keep going</button>
      </Dlg>
    )
  }
  if (dlg?.type === 'blockEnd') {
    const { nowBlock, next } = afterBlock(dlg.block)
    const done = loggedMs(todayISO(), dlg.block)
    return (
      <Dlg label="Block ended">
        <div className="dlg-ic" aria-hidden="true">🔔</div>
        <p className="dlg-t">{studyBlock(dlg.block).label} is over.</p>
        <p className="dlg-s">You studied {fmtDur(done)} of {fmtDur(targetMs(dlg.block))}.</p>
        <p className="dlg-s">{nowBlock.kind === 'study' ? `${nowBlock.label} starts now.` : `Now it's your ${nowBlock.label.toLowerCase()} time.`}{next && next.id !== nowBlock.id ? ` See you at ${clock12(next.from)} for ${next.label}.` : ''}</p>
        <button type="button" className="fc-done" onClick={actions.closeDialog}>OK</button>
      </Dlg>
    )
  }
  if (s.phase === 'ask') {
    const q = pickQuote(QUOTES, s.startedAt)
    return (
      <Dlg label="Session done">
        <div className="dlg-ic" aria-hidden="true">✅</div>
        <p className="dlg-t">Session done: {mmss(s.len)} of focus.</p>
        <blockquote className="dlg-q">“{q.text}” <cite>{q.by}</cite></blockquote>
        <button type="button" className="fc-done" autoFocus onClick={actions.takeBreak}>Start {s.breakKind === 'long' ? config.long : config.short}-min break</button>
        <button type="button" className="fc-b" onClick={actions.flow}>I am in the flow state</button>
      </Dlg>
    )
  }
  if (s.phase === 'pickBreak') return <PickBreak total={s.acc} />
  if (s.phase === 'ready' && s.len > 0)
    return (
      <Dlg label="Break over">
        <div className="dlg-ic" aria-hidden="true">⏰</div>
        <p className="dlg-t">Break over. Back to it.</p>
        <button type="button" className="fc-done" autoFocus onClick={actions.start}>Start next session</button>
        <button type="button" className="fc-b ghost" onClick={() => setState({ ...state, len: 0 })}>Not now</button>
      </Dlg>
    )
  return null
}
