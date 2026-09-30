import { dayProgress, movedTo, ownTasks, taskState, type TaskRef } from './dayStatus'
import type { Reader } from './reader'
import type { Row } from './schedule'

/**
 * Unfinished micro-tasks from days before today (partly done or missed): still visible until ticked,
 * cleared, or moved to a catch-up day that hasn't passed yet.
 */
export function overdueTasks(r: Reader, rows: Row[], today: string): TaskRef[] {
  const out: TaskRef[] = []
  for (const row of rows) {
    if (row.eff === null || row.eff >= today) continue
    if (dayProgress(r, row, rows).manual) continue
    for (const t of ownTasks(row)) {
      const s = taskState(r, t)
      if (s === 'open') out.push(t)
      else if (s === 'moved' && (movedTo(r, t) ?? '9999') < today) out.push(t) // catch-up day passed, still not done
    }
  }
  return out
}

/** next catch-up (buffer) row at or after today */
export function nextCatchUp(rows: Row[], today: string): Row | undefined {
  return rows
    .filter((x) => x.isBuffer && !x.isFree && x.eff !== null && x.eff >= today)
    .sort((a, b) => a.eff!.localeCompare(b.eff!))[0]
}
