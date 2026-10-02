import { addDays, diffDays } from '../data/dhaka'
import { allChapters, chaptersBySubject, realQuestions, allQuestions } from '../data/catalog'
import { PLAN_START, PLAN_LAST, planDays, type PlanItem } from '../data/plan'
import { repeats } from '../data/repeats'
import type { Chapter, Subject, Tier } from '../data/types'
import { dayProgress, ownTasks, taskState, topicMark, topicMarkKey } from './dayStatus'
import { K, type QStatus } from './keys'
import type { Reader } from './reader'
import type { Row } from './schedule'

export const TIER_WEIGHT: Record<Tier, number> = { T1: 4, T2: 3, T3: 2, T4: 1 }
const TIER_ORDER: Tier[] = ['T1', 'T2', 'T3', 'T4']

export const qStatus = (r: Reader, id: string): QStatus => r.get<QStatus>(K.qStatus(id)) ?? 'unsolved'
export const confidence = (r: Reader, chId: string): number | undefined => r.get<number>(K.conf(chId))

export function itemTier(item: PlanItem): Tier | null {
  if (!item.chapters.length) return null
  return item.chapters.map((c) => c.tier).sort()[0]
}

/** Share of micro-tasks done, treating a manually-done day as fully done. */
function taskCounts(r: Reader, rows: Row[], filter: (i: PlanItem) => boolean) {
  let done = 0
  let total = 0
  for (const row of rows) {
    if (row.isBuffer) continue
    const manual = dayProgress(r, row, rows).manual
    for (const t of ownTasks(row)) {
      if (!filter(t.item)) continue
      total++
      const s = taskState(r, t)
      const mark = topicMark(r, t.item)
      if (mark === 'done' || (manual && mark !== 'due') || s === 'done' || s === 'cleared' || s === 'moved') done++
    }
  }
  return { done, total, pct: total ? done / total : 0 }
}
export const overallCompletion = (r: Reader, rows: Row[]) => {
  const study = rows.filter((x) => !x.isBuffer)
  const done = study.filter((x) => dayProgress(r, x, rows).complete).length
  return { done, total: study.length, pct: study.length ? done / study.length : 0, tasks: taskCounts(r, rows, () => true) }
}
export const subjectCompletion = (r: Reader, rows: Row[], s: 'P' | 'C' | 'M') => taskCounts(r, rows, (i) => i.s === s)
export const tierCompletion = (r: Reader, rows: Row[], t: Tier) => taskCounts(r, rows, (i) => itemTier(i) === t)

export interface QStats {
  total: number
  solved: number
  wrong: number
  revisit: number
}
export function questionStats(r: Reader, subject?: Subject, includeModel = false): QStats {
  const pool = (includeModel ? allQuestions : realQuestions).filter((q) => !subject || q.chapterId.startsWith(subject + '-'))
  const out = { total: pool.length, solved: 0, wrong: 0, revisit: 0 }
  for (const q of pool) {
    const s = qStatus(r, q.id)
    if (s === 'solved') out.solved++
    else if (s === 'wrong') out.wrong++
    else if (s === 'revisit') out.revisit++
  }
  return out
}
export function chapterQuestionStats(r: Reader, ch: Chapter): QStats & { mtTotal: number } {
  const all = ch.topics.flatMap((t) => t.subs.flatMap((s) => s.qs))
  const real = all.filter((q) => !q.m)
  const out = { total: real.length, solved: 0, wrong: 0, revisit: 0, mtTotal: all.length - real.length }
  for (const q of all) {
    const s = qStatus(r, q.id)
    if (s === 'solved' && !q.m) out.solved++
    else if (s === 'wrong') out.wrong++
    else if (s === 'revisit') out.revisit++
  }
  return out
}

/** Chapter progress for the map/search: micro-task ratio of the plan days it appears in. */
export function chapterProgress(r: Reader, rows: Row[], slots: { row: Row }[], chapterId?: string): { ratio: number; state: 'not started' | 'in progress' | 'done' } {
  void chapterId
  let done = 0
  let total = 0
  const seen = new Set<string>()
  for (const s of slots) {
    if (seen.has(s.row.date)) continue
    seen.add(s.row.date)
    const dp = dayProgress(r, s.row, rows)
    const own = dp.own.filter((t) => slots.some((x) => x.row.date === t.date))
    total += own.length
    for (const t of own) {
      const st = taskState(r, t)
      const mark = topicMark(r, t.item)
      if (mark === 'done' || (dp.manual && mark !== 'due') || st === 'done' || st === 'cleared' || st === 'moved') done++
    }
  }
  const ratio = total ? done / total : 0
  return { ratio, state: ratio >= 1 ? 'done' : ratio > 0 ? 'in progress' : 'not started' }
}

export function streak(r: Reader, rows: Row[], today: string): number {
  const byEff = new Map(rows.filter((x) => x.eff).map((x) => [x.eff!, x]))
  let n = 0
  for (let d = today; d >= PLAN_START; d = addDays(d, -1)) {
    const row = byEff.get(d)
    if (!row) break
    const done = dayProgress(r, row, rows).complete
    if (done) n++
    else if (d === today || row.isBuffer) continue
    else break
  }
  return n
}

/** Dhaka date a study day was finished: date of its newest tick / manual mark. */
function completedOn(r: Reader, row: Row, rows: Row[]): string | null {
  const dp = dayProgress(r, row, rows)
  if (!dp.complete) return null
  let t = 0
  for (const x of ownTasks(row)) t = Math.max(t, r.t(x.tk) ?? 0, r.t(x.mk) ?? 0)
  t = Math.max(t, r.t(K.dayDone(row.date)) ?? 0)
  for (const it of row.items) t = Math.max(t, r.t(topicMarkKey(it)) ?? 0)
  return t ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date(t)) : row.date
}
export interface BurnPoint {
  date: string
  planned: number
  actual: number
}
/** Cumulative study days: original plan vs actually completed. */
export function burnUp(r: Reader, rows: Row[], today: string): BurnPoint[] {
  const study = rows.filter((x) => !x.isBuffer)
  const end = today < PLAN_LAST ? today : PLAN_LAST
  const done = study.map((x) => completedOn(r, x, rows)).filter((d): d is string => !!d)
  const planned = planDays.filter((x) => !x.isBuffer)
  const out: BurnPoint[] = []
  const n = diffDays(PLAN_START, end)
  for (let i = 0; i <= n; i++) {
    const date = addDays(PLAN_START, i)
    out.push({
      date,
      planned: planned.filter((x) => x.date <= date).length, // original schedule
      actual: done.filter((d) => d <= date).length,
    })
  }
  return out
}

export interface Reflection {
  date: string
  hours?: number
  focus?: number
  well?: string
  blocked?: string
  first?: string
}
export function reflections(r: Reader, rows: Row[]): Reflection[] {
  const out: Reflection[] = []
  for (const row of rows) {
    const d = row.date
    const hours = r.get<number>(K.refl(d, 'hours'))
    const focus = r.get<number>(K.refl(d, 'focus'))
    if (hours === undefined && focus === undefined) continue
    out.push({ date: d, hours, focus })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}
/** trailing mean over the last `w` days, shown only on days that have a value */
export function movingAvg(vals: (number | undefined)[], w = 7): (number | undefined)[] {
  return vals.map((v, i) => {
    if (v === undefined) return undefined
    const win = vals.slice(Math.max(0, i - w + 1), i + 1).filter((v): v is number => v !== undefined)
    return win.length ? win.reduce((a, b) => a + b, 0) / win.length : undefined
  })
}

export interface WeakChapter {
  chapter: Chapter
  confidence: number
  score: number
}
/** Lowest confidence × highest tier first. Only chapters you've rated. */
export function weakestChapters(r: Reader, limit = 8): WeakChapter[] {
  return allChapters
    .map((c) => ({ chapter: c, confidence: confidence(r, c.id) }))
    .filter((x): x is { chapter: Chapter; confidence: number } => x.confidence !== undefined)
    .map((x) => ({ ...x, score: (6 - x.confidence) * TIER_WEIGHT[x.chapter.tier] }))
    .sort((a, b) => b.score - a.score || a.chapter.rank - b.chapter.rank)
    .slice(0, limit)
}

export type RevisionItem =
  | { kind: 'question'; id: string; chapter: Chapter; status: QStatus; tier: Tier; label: string; ref: string }
  | { kind: 'repeat'; id: string; chapter?: Chapter; tier: Tier; label: string; where: string }
  | { kind: 'chapter'; id: string; chapter: Chapter; tier: Tier; confidence: number }

/** 15–17 Dec revision list: wrong/revisit questions, every Repeats entry, chapters with confidence ≤ 2. Sorted by tier. */
export function revisionList(r: Reader): RevisionItem[] {
  const items: RevisionItem[] = []
  for (const c of allChapters) {
    const conf = confidence(r, c.id)
    if (conf !== undefined && conf <= 2) items.push({ kind: 'chapter', id: c.id, chapter: c, tier: c.tier, confidence: conf })
    for (const t of c.topics)
      for (const s of t.subs)
        for (const q of s.qs) {
          const st = qStatus(r, q.id)
          if (st === 'wrong' || st === 'revisit') items.push({ kind: 'question', id: q.id, chapter: c, status: st, tier: c.tier, label: q.t, ref: `${q.y}|${q.q}` })
        }
  }
  for (const rep of repeats) {
    const ch = rep.chapterIds.length ? allChapters.find((c) => c.id === rep.chapterIds[0]) : undefined
    items.push({ kind: 'repeat', id: rep.id, chapter: ch, tier: ch?.tier ?? 'T2', label: rep.question, where: rep.where })
  }
  const kindOrder = { chapter: 0, question: 1, repeat: 2 }
  return items.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || kindOrder[a.kind] - kindOrder[b.kind] || (a.chapter?.rank ?? 99) - (b.chapter?.rank ?? 99))
}
export { chaptersBySubject }
