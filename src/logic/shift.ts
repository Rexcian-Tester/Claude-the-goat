import { addDays } from '../data/dhaka'
import { PLAN_LAST } from '../data/plan'
import { dayProgress } from './dayStatus'
import type { Reader } from './reader'
import type { Row, Shifts } from './schedule'

export interface ShiftMove {
  row: Row
  from: string | null
  to: string | 'unscheduled'
}
export interface ShiftPreview {
  debt: number // unfinished study days before today
  moves: ShiftMove[]
  consumedBuffers: Row[] // catch-up days absorbed by the slip
  unscheduled: Row[] // rows that no longer fit before 15 Dec
  shifts: Shifts // the full new `plan:shift` value if accepted
}

/**
 * "Shift remaining days" preview. Unfinished past study days are re-slotted from today, later days move
 * down, and catch-up days are absorbed first. Days already completed stay where they are. Nothing beyond
 * PLAN_LAST (14 Dec) is used: 15–18 Dec are protected. Pure: the caller decides whether to save `shifts`.
 */
export function previewShift(rows: Row[], today: string, r: Reader): ShiftPreview {
  const progress = new Map(rows.map((x) => [x.date, dayProgress(r, x, rows).complete]))
  const late = rows.filter((x) => !x.isBuffer && !progress.get(x.date) && x.eff !== null && x.eff < today)
  // rows parked by an earlier shift stay lowest priority, and come back if a slot frees up
  const parked = rows.filter((x) => !x.isBuffer && x.eff === null && !progress.get(x.date))
  const fixed = rows.filter((x) => x.eff !== null && x.eff >= today && progress.get(x.date) && !x.isBuffer)
  const fixedDates = new Set(fixed.map((x) => x.eff!))
  const future = rows
    .filter((x) => x.eff !== null && x.eff >= today && !fixedDates.has(x.eff!))
    .sort((a, b) => a.eff!.localeCompare(b.eff!))
  const debt = late.length

  const consumedBuffers: Row[] = []
  const movable: Row[] = [...late]
  for (const x of future) {
    if (x.isBuffer && consumedBuffers.length < debt) consumedBuffers.push(x)
    else movable.push(x)
  }
  movable.push(...parked)

  const slots: string[] = []
  for (let d = today; d <= PLAN_LAST; d = addDays(d, 1)) if (!fixedDates.has(d)) slots.push(d)

  const moves: ShiftMove[] = []
  const unscheduled: Row[] = []
  const shifts: Shifts = {}
  movable.forEach((row, i) => {
    const to = i < slots.length ? slots[i] : 'unscheduled'
    if (to === 'unscheduled') unscheduled.push(row)
    if ((to === 'unscheduled' ? null : to) !== row.eff) moves.push({ row, from: row.eff, to })
    if (to !== row.date) shifts[row.date] = to
  })
  // consumed buffer rows are gone from the calendar; keep fixed rows where they are
  for (const b of consumedBuffers) shifts[b.date] = 'unscheduled'
  for (const f of fixed) if (f.eff !== f.date) shifts[f.date] = f.eff!
  // rows before today that we did not touch keep their existing override
  for (const x of rows) if (!movable.includes(x) && !consumedBuffers.includes(x) && !fixed.includes(x) && x.eff !== x.date) shifts[x.date] = x.eff ?? 'unscheduled'
  return { debt, moves, consumedBuffers, unscheduled, shifts }
}
