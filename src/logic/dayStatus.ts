import type { PlanDay, PlanItem } from '../data/plan'
import { K } from './keys'
import type { Reader } from './reader'
import type { Row } from './schedule'

export interface TaskRef {
  key: string
  date: string // original row date
  itemIdx: number
  i: number
  text: string
  item: PlanItem
}
export type TaskState = 'done' | 'moved' | 'cleared' | 'open'

// Plan days are static, and schedule rows share their day's items array, so task lists are built once.
const ownCache = new WeakMap<PlanDay['items'], TaskRef[]>()
export function ownTasks(day: PlanDay): TaskRef[] {
  let out = ownCache.get(day.items)
  if (!out) {
    out = day.items.flatMap((item) =>
      item.topicList.map((text, i) => ({ key: `${day.date}:${item.itemIdx}:${i}`, date: day.date, itemIdx: item.itemIdx, i, text, item })),
    )
    ownCache.set(day.items, out)
  }
  return out
}

/* Per-state cache: one pass builds "tasks moved onto date X" and each day's progress is computed once per
 * change instead of once per row per render (the plan list asks for all 76 days, each scanning every row). */
interface Memo {
  r: Reader
  v: number
  rows: Row[]
  inbound: Map<string, TaskRef[]> | null
  progress: Map<string, DayProgress>
}
let memo: Memo | null = null
function memoFor(r: Reader, rows: Row[]): Memo | null {
  const v = r.version?.()
  if (v === undefined) return null
  if (!memo || memo.r !== r || memo.v !== v || memo.rows !== rows) memo = { r, v, rows, inbound: null, progress: new Map() }
  return memo
}
export function taskState(r: Reader, t: TaskRef): TaskState {
  if (r.get<boolean>(K.task(t.date, t.itemIdx, t.i))) return 'done'
  const m = r.get<string>(K.moved(t.date, t.itemIdx, t.i))
  if (m === 'cleared') return 'cleared'
  if (m) return 'moved'
  return 'open'
}
export const movedTo = (r: Reader, t: TaskRef): string | undefined => {
  const m = r.get<string>(K.moved(t.date, t.itemIdx, t.i))
  return m && m !== 'cleared' ? m : undefined
}

/** Tasks from other days that were moved onto this (catch-up) day, keyed by their *effective* target date. */
export function movedIn(r: Reader, rows: Row[], targetDate: string): TaskRef[] {
  const m = memoFor(r, rows)
  if (m) {
    if (!m.inbound) {
      m.inbound = new Map()
      for (const row of rows)
        for (const t of ownTasks(row)) {
          const to = movedTo(r, t)
          if (to && to !== row.date) m.inbound.set(to, [...(m.inbound.get(to) ?? []), t])
        }
    }
    return m.inbound.get(targetDate) ?? []
  }
  const out: TaskRef[] = []
  for (const row of rows) {
    if (row.date === targetDate) continue
    for (const t of ownTasks(row)) if (movedTo(r, t) === targetDate) out.push(t)
  }
  return out
}

export type DayStatus = 'done' | 'partial' | 'none'
export interface DayProgress {
  tasks: TaskRef[] // own + moved in
  own: TaskRef[]
  total: number
  ticked: number
  resolved: number // ticked + moved-out + cleared
  manual: boolean
  complete: boolean
  ratio: number // 0..1, ticked share of tasks that still belong to this day
  status: DayStatus
}
export function dayProgress(r: Reader, row: Row, rows: Row[]): DayProgress {
  const m = memoFor(r, rows)
  const hit = m?.progress.get(row.date)
  if (hit) return hit
  const p = computeDayProgress(r, row, rows)
  m?.progress.set(row.date, p)
  return p
}
function computeDayProgress(r: Reader, row: Row, rows: Row[]): DayProgress {
  const own = ownTasks(row)
  const inbound = row.eff ? movedIn(r, rows, row.eff) : []
  const tasks = [...own, ...inbound]
  let ticked = 0
  let resolved = 0
  let keep = 0
  for (const t of tasks) {
    const s = taskState(r, t)
    const isOwn = t.date === row.date
    if (s === 'done') {
      ticked++
      resolved++
      keep++
    } else if (isOwn && (s === 'moved' || s === 'cleared')) resolved++
    else keep++ // open (own), or inbound not yet done
  }
  const manual = !!r.get<boolean>(K.dayDone(row.date))
  const total = tasks.length
  const complete = manual || (total > 0 && resolved === total)
  return {
    tasks,
    own,
    total,
    ticked,
    resolved,
    manual,
    complete,
    ratio: keep ? ticked / keep : complete ? 1 : 0,
    status: complete ? 'done' : ticked > 0 || resolved > 0 ? 'partial' : 'none',
  }
}
