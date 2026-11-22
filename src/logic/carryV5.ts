// Plan v6 gave the moved topics new keys. What you saved on them under Plan v5 is read through the map in
// site-source/data/plan-v5-topics.json (v6 topic -> the v5 micro-task each of its micro-tasks was).
// Nothing is rewritten: the old fields stay, and anything saved under v6 always wins (an undo too).
import { itemByKey } from '../data/plan'
import { v5Topics } from '../data/load'
import { K } from './keys'
import { tickKey, type EditPart, type PlanEdits } from './planEdits'
import type { Reader } from './reader'

interface OldTopic {
  src: string
  /** its micro-tasks here: the index it had in v5, and its tick key */
  tasks: { sub: number; tk: string }[]
}
const topics = new Map<string, OldTopic[]>()
const byMarkKey = new Map<string, OldTopic[]>()
const byMoveKey = new Map<string, string>()
for (const [key, was] of Object.entries(v5Topics)) {
  const old = new Map<string, OldTopic>()
  was.forEach((ref, i) => {
    const cut = ref.lastIndexOf(':')
    const src = ref.slice(0, cut)
    if (!old.has(src)) old.set(src, { src, tasks: [] })
    old.get(src)!.tasks.push({ sub: Number(ref.slice(cut + 1)), tk: itemByKey.get(key)!.tks[i] })
    byMoveKey.set(`task-moved:${key}:${i}`, `task-moved:${ref}`)
  })
  topics.set(key, [...old.values()])
  byMarkKey.set(K.topicMark(key), [...old.values()])
}

const untouched = (r: Reader, key: string) => r.get(key) === undefined && !r.has?.(key)

/** Due if any v5 part of the topic was marked Due; Done if one was marked Done and the others are done too. */
export function carriedMark(r: Reader, key: string): 'due' | 'done' | undefined {
  const old = byMarkKey.get(key)
  if (!old || !untouched(r, key)) return undefined
  const edits = r.get<PlanEdits>(K.edits)
  let anyDone = false
  let allDone = true
  for (const { src, tasks } of old) {
    const parts: EditPart[] = edits?.topics?.[src]?.parts ?? [{ id: '0', row: '', subs: tasks.map((t) => t.sub) }]
    for (const p of parts) {
      const mark = r.get<string>(K.topicMark(src, p.id))
      if (mark === 'due') return 'due'
      if (mark === 'done') anyDone = true
      else if (!tasks.filter((t) => p.subs.includes(t.sub)).every((t) => r.get<boolean>(tickKey(src, parts, p.id, t.sub, t.tk)))) allDone = false
    }
  }
  return anyDone && allDone ? 'done' : undefined
}

/** Only "cleared" carries: a v5 "moved to <date>" is replaced by the topic's v6 date. */
export function carriedCleared(r: Reader, key: string): 'cleared' | undefined {
  const old = byMoveKey.get(key)
  return old && untouched(r, key) && r.get<string>(old) === 'cleared' ? 'cleared' : undefined
}

/** When the value shown for this key was saved, if it is one carried from v5 (for "finished on" dates). */
export function carriedAt(r: Reader, key: string): number | undefined {
  if (carriedCleared(r, key)) return r.t(byMoveKey.get(key)!)
  if (!carriedMark(r, key)) return undefined
  const parts = r.get<PlanEdits>(K.edits)?.topics
  const times = byMarkKey.get(key)!.flatMap(({ src }) => (parts?.[src]?.parts ?? [{ id: '0' }]).map((p) => r.t(K.topicMark(src, p.id)) ?? 0))
  return Math.max(...times) || undefined
}

const cache = new WeakMap<PlanEdits, PlanEdits>()
/** Your v5 planner notes, on the topics' v6 days (v5 moves and splits are not replayed: the v6 dates win).
 *  `carried` is saved with your next plan change, so a note you remove afterwards stays removed. */
export function carryNotes(edits: PlanEdits | undefined): PlanEdits | undefined {
  if (!edits?.topics || edits.carried) return edits
  const hit = cache.get(edits)
  if (hit) return hit
  const next = { ...edits.topics }
  let changed = false
  for (const [key, old] of topics) {
    const notes = new Set(old.flatMap(({ src }) => edits.topics[src]?.parts.flatMap((p) => p.note ?? []) ?? []))
    if (!notes.size) continue
    const parts = next[key]?.parts ?? [{ id: '0', row: key.slice(0, 10), subs: itemByKey.get(key)!.topicList.map((_, i) => i) }]
    if (!parts.length || parts.some((p) => p.note)) continue
    next[key] = { parts: parts.map((p, i) => (i ? p : { ...p, note: [...notes].join(' · ') })) }
    changed = true
  }
  const out: PlanEdits = changed ? { ...edits, topics: next, carried: true } : edits
  cache.set(edits, out)
  return out
}
