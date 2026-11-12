// The Exam tab's routine: site-source/data/exam-schedule.json, with your own edits laid over it. Edits are saved
// whole in one synced field (plan:examsched) and the version before the last change in plan:examsched:prev (Undo).
import { K } from '../logic/keys'
import { store } from '../store/store'
import { scheduleData } from './load'
import type { ExamRow } from './types'

export const HUB_URL = scheduleData.site
export const scheduleNote = scheduleData.note
export const defaultRows: ExamRow[] = scheduleData.rows

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
interface Saved { rows: ExamRow[]; at: number }
const clean = (r: unknown): ExamRow | null => {
  if (!r || typeof r !== 'object') return null
  const x = r as Record<string, unknown>
  if (typeof x.id !== 'string' || typeof x.date !== 'string' || !DATE_RE.test(x.date) || typeof x.title !== 'string') return null
  const s = (k: string) => (typeof x[k] === 'string' ? (x[k] as string) : '')
  return { id: x.id, date: x.date, no: s('no'), title: x.title, sub: s('sub'), len: s('len'), ...(x.real === true ? { real: true } : {}), ...(s('status') ? { status: s('status') } : {}) }
}
function read(key: string): Saved | null {
  const v = store.field(key)?.v as Partial<Saved> | null | undefined
  if (!v || !Array.isArray(v.rows)) return null
  return { rows: v.rows.map(clean).filter((x): x is ExamRow => !!x), at: typeof v.at === 'number' ? v.at : 0 }
}
/** In date order (same-day rows keep their order). */
export const sortRows = (rows: ExamRow[]) => rows.map((r, i) => [r, i] as const).sort((a, b) => a[0].date.localeCompare(b[0].date) || a[1] - b[1]).map(([r]) => r)
/** The schedule as shown: your saved edits, else the file. */
export const scheduleRows = (): ExamRow[] => sortRows(read(K.examSched)?.rows ?? defaultRows)
export const isEdited = () => read(K.examSched) !== null
/** an earlier version to go back to (Undo after Undo puts the change back) */
export const canUndo = () => store.field(K.examSchedPrev) !== undefined

/** Save a new schedule; the one before it becomes Undo. Syncs to your other devices. */
export function saveRows(rows: ExamRow[]) {
  store.setMany([
    [K.examSchedPrev, store.field(K.examSched)?.v ?? null],
    [K.examSched, { rows: sortRows(rows), at: Date.now() } satisfies Saved],
  ])
}
export const upsertRow = (row: ExamRow) => {
  const rows = scheduleRows()
  const i = rows.findIndex((r) => r.id === row.id)
  saveRows(i < 0 ? [...rows, row] : rows.map((r) => (r.id === row.id ? row : r)))
}
export const deleteRow = (id: string) => saveRows(scheduleRows().filter((r) => r.id !== id))
/** Back to the version before the last change. */
export function undoLast() {
  const prev = store.field(K.examSchedPrev)?.v ?? null
  store.setMany([
    [K.examSchedPrev, store.field(K.examSched)?.v ?? null],
    [K.examSched, prev],
  ])
}
/** Back to the file's schedule (Undo brings your edits back). */
export function resetToFile() {
  store.setMany([
    [K.examSchedPrev, store.field(K.examSched)?.v ?? null],
    [K.examSched, null],
  ])
}
export const newId = () => `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** The Hub link. On Android an intent link opens the installed Model Test Hub app (its home-screen app) if there
 *  is one, and falls back to the website; elsewhere a normal link in a new tab. */
export function hubHref(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  if (!/Android/i.test(ua)) return HUB_URL
  const u = new URL(HUB_URL)
  return `intent://${u.host}${u.pathname}#Intent;scheme=https;S.browser_fallback_url=${encodeURIComponent(HUB_URL)};end`
}
