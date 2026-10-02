import { addDays } from '../data/dhaka'
import type { PlanItem } from '../data/plan'
import { dayProgress, ownTasks, taskState, topicMark, type TaskRef, type TopicMark } from './dayStatus'
import type { Reader } from './reader'
import type { Row } from './schedule'

export interface Due {
  row: Row
  item: PlanItem
  tasks: TaskRef[]
  ticked: number
  total: number
  done: boolean
  /** finished because the whole day was marked done, not by ticks */
  byDay: boolean
  /** your own Due / Done, if you set one */
  mark?: TopicMark
}

/** One topic on one day: its micro-tasks and whether it is finished (all ticked or cleared, or the day marked done). */
export function topicOn(r: Reader, row: Row, item: PlanItem, rows: Row[]): Due {
  const tasks = ownTasks(row).filter((t) => t.item === item)
  const states = tasks.map((t) => taskState(r, t))
  const ticked = states.filter((s) => s === 'done').length
  const byDay = dayProgress(r, row, rows).manual
  const mark = topicMark(r, item)
  const auto = byDay || (tasks.length > 0 && states.every((s) => s === 'done' || s === 'cleared'))
  return { row, item, tasks, ticked, total: tasks.length, done: mark ? mark === 'done' : auto, byDay, mark }
}

export interface DuesList {
  /** unfinished topics from days before today */
  overdue: Due[]
  /** topics you moved or split, still not finished (they stay due until done) */
  rescheduled: Due[]
  /** unfinished topics on days that no longer fit before 15 Dec */
  unscheduled: Due[]
  /** finished in the last week (so a Done can be switched back to Due) */
  recentDone: Due[]
}

export function duesList(r: Reader, rows: Row[], today: string): DuesList {
  const out: DuesList = { overdue: [], rescheduled: [], unscheduled: [], recentDone: [] }
  const weekAgo = addDays(today, -7)
  for (const row of rows)
    for (const item of row.items) {
      if (item.k === 'buf') continue // catch-up placeholders are never owed
      const past = row.eff !== null && row.eff < today
      const edited = !!item.src
      if (!past && !edited && row.eff !== null) continue
      const d = topicOn(r, row, item, rows)
      if (d.done) {
        if ((past || edited) && row.eff !== null && row.eff >= weekAgo) out.recentDone.push(d)
      } else if (row.eff === null) out.unscheduled.push(d)
      else if (past) out.overdue.push(d)
      else out.rescheduled.push(d)
    }
  const byDate = (a: Due, b: Due) => (a.row.eff ?? '9999').localeCompare(b.row.eff ?? '9999') || (a.item.partNo ?? 0) - (b.item.partNo ?? 0)
  out.overdue.sort(byDate)
  out.rescheduled.sort(byDate)
  out.recentDone.sort((a, b) => -byDate(a, b))
  return out
}
