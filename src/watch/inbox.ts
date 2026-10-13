// Brings sessions from the watch inbox (functions/api/watch/sessions.ts) into this device's progress. Each session
// becomes its own synced field named after its id, so importing it again (here or on another device) changes
// nothing, and the usual sync carries it to every device. Nothing here is shown on screen.
import { K } from '../logic/keys'
import { studyBlocks } from '../logic/pomo'
import { store } from '../store/store'
import { getPasscode } from '../store/syncClient'
import { loggedMs, targetMs } from '../study/engine'
import { importEntries, parseSession, type WatchSession } from './session'

let inflight = false
export async function pullWatchInbox(): Promise<number> {
  const pass = getPasscode()
  if (!pass || inflight || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 0
  inflight = true
  try {
    const res = await fetch('/api/watch/sessions', { headers: { authorization: `Bearer ${pass}` }, cache: 'no-store' })
    if (!res.ok) return 0
    const body = (await res.json()) as { sessions?: unknown }
    const now = Date.now()
    const sessions = (Array.isArray(body.sessions) ? body.sessions : [])
      .map((x) => parseSession(x, now))
      .filter((x): x is WatchSession => !('error' in x))
    const entries = importEntries(sessions, (k) => store.field(k) !== undefined)
    if (!entries.length) return 0
    const dates = [...new Set(entries.map(([k]) => k.split(':')[1]))]
    const before = new Map(dates.map((d) => [d, studyBlocks(d).map((b) => loggedMs(d, b.id))]))
    store.setMany(entries)
    // a block the watch time completed ticks itself in Routine, quietly (no pop-up)
    const ticks: [string, unknown][] = []
    for (const d of dates) {
      studyBlocks(d).forEach((b, i) => {
        const t = targetMs(b.id, undefined, d)
        if (before.get(d)![i] < t && loggedMs(d, b.id) >= t && !store.get(K.routine(d, b.id))) ticks.push([K.routine(d, b.id), true])
      })
    }
    if (ticks.length) store.setMany(ticks)
    return entries.length
  } catch {
    return 0 // offline or no server function (local dev): try again later
  } finally {
    inflight = false
  }
}

let started = false
/** Check the inbox now, whenever the app comes back into view, when the network returns, and every 2 minutes. */
export function startWatchInbox() {
  if (started) return
  started = true
  const run = () => void pullWatchInbox()
  run()
  addEventListener('online', run)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && run())
  setInterval(() => document.visibilityState === 'visible' && run(), 120000)
}
