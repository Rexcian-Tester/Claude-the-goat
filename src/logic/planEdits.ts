// Your own changes to the plan: topics moved to another day, or split into parts (each part with its own day,
// its own subtopics and a note). The study plan JSON is never touched; these edits are laid over it, synced like
// the rest of your progress, and can be undone or reset at any time.
//
// Ticks belong to the topic (`task:<original date>:<item>:<subtopic>`), so they follow a moved or split topic.
// A subtopic can sit in more than one part (e.g. "speed graph" today, "velocity graph" on Friday): the first part
// that has it keeps the original tick, every other copy gets its own (`…:<subtopic>:<part id>`).
import type { PlanDay, PlanItem } from '../data/plan'

export interface EditPart {
  id: string
  /** the plan day it sits on, by that day's original date (it follows the day if the schedule is shifted) */
  row: string
  /** subtopic indexes of the original topic, in the order shown */
  subs: number[]
  note?: string
}
export interface PlanEdits {
  v: 1
  topics: Record<string, { parts: EditPart[] }>
  /** the order you dragged a day's topics into: plan day (original date) -> topic keys, top first */
  order?: Record<string, string[]>
}
export const EMPTY_EDITS: PlanEdits = { v: 1, topics: {} }
export const isEmptyEdits = (e: PlanEdits | undefined) => !e || (Object.keys(e.topics).length === 0 && Object.keys(e.order ?? {}).length === 0)

/** Put a day's topics in this order (keys as shown on the day, top first). */
export function setOrder(edits: PlanEdits | undefined, row: string, keys: string[]): PlanEdits {
  const e = edits ?? EMPTY_EDITS
  return { ...e, order: { ...(e.order ?? {}), [row]: [...keys] } }
}

const srcDate = (src: string) => src.slice(0, 10)
const allSubs = (n: number) => Array.from({ length: n }, (_, i) => i)

/** The parts a topic is in now: one implicit part (id '0') on its own day when it was never edited. */
export function partsOf(edits: PlanEdits | undefined, src: string, nSubs: number): EditPart[] {
  return edits?.topics[src]?.parts ?? [{ id: '0', row: srcDate(src), subs: allSubs(nSubs) }]
}

function newId(taken: string[]): string {
  for (;;) {
    const id = Math.random().toString(36).slice(2, 6)
    if (id && !taken.includes(id)) return id
  }
}

/** Store a topic's parts, dropping the entry when it is back to exactly the original. */
function withParts(edits: PlanEdits | undefined, src: string, nSubs: number, parts: EditPart[]): PlanEdits {
  const topics = { ...(edits ?? EMPTY_EDITS).topics }
  const original =
    parts.length === 1 && parts[0].row === srcDate(src) && !parts[0].note && parts[0].subs.length === nSubs && parts[0].subs.every((s, i) => s === i)
  if (original) delete topics[src]
  else topics[src] = { parts }
  return { ...(edits ?? EMPTY_EDITS), v: 1, topics }
}

/** Move one part (or a whole unedited topic) to another plan day, and/or change its note. */
export function movePart(edits: PlanEdits | undefined, src: string, nSubs: number, pid: string, row: string, note: string): PlanEdits {
  const parts = partsOf(edits, src, nSubs).map((p) => (p.id === pid ? { ...p, row, note: note.trim() || undefined } : p))
  return withParts(edits, src, nSubs, parts)
}

/** Replace one part with several new ones (each with its own day, subtopics and note). */
export function splitPart(edits: PlanEdits | undefined, src: string, nSubs: number, pid: string, into: { row: string; subs: number[]; note: string }[]): PlanEdits {
  const old = partsOf(edits, src, nSubs)
  const at = old.findIndex((p) => p.id === pid)
  if (at < 0 || !into.length) return edits ?? EMPTY_EDITS
  const taken = old.map((p) => p.id)
  const fresh: EditPart[] = into.map((p, k) => {
    // the first new part keeps the old id, so its subtopics keep their ticks
    const id = k === 0 ? old[at].id : newId(taken)
    taken.push(id)
    return { id, row: p.row, subs: [...p.subs], note: p.note.trim() || undefined }
  })
  return withParts(edits, src, nSubs, [...old.slice(0, at), ...fresh, ...old.slice(at + 1)])
}

/** Put a topic back where the plan had it. */
export function resetTopic(edits: PlanEdits | undefined, src: string): PlanEdits {
  const topics = { ...(edits ?? EMPTY_EDITS).topics }
  delete topics[src]
  return { ...(edits ?? EMPTY_EDITS), v: 1, topics }
}

/** Tick key for subtopic `sub` in part `pid`: the original key for the first part holding it, else its own. */
export function tickKey(src: string, parts: EditPart[], pid: string, sub: number): string {
  const owner = parts.find((p) => p.subs.includes(sub))
  return owner && owner.id !== pid ? `task:${src}:${sub}:${pid}` : `task:${src}:${sub}`
}

/**
 * The plan with your edits laid over it. Days keep their identity; their topics change. A topic moved onto a day
 * is listed after the day's own topics. A day left with nothing becomes a free day (never owed); a free or
 * catch-up day that receives a topic becomes a study day.
 */
export function applyEdits(days: PlanDay[], edits: PlanEdits | undefined): PlanDay[] {
  if (isEmptyEdits(edits)) return days
  const valid = new Set(days.map((d) => d.date))
  const placed = new Map<string, { order: [number, string, number, number]; item: PlanItem }[]>()
  const touched = new Set<string>()
  const put = (row: string, order: [number, string, number, number], item: PlanItem) => {
    if (!placed.has(row)) placed.set(row, [])
    placed.get(row)!.push({ order, item })
  }
  for (const d of days)
    for (const it of d.items) {
      const e = edits!.topics?.[it.key]
      if (!e) {
        put(d.date, [0, d.date, it.itemIdx, 0], it)
        continue
      }
      touched.add(d.date)
      const parts = e.parts
      parts.forEach((p, k) => {
        const row = valid.has(p.row) ? p.row : d.date
        touched.add(row)
        const subs = p.subs.filter((s) => s >= 0 && s < it.topicList.length)
        const topicList = subs.map((s) => it.topicList[s])
        put(row, [row === d.date ? 0 : 1, d.date, it.itemIdx, k], {
          ...it,
          key: `${it.key}#${p.id}`,
          topicList,
          t: topicList.join(' · '),
          tks: subs.map((s) => tickKey(it.key, parts, p.id, s)),
          subs,
          src: it.key,
          pid: p.id,
          partNo: parts.length > 1 ? k + 1 : undefined,
          parts: parts.length > 1 ? parts.length : undefined,
          editNote: p.note,
        })
      })
    }
  const cmp = (a: [number, string, number, number], b: [number, string, number, number]) => a[0] - b[0] || a[1].localeCompare(b[1]) || a[2] - b[2] || a[3] - b[3]
  const order = edits!.order ?? {}
  for (const k of Object.keys(order)) if (valid.has(k)) touched.add(k)
  return days.map((d) => {
    if (!touched.has(d.date)) return d
    let items = (placed.get(d.date) ?? []).sort((a, b) => cmp(a.order, b.order)).map((x) => x.item)
    // your own order first; topics it doesn't mention (added later) keep their place after
    const want = order[d.date]
    if (want) {
      const pos = (it: PlanItem) => {
        const i = want.indexOf(it.key)
        return i < 0 ? want.length : i
      }
      items = items.map((it, i) => [it, i] as const).sort((a, b) => pos(a[0]) - pos(b[0]) || a[1] - b[1]).map(([it]) => it)
    }
    return {
      ...d,
      items,
      isBuffer: items.every((x) => x.k === 'buf'),
      isFree: items.length === 0,
      taskCount: items.reduce((n, x) => n + x.topicList.length, 0),
    }
  })
}

/* ---------- version history ---------- */
export interface PlanVersion {
  at: number
  /** what the change was (this version is how the plan looked just before it) */
  label: string
  edits: PlanEdits
  /** 'undo' when the change was an "Undo last change" (older versions have no kind: an edit) */
  kind?: 'edit' | 'undo' | 'restore'
}
export const HISTORY_KEEP = 30
/** The whole synced document must stay under the server's 3 MB, so edits and their history get a budget. */
export const EDITS_MAX_CHARS = 60_000
export const HISTORY_MAX_CHARS = 900_000

/** What "Undo last change" goes back to: repeated undos keep walking back instead of undoing the undo. */
export function undoTarget(history: PlanVersion[]): PlanVersion | null {
  let skip = 0
  for (const h of [...history].sort((a, b) => b.at - a.at)) {
    if (h.kind === 'undo') skip++
    else if (skip > 0) skip--
    else return h
  }
  return null
}

/** The version to restore to undo everything changed in the last `ms` (default 24 hours), or null. */
export function versionBefore(history: PlanVersion[], now: number, ms = 24 * 3600000): PlanVersion | null {
  const recent = history.filter((h) => h.at >= now - ms).sort((a, b) => a.at - b.at)
  return recent[0] ?? null
}

/** Default even split of a topic's subtopics into n parts; with more parts than subtopics, they repeat. */
export function evenSplit(subs: number[], n: number): number[][] {
  if (!subs.length) return Array.from({ length: n }, () => [])
  if (n >= subs.length) return Array.from({ length: n }, (_, k) => [subs[k % subs.length]])
  const out: number[][] = []
  let i = 0
  for (let k = 0; k < n; k++) {
    const size = Math.floor(subs.length / n) + (k < subs.length % n ? 1 : 0)
    out.push(subs.slice(i, i + size))
    i += size
  }
  return out
}
