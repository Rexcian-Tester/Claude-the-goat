// Exam dates from the owner's Model Test Hub: https://model-test-hub.pages.dev/data/catalog.js
// ("window.CAT={…};"). The text is read as JSON after taking off "window.CAT=" and the final ";", never run as
// code. Read when the app opens and whenever you come back to it; the last good copy is kept on this device so
// the Exam tab still has the hub's dates offline. A copy that looks broken is ignored (the last good one stays).
import { useEffect, useSyncExternalStore } from 'react'
import type { ExamRow } from './types'

export const HUB_CATALOG_URL = 'https://model-test-hub.pages.dev/data/catalog.js'
const LS = 'mist-hub-catalog'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface HubExam { id: string; n: string; title: string; kind: string; date: string; debt: string }
export interface HubCatalog {
  exams: HubExam[]
  /** when this copy was read (ms) */
  at: number
  /** our exam id → hub exam id, kept once found so a later title change on the hub doesn't break the link */
  links: Record<string, string>
}

/** The hub's exams from catalog.js text, or null if it doesn't look right. */
export function parseCatalog(text: string): HubExam[] | null {
  let s = text.trim()
  const m = /^window\.CAT\s*=\s*/.exec(s)
  if (!m) return null
  s = s.slice(m[0].length).trim()
  if (s.endsWith(';')) s = s.slice(0, -1).trim()
  let data: unknown
  try {
    data = JSON.parse(s)
  } catch {
    return null
  }
  const list = data && typeof data === 'object' ? (data as { exams?: unknown }).exams : undefined
  if (!Array.isArray(list) || list.length === 0) return null
  const out: HubExam[] = []
  const ids = new Set<string>()
  for (const x of list) {
    if (!x || typeof x !== 'object') return null
    const r = x as Record<string, unknown>
    const id = typeof r.id === 'string' || typeof r.id === 'number' ? String(r.id) : ''
    const title = typeof r.title === 'string' ? r.title : ''
    const date = typeof r.date === 'string' ? r.date.trim() : ''
    const debt = typeof r.debt === 'string' ? r.debt.trim() : ''
    if (!id || !title || ids.has(id)) return null
    if ((date && !DATE_RE.test(date)) || (debt && !DATE_RE.test(debt))) return null
    ids.add(id)
    out.push({ id, n: r.n == null ? '' : String(r.n).trim(), title, kind: typeof r.kind === 'string' ? r.kind : '', date, debt })
  }
  // most exams must have a date (or a debt deadline): an almost empty list is treated as broken
  if (out.filter((e) => e.date || e.debt).length < Math.ceil(out.length / 2)) return null
  return out
}

/* ---------- linking our rows to hub exams (by hub id, found once by number + title + Written/MCQ) ---------- */
const norm = (s: string) => s.toLowerCase().replace(/[\s·\-–—:|,.()]+/g, '')
const kindOf = (s: string): '' | 'w' | 'm' => {
  const t = s.toLowerCase()
  const w = /written|লিখিত/.test(t)
  const m = /mcq/.test(t)
  return w && !m ? 'w' : m && !w ? 'm' : ''
}
const fits = (a: '' | 'w' | 'm', b: '' | 'w' | 'm') => !a || !b || a === b
/** Our exam id → hub exam id. Known links are kept while the hub still has that id; the rest are matched by
 *  number and title (and Written / MCQ where both say), in order, each hub exam used once. Real exams never link. */
export function linkRows(rows: ExamRow[], hub: HubExam[], known: Record<string, string> = {}): Record<string, string> {
  const byId = new Map(hub.map((h) => [h.id, h]))
  const links: Record<string, string> = {}
  const used = new Set<string>()
  for (const r of rows) {
    const h = known[r.id]
    if (!r.real && h && byId.has(h) && !used.has(h)) (links[r.id] = h), used.add(h)
  }
  const passes: ((r: ExamRow, h: HubExam) => boolean)[] = [
    (r, h) => norm(r.no) === norm(h.n) && norm(r.title) === norm(h.title) && fits(kindOf(r.sub), kindOf(h.kind)),
    (r, h) => norm(r.title) === norm(h.title) && fits(kindOf(r.sub), kindOf(h.kind)),
  ]
  for (const ok of passes) {
    for (const r of rows) {
      if (r.real || links[r.id]) continue
      const h = hub.find((x) => !used.has(x.id) && ok(r, x))
      if (h) (links[r.id] = h.id), used.add(h.id)
    }
  }
  return links
}

/** The rows as shown: each linked exam takes the hub's date (or its Debt deadline), unless you moved it yourself
 *  (`mine`). A linked exam the hub has with no date and no debt is left out. Real exams and exams you added stay
 *  as they are. Hub exams with no match here are added. */
export function applyHub(rows: ExamRow[], hub: HubExam[], links: Record<string, string>, gone: string[] = []): ExamRow[] {
  const byId = new Map(hub.map((h) => [h.id, h]))
  const out: ExamRow[] = []
  for (const r of rows) {
    const h = links[r.id] ? byId.get(links[r.id]) : undefined
    if (!h || r.real || r.mine) {
      out.push(r)
      continue
    }
    if (h.date) out.push(withDate(r, h.date, false))
    else if (h.debt) out.push(withDate(r, h.debt, true))
  }
  const linked = new Set(Object.values(links))
  for (const h of hub) {
    if (linked.has(h.id) || gone.includes(h.id) || (!h.date && !h.debt)) continue
    const k = kindOf(h.kind)
    out.push(withDate({ id: `hub-${h.id}`, date: '', no: h.n, title: h.title, sub: k === 'w' ? 'Written' : k === 'm' ? 'MCQ' : h.kind, len: '' }, h.date || h.debt, !h.date))
  }
  return out
}
const withDate = (r: ExamRow, date: string, debt: boolean): ExamRow => {
  const x: ExamRow = { ...r, date }
  if (debt) x.debt = true
  else delete x.debt
  return x
}

/* ---------- the copy on this device ---------- */
function load(): HubCatalog | null {
  try {
    const v = JSON.parse(localStorage.getItem(LS) ?? 'null') as HubCatalog | null
    return v && Array.isArray(v.exams) && v.exams.length ? { exams: v.exams, at: v.at ?? 0, links: v.links ?? {} } : null
  } catch {
    return null
  }
}
let current: HubCatalog | null = typeof localStorage !== 'undefined' ? load() : null
export type HubStatus = 'idle' | 'loading' | 'ok' | 'offline' | 'broken'
let status: HubStatus = 'idle'
const listeners = new Set<() => void>()
let snap: { catalog: HubCatalog | null; status: HubStatus } = { catalog: current, status }
const emit = () => {
  snap = { catalog: current, status }
  listeners.forEach((l) => l())
}
/** Keep the link table up to date for the current rows (saved on this device only). */
export function rememberLinks(links: Record<string, string>) {
  if (!current) return
  const same = Object.keys(links).length === Object.keys(current.links).length && Object.entries(links).every(([k, v]) => current!.links[k] === v)
  if (same) return
  current = { ...current, links }
  try {
    localStorage.setItem(LS, JSON.stringify(current))
  } catch {
    /* storage full or blocked: links are found again next time */
  }
}
/** the last good copy and how the last read went (for the view and tests) */
export const hubSnapshot = () => snap
let inflight: Promise<void> | null = null
/** Read the hub's catalog now (at most one request at a time). */
export function refreshHub(): Promise<void> {
  if (inflight) return inflight
  status = 'loading'
  emit()
  inflight = (async () => {
    try {
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), 12000)
      const res = await fetch(`${HUB_CATALOG_URL}?t=${Date.now()}`, { cache: 'no-store', signal: ctl.signal })
      clearTimeout(t)
      const exams = res.ok ? parseCatalog(await res.text()) : null
      if (!exams) {
        status = 'broken'
        return
      }
      current = { exams, at: Date.now(), links: current?.links ?? {} }
      try {
        localStorage.setItem(LS, JSON.stringify(current))
      } catch {
        /* keep it in memory */
      }
      status = 'ok'
    } catch {
      status = 'offline'
    } finally {
      inflight = null
      emit()
    }
  })()
  return inflight
}
let started = false
/** Read the hub when the app opens and whenever you come back to it (or the internet comes back). Once per page. */
export function startHubSync() {
  if (started || typeof window === 'undefined') return
  started = true
  void refreshHub()
  const back = () => document.visibilityState === 'visible' && void refreshHub()
  addEventListener('visibilitychange', back)
  addEventListener('online', back)
}
/** The hub's last good catalog and how the last read went. */
export function useHubCatalog() {
  useEffect(() => startHubSync(), [])
  return useSyncExternalStore((fn) => (listeners.add(fn), () => listeners.delete(fn)), () => snap)
}
