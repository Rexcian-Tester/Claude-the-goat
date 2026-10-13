// Keeps the watch's "today" summary up to date (see src/watch/today.ts). Invisible: nothing is shown on screen.
// It is refreshed after an edit made on this device (studying, ticks...), right after watch sessions are imported,
// and once when the page loads — but only after this device's first sync has finished, so a device that was offline
// can't overwrite fresher numbers with stale ones. Never in reaction to data arriving from another device, so two
// devices can't keep rewriting it back and forth. Saved only when the numbers actually changed.
import { dhakaDate } from '../data/dhaka'
import { DAILY_GOAL_MIN, studyBlocks } from '../logic/pomo'
import { store } from '../store/store'
import { loadAll } from '../store/idb'
import { getPasscode } from '../store/syncClient'
import { loggedMs, targetMs } from '../study/engine'
import { WATCH_KEY_RE } from './session'
import { sameToday, summaryKey, type TodaySummary } from './today'

export function buildToday(date: string): TodaySummary {
  const blocks = studyBlocks(date).map((b) => ({
    id: b.id,
    label: b.label,
    from: b.from,
    to: b.to,
    target: Math.round(targetMs(b.id, undefined, date)),
    studied: Math.round(loggedMs(date, b.id)),
  }))
  const watchIds: string[] = []
  for (const k of store.fields.keys()) {
    const m = WATCH_KEY_RE.exec(k)
    if (m && m[1] === date && store.get(k) !== undefined) watchIds.push(m[2])
  }
  watchIds.sort()
  return { date, blocks, total: blocks.reduce((n, b) => n + b.studied, 0), goal: DAILY_GOAL_MIN * 60000, watchIds }
}

export function publishToday() {
  if (!store.ready || !getPasscode()) return
  const date = dhakaDate(Date.now()) // the real day, not Settings' test date
  const next = buildToday(date)
  if (!sameToday(store.get(summaryKey(date)), next)) store.set(summaryKey(date), next)
}

let started = false
let queued = false
export function startTodaySummary() {
  if (started) return
  started = true
  store.onLocalChange(() => {
    if (queued) return
    queued = true
    queueMicrotask(() => {
      queued = false
      publishToday()
    })
  })
  void publishAfterFirstSync()
}

/** On page load: wait (up to 2 minutes) until this device has synced, then refresh the summary once. */
async function publishAfterFirstSync() {
  const lastSync = async () => {
    try {
      return Number((await loadAll()).meta.lastSync) || 0
    } catch {
      return 0
    }
  }
  const before = await lastSync()
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 5000))
    if ((await lastSync()) > before) return publishToday()
  }
}
