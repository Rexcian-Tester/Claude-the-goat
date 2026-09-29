import { useSyncExternalStore } from 'react'
import { Clock, emptyDoc, mergeDocs, type Doc, type Field, type MergeResult } from '../sync/merge'
import { clearFields, loadAll, putFields, putMeta } from './idb'

type Listener = () => void

class Store {
  fields = new Map<string, Field>()
  dirty = new Set<string>()
  clock!: Clock
  deviceId = ''
  private listeners = new Set<Listener>()
  private localListeners = new Set<Listener>()
  private pending = new Map<string, Field>()
  private flushScheduled = false
  version = 0
  ready = false

  async init() {
    if (this.ready) return
    const { fields, meta } = await loadAll()
    for (const [k, f] of Object.entries(fields)) this.fields.set(k, f)
    this.deviceId = (meta.deviceId as string) || Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
    if (!meta.deviceId) void putMeta('deviceId', this.deviceId)
    this.dirty = new Set((meta.dirty as string[]) ?? [])
    this.clock = new Clock(this.deviceId)
    for (const f of this.fields.values()) this.clock.observe(f)
    this.ready = true
  }

  subscribe = (fn: Listener) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  /** fires only for edits made on this device (drives auto-sync) */
  onLocalChange(fn: Listener) {
    this.localListeners.add(fn)
    return () => this.localListeners.delete(fn)
  }
  private emit() {
    this.version++
    this.listeners.forEach((l) => l())
  }

  field(key: string): Field | undefined {
    return this.fields.get(key)
  }
  get<T>(key: string): T | undefined {
    const f = this.fields.get(key)
    return f && f.v !== null ? (f.v as T) : undefined
  }

  set(key: string, v: unknown) {
    this.setMany([[key, v]])
  }
  setMany(entries: [string, unknown][]) {
    for (const [key, v] of entries) {
      const stamp = this.clock.tick()
      const f: Field = { v: v === undefined ? null : v, ...stamp }
      this.fields.set(key, f)
      this.pending.set(key, f)
      this.dirty.add(key)
    }
    this.scheduleFlush()
    this.emit()
    this.localListeners.forEach((l) => l())
  }
  private scheduleFlush() {
    if (this.flushScheduled) return
    this.flushScheduled = true
    queueMicrotask(() => {
      this.flushScheduled = false
      const batch = [...this.pending.entries()]
      this.pending.clear()
      void putFields(batch)
      void putMeta('dirty', [...this.dirty])
    })
  }

  snapshot(): Doc {
    return { v: 1, fields: Object.fromEntries(this.fields) }
  }

  /** Merge a remote document in. Returns what changed. */
  applyRemote(remote: Doc): MergeResult & { dirtyBefore: Set<string> } {
    const dirtyBefore = new Set(this.dirty)
    const res = mergeDocs(this.snapshot(), remote)
    const batch: [string, Field][] = []
    for (const k of res.changedKeys) {
      const f = res.doc.fields[k]
      this.fields.set(k, f)
      this.clock.observe(f)
      batch.push([k, f])
      // remote won, so our pending copy of this key is no longer pending
      this.dirty.delete(k)
    }
    // keys where the server already holds exactly our copy are in sync
    for (const k of [...this.dirty]) {
      const l = this.fields.get(k)
      const r = remote.fields[k]
      if (l && r && l.t === r.t && l.c === r.c && l.d === r.d) this.dirty.delete(k)
    }
    if (batch.length) void putFields(batch)
    void putMeta('dirty', [...this.dirty])
    if (batch.length) this.emit()
    return { ...res, dirtyBefore }
  }

  /** Import: merge (default) or replace everything (tombstones anything not in the import). */
  importDoc(doc: Doc, mode: 'merge' | 'replace') {
    if (mode === 'merge') {
      const res = mergeDocs(this.snapshot(), doc)
      const batch: [string, Field][] = []
      for (const k of res.changedKeys) {
        this.fields.set(k, res.doc.fields[k])
        this.clock.observe(res.doc.fields[k])
        this.dirty.add(k)
        batch.push([k, res.doc.fields[k]])
      }
      void putFields(batch)
      void putMeta('dirty', [...this.dirty])
      this.emit()
      this.localListeners.forEach((l) => l())
      return res.changedKeys.length
    }
    const entries: [string, unknown][] = []
    for (const k of this.fields.keys()) if (!(k in doc.fields) || doc.fields[k].v === null) entries.push([k, null])
    for (const [k, f] of Object.entries(doc.fields)) if (f.v !== null) entries.push([k, f.v])
    this.setMany(entries)
    return entries.length
  }

  async wipeLocal() {
    this.fields.clear()
    this.dirty.clear()
    await clearFields()
    void putMeta('dirty', [])
    this.emit()
  }

  meta = {
    get: async <T>(key: string): Promise<T | undefined> => (await loadAll()).meta[key] as T | undefined,
    set: putMeta,
  }
}

export const store = new Store()
export const emptyDocument = emptyDoc

export function useStoreVersion(): number {
  return useSyncExternalStore(store.subscribe, () => store.version)
}
/** Subscribe to one field. Re-renders only when that field object changes. */
export function useField<T>(key: string, def: T): T {
  const f = useSyncExternalStore(store.subscribe, () => store.field(key))
  return f && f.v !== null ? (f.v as T) : def
}
