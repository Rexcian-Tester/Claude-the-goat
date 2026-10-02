// Study Blocks: a Pomodoro tied to the daily Routine. Pure (no React, no storage) so it is easy to test.
// Times of day are minutes after midnight in Bangladesh time; durations inside a session are milliseconds of
// wall-clock time, so the timer stays exact when the phone sleeps or the tab is throttled.
import { todayISO } from '../data/dhaka'
import { blockAt, routineFor, type RoutineBlock } from '../views/Routine'

export interface PomoConfig {
  focus: number // minutes
  short: number
  long: number
  every: number // sessions before a long break
  grace: number // minutes after a block starts before a start counts as late
}
export const DEFAULT_CONFIG: PomoConfig = { focus: 25, short: 5, long: 15, every: 4, grace: 10 }

/** 'revision' only appears in data logged before Study Block B and Revision were merged. */
export type StudyBlockId = 'study-a' | 'study-b' | 'study-c' | 'study-d' | 'revision'
export type StudyBlock = RoutineBlock & { id: StudyBlockId }
export const BLOCK_LABEL: Record<StudyBlockId, string> = {
  'study-a': 'Study Block A',
  'study-b': 'Study Block B & Revision',
  'study-c': 'Study Block C',
  'study-d': 'Study Block D',
  revision: 'Revision',
}
/** The study blocks of a day, in order (Friday has four). */
export const studyBlocks = (date: string = todayISO()) => routineFor(date).filter((b) => b.kind === 'study') as StudyBlock[]
/** A study block on a date; a block that day doesn't have falls back to its usual (weekday) times. */
export const studyBlock = (id: StudyBlockId, date: string = todayISO()): StudyBlock =>
  studyBlocks(date).find((b) => b.id === id) ?? studyBlocks('2026-10-01').find((b) => b.id === id) ?? { id, from: 0, to: 0, label: BLOCK_LABEL[id], kind: 'study' }
export const blockMinutes = (b: { from: number; to: number }) => (b.to - b.from + 1440) % 1440

/**
 * Effective study minutes a block allows when the cycle is followed from its first minute: focus, short break,
 * a long break after every `every` sessions; the session running into the block's end is cut there.
 * Defaults: Study Block A (4h) 195 min, Study Block B (3h) 145 min, Revision (1h) 50 min.
 */
export function effectiveTarget(blockMin: number, c: PomoConfig = DEFAULT_CONFIG): number {
  let t = 0
  let study = 0
  let n = 0
  while (t < blockMin) {
    const s = Math.min(c.focus, blockMin - t)
    study += s
    t += s
    n++
    if (t >= blockMin) break
    t += n % c.every === 0 ? c.long : c.short
  }
  return study
}

/** Which study block time studied at this minute counts towards: the block you are in, else the last one that
 *  ended today (extra study at breakfast still counts for Study Block A), else Study Block A (before 4 AM). */
export function attributeBlock(min: number, date: string = todayISO()): StudyBlockId {
  const list = studyBlocks(date)
  const inside = list.find((b) => min >= b.from && min < b.to)
  if (inside) return inside.id
  const past = list.filter((b) => b.to <= min)
  return past.length ? past[past.length - 1].id : list[0].id
}

/** The study block whose window contains this minute, or null. */
export const blockIn = (min: number, date: string = todayISO()) => studyBlocks(date).find((b) => min >= b.from && min < b.to) ?? null

/** Minutes late if a block is being started now (inside its window, past the grace period), else 0. */
export function minutesLate(id: StudyBlockId, min: number, grace: number, date: string = todayISO()): number {
  const b = studyBlock(id, date)
  if (min < b.from || min >= b.to) return 0
  const late = min - b.from
  return late > grace ? late : 0
}

/** The Routine block happening now when it is not a study block (studying now eats into it), else null.
 *  Wake-up time (3:30–4 AM) doesn't count: starting early is fine. */
export function collidingBlock(min: number, date: string = todayISO()) {
  const b = blockAt(min, date)
  return b.kind === 'study' || b.kind === 'wake' ? null : b
}

const dhakaMin = (ms: number) => Math.floor(((ms + 6 * 3600000) % 86400000) / 60000)
/**
 * Which blocks a stretch of study time [from, to) counts towards (wall clock ms, one Dhaka day).
 * Time counts to the block whose window it falls in; outside every window, to the last block that ended
 * (or the first of the day). Once a block has reached its target, the extra goes back to the earliest block
 * of the day still short of its target (e.g. Study Block B's window is full, so the rest fills Study Block A).
 */
export function splitStudy(from: number, to: number, date: string, done: (id: StudyBlockId) => number, target: (id: StudyBlockId) => number): [StudyBlockId, number][] {
  const list = studyBlocks(date)
  const added = new Map<StudyBlockId, number>()
  const have = (id: StudyBlockId) => done(id) + (added.get(id) ?? 0)
  const give = (id: StudyBlockId, ms: number) => added.set(id, (added.get(id) ?? 0) + ms)
  let t = from
  while (t < to) {
    const m = dhakaMin(t)
    const inside = list.find((b) => m >= b.from && m < b.to)
    // the next window edge after t
    const edges = list.flatMap((b) => [b.from, b.to]).filter((e) => e > m)
    const nextEdge = edges.length ? Math.min(...edges) : 1440
    const end = Math.min(to, t + (nextEdge * 60000 - (((t + 6 * 3600000) % 86400000))))
    let piece = Math.max(end - t, 1)
    const primary = inside ? inside.id : attributeBlock(m, date)
    for (const id of [primary, ...list.filter((b) => b.id !== primary).map((b) => b.id)]) {
      if (piece <= 0) break
      const room = target(id) - have(id)
      if (room <= 0) continue
      const g = Math.min(room, piece)
      give(id, g)
      piece -= g
    }
    if (piece > 0) give(primary, piece)
    t = Math.max(end, t + 1)
  }
  // keep the day's order
  return list.map((b) => [b.id, added.get(b.id) ?? 0] as [StudyBlockId, number]).filter(([, ms]) => ms > 0)
}

/* ---------- the session state machine ---------- */
export type Phase =
  | 'idle' // nothing started
  | 'focus' // counting down a study session
  | 'ask' // a session just ended: break, or flow state?
  | 'flow' // open-ended stopwatch, no limit
  | 'pickBreak' // flow ended: choose the break length
  | 'break' // counting down a break
  | 'ready' // break over, waiting to start the next session

export interface PomoState {
  mode: 'study' | 'normal'
  phase: Phase
  /** planned length of the current focus/break (ms); 0 for flow */
  len: number
  /** ms run before the current stretch; runFrom = wall clock of the current stretch, null when paused */
  acc: number
  runFrom: number | null
  /** sessions finished since the last long break */
  streak: number
  /** block the current/last study time counts towards (study mode) */
  block: StudyBlockId | null
  /** the break that comes next (set when a session ends) */
  breakKind: 'short' | 'long' | 'custom'
  /** wall clock when the current phase started (for logs) */
  startedAt: number
  /** study ms of the current session already logged (the engine logs as you go; flow logs only the rest) */
  logged: number
  /** this session already counted towards the long-break streak */
  counted?: boolean
}

export const idle = (mode: PomoState['mode'] = 'study'): PomoState => ({ mode, phase: 'idle', len: 0, acc: 0, runFrom: null, streak: 0, block: null, breakKind: 'short', startedAt: 0, logged: 0 })

export const elapsed = (s: PomoState, now: number) => s.acc + (s.runFrom === null ? 0 : Math.max(0, now - s.runFrom))
export const remaining = (s: PomoState, now: number) => Math.max(0, s.len - elapsed(s, now))
export const running = (s: PomoState) => s.runFrom !== null
/** a counting phase whose time is study time */
export const isStudy = (s: PomoState) => s.phase === 'focus' || s.phase === 'flow'

export function startFocus(s: PomoState, now: number, c: PomoConfig, block: StudyBlockId | null): PomoState {
  return { ...s, phase: 'focus', len: c.focus * 60000, acc: 0, runFrom: now, block, startedAt: now, logged: 0, counted: false }
}
export function pause(s: PomoState, now: number): PomoState {
  return s.runFrom === null ? s : { ...s, acc: elapsed(s, now), runFrom: null }
}
export function resume(s: PomoState, now: number): PomoState {
  return s.runFrom !== null || !['focus', 'flow', 'break'].includes(s.phase) ? s : { ...s, runFrom: now }
}

/** When the running focus session or break hits zero (wall clock), else null. */
export function dueAt(s: PomoState): number | null {
  if ((s.phase !== 'focus' && s.phase !== 'break') || s.runFrom === null) return null
  return s.runFrom + (s.len - s.acc)
}

/** Session finished: the study time to log, and what comes next. `autoFlow` (question timer running) skips the
 *  question and keeps counting as flow from the exact end of the session. */
export function endFocus(s: PomoState, at: number, c: PomoConfig, autoFlow: boolean): { state: PomoState; studied: number } {
  if (autoFlow) return { state: { ...s, phase: 'flow', len: 0, acc: s.len, runFrom: at }, studied: 0 }
  const streak = s.streak + 1
  return { state: { ...s, phase: 'ask', acc: s.len, runFrom: null, streak, breakKind: streak % c.every === 0 ? 'long' : 'short', logged: s.len, counted: true }, studied: Math.max(0, s.len - s.logged) }
}
/** "I am in the flow state": keep counting from where the session ended, no limit. */
export function enterFlow(s: PomoState, now: number): PomoState {
  return { ...s, phase: 'flow', len: 0, acc: s.len, runFrom: now }
}
/** Stop flow. Logs what was not logged yet (the planned part was logged when the session ended, unless it went
 *  straight into flow). The break offered next follows the usual cycle. */
export function stopFlow(s: PomoState, now: number, c: PomoConfig): { state: PomoState; studied: number; total: number } {
  const total = elapsed(s, now)
  const streak = s.streak + (s.counted ? 0 : 1)
  return { state: { ...s, phase: 'pickBreak', acc: total, runFrom: null, streak, breakKind: streak % c.every === 0 ? 'long' : 'short', logged: total, counted: true }, studied: Math.max(0, total - s.logged), total }
}
/** Study time not logged yet in the session running now (for live progress). */
export const unlogged = (s: PomoState, now: number) => (isStudy(s) ? Math.max(0, elapsed(s, now) - s.logged) : 0)
/** Everything studied so far in this session has been logged. */
export const markLogged = (s: PomoState, now: number): PomoState => (isStudy(s) ? { ...s, logged: elapsed(s, now) } : s)
export function startBreak(s: PomoState, now: number, c: PomoConfig, minutes?: number): PomoState {
  const kind = minutes !== undefined ? 'custom' : s.breakKind
  const m = minutes ?? (kind === 'long' ? c.long : c.short)
  return { ...s, phase: 'break', len: m * 60000, acc: 0, runFrom: now, breakKind: kind, streak: kind === 'long' ? 0 : s.streak, startedAt: now }
}
export function endBreak(s: PomoState): PomoState {
  return { ...s, phase: 'ready', acc: s.len, runFrom: null }
}
/** Stop the current focus early (Stop button): the time already done still counts. */
export function stopFocus(s: PomoState, now: number): { state: PomoState; studied: number } {
  return { state: { ...s, phase: 'ready', acc: 0, runFrom: null, logged: 0 }, studied: s.phase === 'focus' ? Math.max(0, elapsed(s, now) - s.logged) : 0 }
}
