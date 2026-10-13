// Watch sessions: the shape the watch sends, its validation, and where it lives in the progress document.
// Pure and dependency-light: shared by the browser and the Pages Function (functions/api/watch/sessions.ts).
import { dhakaDate } from '../data/dhaka'

/** A stretch of wall-clock time [from, to), in ms. */
export type Span = [number, number]

/** One focus session from the watch: its id (unique per session, so retries never count twice) and the
 *  stretches it was actually running (a pause splits a session into several parts). */
export interface WatchSession {
  id: string
  parts: Span[]
}

/** What the website keeps per imported watch session (synced like any other progress field). */
export interface WatchRecord {
  parts: Span[]
  src: 'watch'
}

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/
const MAX_PARTS = 50
const MAX_SESSION_MS = 12 * 3600000
export const KEEP_DAYS = 60

/** Validate one session as sent by the watch. Returns the cleaned session or the reason it was refused. */
export function parseSession(x: unknown, now: number): WatchSession | { error: string } {
  if (!x || typeof x !== 'object') return { error: 'not-an-object' }
  const { id, parts } = x as { id?: unknown; parts?: unknown }
  if (typeof id !== 'string' || !ID_RE.test(id)) return { error: 'bad-id' }
  if (!Array.isArray(parts) || parts.length < 1 || parts.length > MAX_PARTS) return { error: 'bad-parts' }
  const out: Span[] = []
  let total = 0
  for (const p of parts) {
    if (!Array.isArray(p) || p.length !== 2) return { error: 'bad-parts' }
    const [a, b] = p as unknown[]
    if (typeof a !== 'number' || typeof b !== 'number' || !Number.isInteger(a) || !Number.isInteger(b) || a >= b) return { error: 'bad-parts' }
    if (out.length && a < out[out.length - 1][1]) return { error: 'parts-overlap' }
    total += b - a
    out.push([a, b])
  }
  if (total > MAX_SESSION_MS) return { error: 'too-long' }
  if (out[0][0] < now - KEEP_DAYS * 86400000) return { error: 'too-old' }
  if (out[out.length - 1][1] > now + 10 * 60000) return { error: 'in-the-future' }
  return { id, parts: out }
}

/** The Dhaka calendar day a session counts on: the day it ended (as the website logs its own sessions). */
export const sessionDate = (s: { parts: Span[] }) => dhakaDate(s.parts[s.parts.length - 1][1])

/* ---------- keys in the progress document (the existing `day:` prefix, so every version of the site accepts them) ---------- */
export const watchKey = (date: string, id: string) => `day:${date}:watch:${id}`
export const WATCH_KEY_RE = /^day:(\d{4}-\d{2}-\d{2}):watch:([A-Za-z0-9_-]{6,64})$/
/** Study stretches this device logged with the Study Blocks timer (used only to spot overlap with the watch). */
export const spanKey = (date: string, device: string) => `day:${date}:span:${device}`
export const SPAN_KEY_RE = /^day:(\d{4}-\d{2}-\d{2}):span:[^\s:]{1,64}$/

/** New sessions as progress-field updates (sessions this device already has are skipped). */
export function importEntries(sessions: WatchSession[], has: (key: string) => boolean): [string, WatchRecord][] {
  const out: [string, WatchRecord][] = []
  for (const s of sessions) {
    const k = watchKey(sessionDate(s), s.id)
    if (!has(k) && !out.some(([x]) => x === k)) out.push([k, { parts: s.parts, src: 'watch' }])
  }
  return out
}

/* ---------- interval helpers ---------- */
/** Sorted, merged copy of a list of spans. */
export function union(spans: Span[]): Span[] {
  const s = spans.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0])
  const out: Span[] = []
  for (const [a, b] of s) {
    const last = out[out.length - 1]
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}
/** The parts of [from, to) not covered by `covered` (which must be sorted and merged). */
export function subtract([from, to]: Span, covered: Span[]): Span[] {
  const out: Span[] = []
  let t = from
  for (const [a, b] of covered) {
    if (b <= t) continue
    if (a >= to) break
    if (a > t) out.push([t, a])
    t = Math.max(t, b)
    if (t >= to) break
  }
  if (t < to) out.push([t, to])
  return out
}
/** Add [from, to) to a device's list of study stretches, joining it to the previous one when they touch. */
export function addSpan(list: Span[] | undefined, from: number, to: number): Span[] {
  return union([...(Array.isArray(list) ? list : []), [from, to]])
}
