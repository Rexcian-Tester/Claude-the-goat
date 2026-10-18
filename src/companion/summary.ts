// What the Desk Buddy companion app (separate repo) knows about your day: today's topics and ticks, study time per
// block, late starts, how far behind/ahead the plan is, unfinished work, the next few days and the last week.
// Built on the server from the progress document by GET /api/companion, with the same logic the site uses, so the
// app never has to copy the plan or its rules. Pure (no React, no storage). Read-only: nothing here writes.
import { addDays, diffDays, weekdayIndex } from '../data/dhaka'
import { EXAM_DATE } from '../data/plan'
import { behindInfo, lagLabel } from '../logic/behind'
import { dayProgress, ownTasks, taskState, topicMark, type TaskRef } from '../logic/dayStatus'
import { K, type GoalAnswer, type LateStart } from '../logic/keys'
import { nextCatchUp, overdueTasks } from '../logic/overdue'
import type { PlanEdits } from '../logic/planEdits'
import { DAILY_GOAL_MIN, DAILY_MINIMUM_MIN, DEFAULT_CONFIG, blockMinutes, effectiveTarget, studyBlock, studyBlocks, type StudyBlockId } from '../logic/pomo'
import type { Reader } from '../logic/reader'
import { routineFor } from '../logic/routine'
import { buildSchedule, type Row, type Shifts } from '../logic/schedule'
import { SPAN_KEY_RE, WATCH_KEY_RE, type Span, type WatchRecord } from '../watch/session'
import { watchSplit } from '../watch/watchTime'

export const COMPANION_VERSION = 1
const HISTORY_DAYS = 7
const UPCOMING_DAYS = 3
const OVERDUE_GROUPS = 12

type Fields = Record<string, { v?: unknown } | undefined>

export interface CompanionTopic {
  key: string
  subject: string
  ch: string
  en: string
  part: string
  kind: string
  note: string | null
  tier: string | null
  /** your own Due / Done for the topic, if any */
  mark: 'due' | 'done' | null
  tasks: { text: string; state: 'done' | 'moved' | 'cleared' | 'open' }[]
}
export interface CompanionBlock {
  id: string
  label: string
  from: number
  to: number
  kind: string
  /** study blocks only (ms) */
  target?: number
  studied?: number
  late?: { min: number; reason: string }
  ticked?: boolean
}
export interface CompanionDay {
  date: string
  studied: number
  goalAnswer: GoalAnswer | null
  progress: { ticked: number; total: number; complete: boolean } | null
  topics: string[]
  late: { block: string; min: number; reason: string }[]
  reflection: { hours?: number; focus?: number; well?: string; blocked?: string; first?: string } | null
}
export interface CompanionSummary {
  v: typeof COMPANION_VERSION
  generatedAt: number
  date: string
  weekday: number
  daysToExam: number
  phase: string
  goalMs: number
  minimumMs: number
  behind: { lag: number; label: string; elapsed: number; completed: number }
  today: {
    blocks: CompanionBlock[]
    studied: number
    topics: CompanionTopic[]
    /** micro-tasks moved onto today from other days */
    movedIn: { text: string; ch: string; from: string; done: boolean }[]
    progress: { ticked: number; total: number; complete: boolean } | null
    isBuffer: boolean
    isFree: boolean
    note: string | null
    goalAnswer: GoalAnswer | null
  }
  overdue: { count: number; groups: { ch: string; en: string; date: string; count: number; tasks: string[] }[] }
  nextCatchUp: string | null
  upcoming: { date: string; topics: string[]; isBuffer: boolean; isFree: boolean }[]
  history: CompanionDay[]
}

/** A Reader over the raw document fields (deleted = null reads as missing, like the store). */
export function fieldsReader(fields: Fields): Reader {
  return {
    get: <T,>(k: string) => {
      const v = fields[k]?.v
      return v === null || v === undefined ? undefined : (v as T)
    },
    t: () => undefined,
    // one request = one state, so the day-progress cache can be used throughout
    version: () => 1,
  }
}

/** Watch sessions and device study stretches, by date. */
function indexWatch(fields: Fields) {
  const byDate = new Map<string, { records: WatchRecord[]; spans: Span[] }>()
  const isSpan = (x: unknown): x is Span => Array.isArray(x) && x.length === 2 && typeof x[0] === 'number' && typeof x[1] === 'number' && x[0] < x[1]
  for (const [k, f] of Object.entries(fields)) {
    const w = WATCH_KEY_RE.exec(k)
    const s = w ? null : SPAN_KEY_RE.exec(k)
    if (!w && !s) continue
    const v = f?.v
    if (v === null || v === undefined) continue
    const day = byDate.get((w ?? s)![1]) ?? { records: [], spans: [] }
    if (w) {
      const parts = (v as WatchRecord).parts
      if (Array.isArray(parts) && parts.every(isSpan)) day.records.push({ parts, src: 'watch' })
    } else if (Array.isArray(v)) day.spans.push(...v.filter(isSpan))
    byDate.set((w ?? s)![1], day)
  }
  return byDate
}

/** Study time per block on a date: the site's own logged time plus the watch's share (same rules as the site;
 *  targets use the default Study Blocks timer settings, since each device keeps its own). */
function studiedByBlock(r: Reader, watch: ReturnType<typeof indexWatch>, date: string): Map<StudyBlockId, number> {
  const blocks = studyBlocks(date)
  const site = (id: StudyBlockId) => r.get<number>(K.focusMs(date, id)) ?? 0
  const target = (id: StudyBlockId) => effectiveTarget(blockMinutes(studyBlock(id, date)), DEFAULT_CONFIG) * 60000
  const day = watch.get(date)
  const fromWatch = day && day.records.length ? watchSplit(date, day.records, day.spans, site, target) : new Map<StudyBlockId, number>()
  const out = new Map<StudyBlockId, number>()
  for (const b of blocks) out.set(b.id, Math.round(site(b.id) + (fromWatch.get(b.id) ?? 0)))
  // time logged before Study Block B and Revision were merged
  const old = site('revision')
  if (old) out.set('revision', old)
  return out
}
const sum = (m: Map<unknown, number>) => [...m.values()].reduce((n, x) => n + x, 0)

const label = (it: Row['items'][number]) => `${it.en || it.ch}${it.part ? ` (${it.part})` : ''}`
const progressOf = (r: Reader, row: Row | undefined, rows: Row[]) => {
  if (!row || row.isFree) return null
  const p = dayProgress(r, row, rows)
  return { ticked: p.ticked, total: p.total, complete: p.complete }
}
const lateOn = (r: Reader, date: string) =>
  routineFor(date)
    .filter((b) => b.kind === 'study')
    .flatMap((b) => {
      const l = r.get<LateStart>(K.late(date, b.id))
      return l && typeof l.min === 'number' ? [{ block: b.id, min: l.min, reason: typeof l.reason === 'string' ? l.reason : '' }] : []
    })
function reflectionOn(r: Reader, date: string): CompanionDay['reflection'] {
  const out: NonNullable<CompanionDay['reflection']> = {}
  const hours = r.get<number>(K.refl(date, 'hours'))
  const focus = r.get<number>(K.refl(date, 'focus'))
  if (typeof hours === 'number') out.hours = hours
  if (typeof focus === 'number') out.focus = focus
  for (const f of ['well', 'blocked', 'first'] as const) {
    const s = r.get<string>(K.refl(date, f))
    if (typeof s === 'string' && s.trim()) out[f] = s.trim().slice(0, 500)
  }
  return Object.keys(out).length ? out : null
}
const goalOn = (r: Reader, date: string): GoalAnswer | null => {
  const g = r.get<string>(K.goal(date))
  return g === 'yes' || g === 'close' || g === 'no' ? g : null
}

export function buildCompanionSummary(fields: Fields, today: string, now: number): CompanionSummary {
  const r = fieldsReader(fields)
  const { rows, byEff } = buildSchedule(r.get<Shifts>(K.shift), r.get<PlanEdits>(K.edits))
  const watch = indexWatch(fields)
  const behind = behindInfo(today, rows, r)

  // today
  const row = byEff.get(today)
  const studied = studiedByBlock(r, watch, today)
  const blocks: CompanionBlock[] = routineFor(today).map((b) => {
    const out: CompanionBlock = { id: b.id, label: b.label, from: b.from, to: b.to, kind: b.kind }
    if (b.kind === 'study') {
      const id = b.id as StudyBlockId
      out.target = effectiveTarget(blockMinutes(b), DEFAULT_CONFIG) * 60000
      out.studied = studied.get(id) ?? 0
      const l = r.get<LateStart>(K.late(today, b.id))
      if (l && typeof l.min === 'number') out.late = { min: l.min, reason: typeof l.reason === 'string' ? l.reason : '' }
    }
    if (r.get<boolean>(K.routine(today, b.id))) out.ticked = true
    return out
  })
  const own = row ? ownTasks(row) : []
  const topics: CompanionTopic[] = (row?.items ?? []).map((it) => ({
    key: it.key,
    subject: it.s,
    ch: it.ch,
    en: it.en,
    part: it.part,
    kind: it.k,
    note: it.m,
    tier: it.chapters.map((c) => c.tier).sort()[0] ?? null,
    mark: topicMark(r, it) ?? null,
    tasks: own.filter((t) => t.item === it).map((t) => ({ text: t.text, state: taskState(r, t) })),
  }))
  const movedIn = row
    ? dayProgress(r, row, rows)
        .tasks.filter((t) => t.date !== row.date)
        .map((t) => ({ text: t.text, ch: t.item.ch, from: t.date, done: taskState(r, t) === 'done' }))
    : []

  // unfinished work from earlier days, grouped by topic
  const overdue = overdueTasks(r, rows, today)
  const groups = new Map<string, TaskRef[]>()
  for (const t of overdue) groups.set(t.item.key, [...(groups.get(t.item.key) ?? []), t])

  const upcoming = Array.from({ length: UPCOMING_DAYS }, (_, i) => addDays(today, i + 1)).map((date) => {
    const d = byEff.get(date)
    return { date, topics: d ? d.items.map(label) : [], isBuffer: !!d?.isBuffer, isFree: !!d?.isFree }
  })

  const history: CompanionDay[] = Array.from({ length: HISTORY_DAYS }, (_, i) => addDays(today, -(i + 1))).map((date) => {
    const d = byEff.get(date)
    return {
      date,
      studied: sum(studiedByBlock(r, watch, date)),
      goalAnswer: goalOn(r, date),
      progress: progressOf(r, d, rows),
      topics: d ? d.items.map(label) : [],
      late: lateOn(r, date),
      reflection: reflectionOn(r, date),
    }
  })

  return {
    v: COMPANION_VERSION,
    generatedAt: now,
    date: today,
    weekday: weekdayIndex(today),
    daysToExam: diffDays(today, EXAM_DATE),
    phase: behind.phase,
    goalMs: DAILY_GOAL_MIN * 60000,
    minimumMs: DAILY_MINIMUM_MIN * 60000,
    behind: { lag: behind.lag, label: lagLabel(behind.lag), elapsed: behind.elapsed, completed: behind.completed },
    today: {
      blocks,
      studied: sum(studied),
      topics,
      movedIn,
      progress: progressOf(r, row, rows),
      isBuffer: !!row?.isBuffer,
      isFree: !!row?.isFree,
      note: row?.note ?? null,
      goalAnswer: goalOn(r, today),
    },
    overdue: {
      count: overdue.length,
      groups: [...groups.values()].slice(0, OVERDUE_GROUPS).map((ts) => ({
        ch: ts[0].item.ch,
        en: ts[0].item.en,
        date: ts[0].date,
        count: ts.length,
        tasks: ts.slice(0, 5).map((t) => t.text),
      })),
    },
    nextCatchUp: nextCatchUp(rows, today)?.eff ?? null,
    upcoming,
    history,
  }
}
