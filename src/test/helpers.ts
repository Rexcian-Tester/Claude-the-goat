import { planDays } from '../data/plan'
import { ownTasks } from '../logic/dayStatus'
import { K } from '../logic/keys'
import { mapReader } from '../logic/reader'
import { buildSchedule } from '../logic/schedule'

export const sched = buildSchedule(undefined)
/** progress map with these original-date rows fully ticked */
export function ticked(dates: string[], extra: Record<string, unknown> = {}) {
  const m: Record<string, unknown> = { ...extra }
  for (const d of dates) for (const t of ownTasks(planDays.find((x) => x.date === d)!)) m[K.task(t.date, t.itemIdx, t.i)] = true
  return mapReader(m)
}
/** all non-buffer dates strictly before `before` */
export const studyDatesBefore = (before: string) => planDays.filter((d) => !d.isBuffer && d.date < before).map((d) => d.date)
