// Focus (question-by-question) timer. Pure state + wall-clock maths, so it stays exact when the tab is
// throttled or closed: everything is derived from "active" milliseconds (time not paused).

export interface FocusConfig {
  totalMin: number
  cycleMin: number
  startQ: number
}
export interface Lap {
  q: number
  ms: number
}
export interface FocusSession {
  totalMs: number
  cycleMs: number
  startQ: number
  count: number
  /** active ms banked before the current run */
  acc: number
  /** wall clock when the current run began; null while paused or finished */
  runFrom: number | null
  /** active ms at which the current question started */
  qFrom: number
  /** the "time is up" prompt has fired for the current question */
  alerted: boolean
  laps: Lap[]
  done: boolean
  startedAt: number
}

export function plan(c: FocusConfig) {
  const totalMs = Math.round(Math.max(1, c.totalMin) * 60000)
  const cycleMs = Math.round(Math.max(0.1, c.cycleMin) * 60000)
  const startQ = Math.max(1, Math.floor(c.startQ) || 1)
  const count = Math.max(1, Math.ceil(totalMs / cycleMs))
  return { totalMs, cycleMs, startQ, count, lastQ: startQ + count - 1 }
}

export function start(c: FocusConfig, now: number): FocusSession {
  const p = plan(c)
  return { totalMs: p.totalMs, cycleMs: p.cycleMs, startQ: p.startQ, count: p.count, acc: 0, runFrom: now, qFrom: 0, alerted: false, laps: [], done: false, startedAt: now }
}

export const active = (s: FocusSession, now: number) => s.acc + (s.runFrom === null ? 0 : Math.max(0, now - s.runFrom))
export const running = (s: FocusSession) => s.runFrom !== null
export const currentQ = (s: FocusSession) => s.startQ + Math.min(s.laps.length, s.count - 1)

export function view(s: FocusSession, now: number) {
  const a = active(s, now)
  const spent = a - s.qFrom
  return {
    elapsed: a,
    remaining: Math.max(0, s.totalMs - a),
    spent,
    cycleLeft: Math.max(0, s.cycleMs - spent),
    overtime: spent >= s.cycleMs,
    /** prompt due for this question and not shown yet */
    due: !s.done && !s.alerted && spent >= s.cycleMs,
    completed: s.laps.length,
  }
}

export function pause(s: FocusSession, now: number): FocusSession {
  return s.runFrom === null ? s : { ...s, acc: active(s, now), runFrom: null }
}
export function resume(s: FocusSession, now: number): FocusSession {
  return s.runFrom !== null || s.done ? s : { ...s, runFrom: now }
}
export const markAlerted = (s: FocusSession): FocusSession => ({ ...s, alerted: true })

/** Log the current question and move on; the last one ends the session. */
export function next(s: FocusSession, now: number): FocusSession {
  if (s.done) return s
  const a = active(s, now)
  const laps = [...s.laps, { q: s.startQ + s.laps.length, ms: a - s.qFrom }]
  const base = { ...s, laps, qFrom: a, alerted: false }
  return laps.length >= s.count ? { ...base, acc: a, runFrom: null, done: true } : base
}

/** Stop now. The question in progress is logged if you spent more than a few seconds on it. */
export function finish(s: FocusSession, now: number): FocusSession {
  if (s.done) return s
  const a = active(s, now)
  const laps = a - s.qFrom >= 5000 ? [...s.laps, { q: s.startQ + s.laps.length, ms: a - s.qFrom }] : s.laps
  return { ...s, laps, acc: a, runFrom: null, qFrom: a, done: true }
}

export type LapTag = 'early' | 'ontime' | 'over'
/** within 5% (at least 3 s) of the cycle counts as on time */
export function tag(ms: number, cycleMs: number): LapTag {
  const tol = Math.max(3000, cycleMs * 0.05)
  return ms > cycleMs + tol ? 'over' : ms < cycleMs - tol ? 'early' : 'ontime'
}

export function report(s: FocusSession) {
  const ms = s.laps.map((l) => l.ms)
  const sum = ms.reduce((a, b) => a + b, 0)
  const tags = s.laps.map((l) => tag(l.ms, s.cycleMs))
  return {
    n: s.laps.length,
    total: s.acc,
    avg: ms.length ? sum / ms.length : 0,
    fastest: ms.length ? Math.min(...ms) : 0,
    slowest: ms.length ? Math.max(...ms) : 0,
    early: tags.filter((t) => t === 'early').length,
    ontime: tags.filter((t) => t === 'ontime').length,
    over: tags.filter((t) => t === 'over').length,
  }
}

export function hms(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, '0')).join(':')
}
export function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
