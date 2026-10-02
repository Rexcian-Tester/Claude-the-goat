import { K } from '../logic/keys'
import { EMPTY_EDITS, HISTORY_KEEP, type PlanEdits, type PlanVersion } from '../logic/planEdits'
import { store } from '../store/store'
import { useSyncState } from '../store/syncClient'

/* Saving plan edits. Every change first keeps a copy of how the plan looked before it (a version), so any
 * change can be undone. Versions sync too, so Undo works from any device. */

export const currentEdits = () => store.get<PlanEdits>(K.edits)

export function planHistory(): PlanVersion[] {
  const out: PlanVersion[] = []
  for (const k of store.fields.keys()) {
    if (!k.startsWith('plan:hist:')) continue
    const v = store.get<PlanVersion>(k)
    if (v && typeof v.at === 'number' && v.edits) out.push(v)
  }
  return out.sort((a, b) => b.at - a.at)
}

/** Save new edits; `label` says what changed (shown in the version history). False if too big to sync. */
export function commitEdits(next: PlanEdits, label: string): boolean {
  if (JSON.stringify(next).length > 150_000) return false
  const now = Math.max(Date.now(), (planHistory()[0]?.at ?? 0) + 1)
  const prev = currentEdits() ?? EMPTY_EDITS
  const entries: [string, unknown][] = [
    [K.planVersion(now), { at: now, label, edits: prev } satisfies PlanVersion],
    [K.edits, Object.keys(next.topics).length ? next : null],
  ]
  for (const old of planHistory().slice(HISTORY_KEEP - 1)) entries.push([K.planVersion(old.at), null])
  store.setMany(entries)
  return true
}

const when = (ms: number) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ms))
export const versionTime = when

export function restoreVersion(v: PlanVersion) {
  commitEdits(v.edits, `Went back to the version from ${when(v.at)}`)
}
export function resetPlan() {
  commitEdits(EMPTY_EDITS, 'Reset to the original plan')
}

/** Plan editing needs a passcode and a live, working sync, so two devices can never hold different plans. */
export function useCanEdit(): { ok: boolean; why: string } {
  const s = useSyncState()
  if (s.status === 'off') return { ok: false, why: 'Set your sync passcode in Settings to edit the plan. You can still view the plan and tick tasks.' }
  if (s.status === 'offline' || (typeof navigator !== 'undefined' && navigator.onLine === false))
    return { ok: false, why: "You're offline. Plan editing works only while you're online and synced, so your devices never disagree. Ticking tasks still works." }
  if (s.status === 'auth' || s.status === 'error') return { ok: false, why: `Sync isn't working right now (${s.message || s.status}). Fix it in Settings to edit the plan.` }
  if (s.status === 'syncing' && s.lastAt === null) return { ok: false, why: 'Connecting to sync… editing unlocks once this device is up to date.' }
  return { ok: true, why: '' }
}
