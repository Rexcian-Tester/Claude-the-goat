// The Exam tab's routine: site-source/data/exam-schedule.json, with your own edits laid over it. Edits are saved
// whole in one synced field (plan:examsched) and the version before the last change in plan:examsched:prev (Undo).
import { K } from '../logic/keys'
import { store } from '../store/store'
import { scheduleData } from './load'
import { applyHub, linkRows, rememberLinks, type HubCatalog } from './hubCatalog'
import type { ExamRow } from './types'

export const HUB_URL = scheduleData.site
export const scheduleNote = scheduleData.note
export const defaultRows: ExamRow[] = scheduleData.rows

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const SCHEDULE_VERSION = scheduleData.version
/** v: the schedule version it was saved under (none = before v5) */
/** added: the later-added exams this copy has had (so one you delete stays deleted) */
/** hubGone: Model Test Hub exams you deleted here (so they aren't added back from the hub) */
interface Saved { rows: ExamRow[]; at: number; v?: number; added?: string[]; hubGone?: string[] }
const clean = (r: unknown): ExamRow | null => {
  if (!r || typeof r !== 'object') return null
  const x = r as Record<string, unknown>
  if (typeof x.id !== 'string' || typeof x.date !== 'string' || !DATE_RE.test(x.date) || typeof x.title !== 'string') return null
  const s = (k: string) => (typeof x[k] === 'string' ? (x[k] as string) : '')
  return { id: x.id, date: x.date, no: s('no'), title: x.title, sub: s('sub'), len: s('len'), ...(x.real === true ? { real: true } : {}), ...(s('status') ? { status: s('status') } : {}), ...(x.debt === true ? { debt: true } : {}), ...(x.mine === true ? { mine: true } : {}) }
}
const migrate = (r: ExamRow): ExamRow => {
  const m = scheduleData.moves[r.id]
  const out: ExamRow = { ...r, date: m.date }
  if (m.status && !r.status) out.status = m.status
  if (m.debt) out.debt = true
  else delete out.debt
  return out
}
function read(key: string): Saved | null {
  const v = store.field(key)?.v as Partial<Saved> | null | undefined
  if (!v || !Array.isArray(v.rows)) return null
  let rows = v.rows.map(clean).filter((x): x is ExamRow => !!x)
  // saved before the current version (e.g. v4): move each built-in exam to its new date, keeping your statuses;
  // nothing is written until your next change, so Undo still holds the copy as you left it
  if (v.v !== SCHEDULE_VERSION) rows = rows.map((r) => (scheduleData.moves[r.id] ? migrate(r) : r))
  const had = Array.isArray(v.added) ? v.added : []
  for (const id of scheduleData.added) {
    if (had.includes(id) || rows.some((r) => r.id === id)) continue
    const row = defaultRows.find((r) => r.id === id)
    if (row) rows.push(row)
  }
  // a built-in exam whose saved date differs from the file's was moved by you: it keeps your date over the hub's
  const file = new Map(defaultRows.map((r) => [r.id, r.date]))
  rows = rows.map((r) => (!r.mine && file.has(r.id) && file.get(r.id) !== r.date ? { ...r, mine: true } : r))
  return { rows, at: typeof v.at === 'number' ? v.at : 0, v: SCHEDULE_VERSION, hubGone: Array.isArray(v.hubGone) ? v.hubGone.filter((x): x is string => typeof x === 'string') : [] }
}
/** In date order (same-day rows keep their order). */
export const sortRows = (rows: ExamRow[]) => rows.map((r, i) => [r, i] as const).sort((a, b) => a[0].date.localeCompare(b[0].date) || a[1] - b[1]).map(([r]) => r)
/** The schedule as shown: your saved edits, else the file. */
export const scheduleRows = (): ExamRow[] => sortRows(read(K.examSched)?.rows ?? defaultRows)
export const isEdited = () => read(K.examSched) !== null
/** an earlier version to go back to (Undo after Undo puts the change back) */
export const canUndo = () => store.field(K.examSchedPrev) !== undefined

/** Save a new schedule; the one before it becomes Undo. Syncs to your other devices. */
export function saveRows(rows: ExamRow[], hubGone: string[] = read(K.examSched)?.hubGone ?? []) {
  store.setMany([
    [K.examSchedPrev, store.field(K.examSched)?.v ?? null],
    [K.examSched, { rows: sortRows(rows), at: Date.now(), v: SCHEDULE_VERSION, added: scheduleData.added, hubGone } satisfies Saved],
  ])
}
export const upsertRow = (row: ExamRow) => {
  const rows = scheduleRows()
  const i = rows.findIndex((r) => r.id === row.id)
  saveRows(i < 0 ? [...rows, row] : rows.map((r) => (r.id === row.id ? row : r)))
}
/** Delete an exam; one that came from the Model Test Hub (or is linked to it) is remembered, so the hub doesn't add it back. */
export const deleteRow = (id: string, hubId?: string) => {
  const gone = read(K.examSched)?.hubGone ?? []
  saveRows(scheduleRows().filter((r) => r.id !== id), hubId && !gone.includes(hubId) ? [...gone, hubId] : gone)
}
/** Save an exam edited on screen. If you changed its date it becomes yours (keeps your date over the hub's);
 *  otherwise only your other changes are saved and its date keeps following the hub. */
export function saveEdited(edited: ExamRow, shown: ExamRow) {
  const base = scheduleRows().find((r) => r.id === edited.id)
  const out: ExamRow = { ...edited }
  if (edited.date === shown.date && !!edited.debt === !!shown.debt && !shown.mine) {
    if (base) {
      out.date = base.date
      if (base.debt) out.debt = true
      else delete out.debt
    }
    delete out.mine
  } else out.mine = true
  upsertRow(out)
}

/** The schedule as shown on the Exam tab: your copy with the Model Test Hub's dates laid over it (last good copy
 *  when offline). Returns the hub id each exam is linked to as well. */
export function shownRows(catalog: HubCatalog | null): { rows: ExamRow[]; hubOf: Record<string, string> } {
  const base = scheduleRows()
  if (!catalog) return { rows: base, hubOf: {} }
  const links = linkRows(base, catalog.exams, catalog.links)
  rememberLinks(links)
  const hubOf: Record<string, string> = { ...links }
  const rows = sortRows(applyHub(base, catalog.exams, links, read(K.examSched)?.hubGone ?? []))
  for (const r of rows) if (r.id.startsWith('hub-')) hubOf[r.id] = r.id.slice(4)
  return { rows, hubOf }
}
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
