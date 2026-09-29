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

export function ownTasks(day: PlanDay): TaskRef[] {
  return day.items.flatMap((item) =>
    item.topicList.map((text, i) => ({ key: `${day.date}:${item.itemIdx}:${i}`, date: day.date, itemIdx: item.itemIdx, i, text, item })),
  )
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
