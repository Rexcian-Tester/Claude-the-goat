// The daily Routine: block times in Bangladesh time. Pure (no React, no storage), so the Study Blocks logic and the
// Pages Functions (functions/api/companion.ts) can use it. The Routine view (src/views/Routine.tsx) shows it.
import { todayISO, weekdayIndex } from '../data/dhaka'

export type Kind = 'wake' | 'study' | 'break' | 'sleep'
export interface Block {
  id: string
  /** minutes after midnight, Asia/Dhaka */
  from: number
  to: number
  label: string
  kind: Kind
  /** a short line under the label */
  note?: string
}
const hm = (h: number, m = 0) => h * 60 + m
/** Saturday to Thursday: a full study day. Sleep runs past midnight into the next morning.
 *  Block ids stay the same over time (study-a…d, breakfast, lunch, refresh, checkin), so past ticks, late starts
 *  and study time keep matching. */
export const ROUTINE: Block[] = [
  { id: 'wake', from: hm(3, 30), to: hm(4), label: 'Wake up', kind: 'wake' },
  { id: 'study-a', from: hm(4), to: hm(7, 30), label: 'Study Block A', kind: 'study' },
  { id: 'breakfast', from: hm(7, 30), to: hm(9), label: 'Breakfast & shower', kind: 'break' },
  { id: 'study-b', from: hm(9), to: hm(13), label: 'Study Block B & Revision', kind: 'study', note: 'Last hour = revision' },
  { id: 'lunch', from: hm(13), to: hm(14), label: 'Lunch & nap', kind: 'break', note: '25-min nap' },
  { id: 'study-c', from: hm(14), to: hm(16), label: 'Study Block C', kind: 'study' },
  { id: 'refresh', from: hm(16), to: hm(17, 30), label: 'Refresh', kind: 'break' },
  { id: 'study-d', from: hm(17, 30), to: hm(20, 30), label: 'Study Block D', kind: 'study' },
  { id: 'checkin', from: hm(20, 30), to: hm(21), label: 'Check-in & wind down', kind: 'break' },
  { id: 'sleep', from: hm(21), to: hm(3, 30), label: 'Sleep', kind: 'sleep' },
]

/** Friday: the same day, with Study Block B ending at 12:30, Jumu'ah 12:30–2:30 and Study Block C from 2:30 to 4:00. */
export const FRIDAY: Block[] = ROUTINE.flatMap((b): Block[] => {
  if (b.id === 'study-b') return [{ ...b, to: hm(12, 30) }]
  if (b.id === 'lunch') return [{ id: 'jumuah', from: hm(12, 30), to: hm(14, 30), label: "Jumu'ah prayer & lunch", kind: 'break' }]
  if (b.id === 'study-c') return [{ ...b, from: hm(14, 30) }]
  if (b.id === 'study-d') return [{ ...b, note: 'Weekly recovery: catch up anything that slipped this week.' }]
  return [b]
})
/** The routine for a date (Asia/Dhaka): Friday has its own. */
export const routineFor = (date: string = todayISO()): Block[] => (weekdayIndex(date) === 5 ? FRIDAY : ROUTINE)
export type { Block as RoutineBlock }

/** block that covers a minute of the day */
export function blockAt(min: number, date: string = todayISO()): Block {
  return routineFor(date).find((b) => (b.from < b.to ? min >= b.from && min < b.to : min >= b.from || min < b.to))!
}
