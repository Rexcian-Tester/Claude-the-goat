import { planDays, PLAN_LAST, type PlanDay, type PlanItem } from '../data/plan'
import { allChapters } from '../data/catalog'
import type { Kind } from '../data/types'
import { applyEdits, type PlanEdits } from './planEdits'

/** original date -> effective date, or 'unscheduled' (didn't fit before 15 Dec). Empty = original plan. */
export type Shifts = Record<string, string>

export interface Row extends PlanDay {
  /** effective date; null when unscheduled */
  eff: string | null
}
export interface EffSlot {
  date: string // effective
  dayNo: number
  item: PlanItem
  kind: Kind
  row: Row
}
export interface Schedule {
  rows: Row[]
  byEff: Map<string, Row>
  byOrig: Map<string, Row>
  slots: Map<string, EffSlot[]>
  /** study days that no longer fit before 15 Dec */
  unscheduled: Row[]
  /** catch-up days used up by a shift */
  absorbed: Row[]
  shifted: boolean
}

export function buildSchedule(shifts: Shifts | undefined, edits?: PlanEdits): Schedule {
  const sh = shifts ?? {}
  const rows: Row[] = applyEdits(planDays, edits).map((d) => {
    const o = sh[d.date]
    return { ...d, eff: o === undefined ? d.date : o === 'unscheduled' ? null : o }
  })
  const byEff = new Map<string, Row>()
  const byOrig = new Map<string, Row>()
  for (const r of rows) {
    byOrig.set(r.date, r)
    if (r.eff) byEff.set(r.eff, r)
  }
  const slots = new Map<string, EffSlot[]>(allChapters.map((c) => [c.id, []]))
  for (const r of [...rows].sort((a, b) => (a.eff ?? '9999').localeCompare(b.eff ?? '9999')))
    if (r.eff) for (const it of r.items) for (const c of it.chapters) slots.get(c.id)!.push({ date: r.eff, dayNo: r.dayNo, item: it, kind: it.k, row: r })
  return { rows, byEff, byOrig, slots, unscheduled: rows.filter((r) => r.eff === null && !r.isBuffer), absorbed: rows.filter((r) => r.eff === null && r.isBuffer), shifted: Object.keys(sh).length > 0 }
}

let lastKey: [Shifts | undefined, PlanEdits | undefined] | null = null
let lastVal: Schedule | null = null
export function scheduleFor(shifts: Shifts | undefined, edits?: PlanEdits): Schedule {
  if (lastVal && lastKey && lastKey[0] === shifts && lastKey[1] === edits) return lastVal
  lastKey = [shifts, edits]
  lastVal = buildSchedule(shifts, edits)
  return lastVal
}
export const LAST_STUDY_DATE = PLAN_LAST
