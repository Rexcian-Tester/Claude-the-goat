// Pure, dependency-free merge logic. Shared by the browser and the Cloudflare Pages Function.
// The document is a flat map of last-write-wins registers, ordered by (t, c, d):
// wall-clock ms, logical counter, device id. Merge is per-field max, so it is
// commutative, associative and idempotent: devices converge in any sync order.

export interface Field {
  v: unknown // null = deleted
  t: number
  c: number
  d: string
}
export type Fields = Record<string, Field>
export interface Doc {
  v: 1
  fields: Fields
}

export const emptyDoc = (): Doc => ({ v: 1, fields: {} })

/** true if a strictly beats b */
export function beats(a: Field, b: Field): boolean {
  if (a.t !== b.t) return a.t > b.t
  if (a.c !== b.c) return a.c > b.c
  return a.d > b.d
}

export interface MergeResult {
  doc: Doc
  /** keys where the remote field replaced a *different* local value */
  overwrittenLocal: string[]
  /** keys the remote had that local lacked, or where remote won */
  changedKeys: string[]
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function mergeDocs(local: Doc, remote: Doc): MergeResult {
  const out: Fields = { ...local.fields }
  const overwrittenLocal: string[] = []
  const changedKeys: string[] = []
  for (const [k, r] of Object.entries(remote.fields)) {
    const l = out[k]
    if (!l) {
      out[k] = r
      changedKeys.push(k)
    } else if (beats(r, l)) {
      if (!same(l.v, r.v)) overwrittenLocal.push(k)
      out[k] = r
      changedKeys.push(k)
    }
  }
  return { doc: { v: 1, fields: out }, overwrittenLocal, changedKeys }
}

/** Hybrid logical clock so a device with a slow clock still orders after what it has seen. */
export class Clock {
  t = 0
  c = 0
  constructor(public device: string) {}
  tick(now: number = Date.now()): { t: number; c: number; d: string } {
    if (now > this.t) {
      this.t = now
      this.c = 0
    } else this.c++
    return { t: this.t, c: this.c, d: this.device }
  }
  observe(f: { t: number; c: number }) {
    if (f.t > this.t || (f.t === this.t && f.c > this.c)) {
      this.t = f.t
      this.c = f.c
    }
  }
}

/* ---------- validation (server side, also used on import) ---------- */
const KEY_RE = /^(task|task-moved|day|refl|q|sub|ch|plan|endgame|note):[^\s]{1,190}$/u
export const MAX_FIELDS = 20000
export const MAX_VALUE_CHARS = 200_000

export function parseDoc(x: unknown): Doc | null {
  if (!x || typeof x !== 'object') return null
  const o = x as { v?: unknown; fields?: unknown }
  if (o.v !== 1 || !o.fields || typeof o.fields !== 'object' || Array.isArray(o.fields)) return null
  const entries = Object.entries(o.fields as Record<string, unknown>)
  if (entries.length > MAX_FIELDS) return null
  const fields: Fields = {}
  for (const [k, f] of entries) {
    if (!KEY_RE.test(k) || !f || typeof f !== 'object') return null
    const { v, t, c, d } = f as Record<string, unknown>
    if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t > 8.64e15) return null
    if (typeof c !== 'number' || !Number.isInteger(c) || c < 0) return null
    if (typeof d !== 'string' || d.length < 1 || d.length > 64) return null
    if (JSON.stringify(v === undefined ? null : v).length > MAX_VALUE_CHARS) return null
    fields[k] = { v: v === undefined ? null : v, t, c, d }
  }
  return { v: 1, fields }
}
