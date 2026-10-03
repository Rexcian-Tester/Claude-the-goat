import { useSyncExternalStore } from 'react'
import { parseDoc } from '../sync/merge'
import { store } from './store'
import { putMeta } from './idb'

export type SyncStatus = 'off' | 'synced' | 'syncing' | 'offline' | 'conflict' | 'auth' | 'error'
export interface SyncState {
  status: SyncStatus
  pending: number
  lastAt: number | null
  message: string
}
let state: SyncState = { status: 'off', pending: 0, lastAt: null, message: '' }
const listeners = new Set<() => void>()
const set = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch, pending: store.dirty.size }
  listeners.forEach((l) => l())
}
export const useSyncState = (): SyncState => useSyncExternalStore((fn) => (listeners.add(fn), () => listeners.delete(fn)), () => state)

const PASS_KEY = 'mist-passcode'
export const getPasscode = (): string => {
  try {
    return localStorage.getItem(PASS_KEY) ?? ''
  } catch {
    return ''
  }
}
export function setPasscode(p: string) {
  try {
    if (p) localStorage.setItem(PASS_KEY, p)
    else localStorage.removeItem(PASS_KEY)
  } catch {
    /* ignore */
  }
  set({ status: p ? 'syncing' : 'off', message: '' })
  if (p) void syncNow()
}

let inflight = false
let again = false
let timer: ReturnType<typeof setTimeout> | undefined
let conflictTimer: ReturnType<typeof setTimeout> | undefined

// Ticks are batched: a sync goes out ~10 s after the last change (each sync that changes something is one
// Cloudflare KV write, and the free plan allows ~1,000 a day).
export function scheduleSync(delay = 10000) {
  if (!getPasscode()) return set({})
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delay)
}

export async function syncNow(): Promise<void> {
  const pass = getPasscode()
  if (!pass) return set({ status: 'off' })
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return set({ status: 'offline' })
  if (inflight) {
    again = true
    return
  }
  inflight = true
  set({ status: 'syncing' })
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${pass}` },
      body: JSON.stringify({ doc: store.snapshot() }),
      signal: ctrl.signal,
    })
    if (res.status === 401) return set({ status: 'auth', message: 'Wrong passcode' })
    if (res.status === 404) return set({ status: 'off', message: 'Sync is not available here (no server function)' })
    if (res.status === 429) return set({ status: 'error', message: "Cloudflare's free daily sync limit is used up. Your progress is safe on this device and syncs again after 6:00 AM" })
    if (res.status === 500) return set({ status: 'error', message: 'Server not configured (KV binding or SYNC_PASSCODE missing)' })
    if (!res.ok) return set({ status: 'error', message: `Server error ${res.status}` })
    const remote = parseDoc(((await res.json()) as { doc?: unknown }).doc)
    if (!remote) return set({ status: 'error', message: 'Bad response from server' })
    const r = store.applyRemote(remote)
    const conflicts = r.overwrittenLocal.filter((k) => r.dirtyBefore.has(k))
    const lastAt = Date.now()
    void putMeta('lastSync', lastAt)
    if (conflicts.length) {
      set({ status: 'conflict', lastAt, message: `${conflicts.length} edit(s) from another device were newer and won` })
      clearTimeout(conflictTimer)
      conflictTimer = setTimeout(() => state.status === 'conflict' && set({ status: 'synced' }), 8000)
    } else set({ status: 'synced', lastAt, message: '' })
  } catch {
    set({ status: 'offline', message: navigator.onLine === false ? 'No network. Changes are saved on this device and will sync later.' : 'Server unreachable. Changes are saved on this device and will sync when it is back.' })
  } finally {
    clearTimeout(to)
    inflight = false
    if (again) {
      again = false
      scheduleSync(500)
    }
  }
}

let started = false
export function startSync() {
  if (started) return
  started = true
  store.onLocalChange(() => {
    set({})
    scheduleSync()
  })
  addEventListener('online', () => void syncNow())
  addEventListener('offline', () => set({ status: 'offline' }))
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void syncNow())
  setInterval(() => document.visibilityState === 'visible' && void syncNow(), 60000)
  if (getPasscode()) void syncNow()
}
