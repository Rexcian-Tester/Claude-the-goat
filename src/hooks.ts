import { useEffect, useSyncExternalStore } from 'react'
import { msUntilDhakaMidnight, setTodayOverride, todayISO } from './data/dhaka'
import { K } from './logic/keys'
import { storeReader, type Reader } from './logic/reader'
import { scheduleFor, type Schedule, type Shifts } from './logic/schedule'
import { store, useField, useStoreVersion } from './store/store'

/* ----- "today" (Asia/Dhaka), refreshed at midnight / on focus / when the test date changes ----- */
let today = todayISO()
const tl = new Set<() => void>()
export function refreshToday() {
  const t = todayISO()
  if (t !== today) {
    today = t
    tl.forEach((l) => l())
  }
}
let timerStarted = false
function startTodayTimers() {
  if (timerStarted) return
  timerStarted = true
  const arm = () => setTimeout(() => (refreshToday(), arm()), msUntilDhakaMidnight() + 500)
  arm()
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refreshToday())
  addEventListener('focus', refreshToday)
}
export function useToday(): string {
  useEffect(startTodayTimers, [])
  return useSyncExternalStore((fn) => (tl.add(fn), () => tl.delete(fn)), () => today)
}
const OV = 'mist-today-override'
export function loadTodayOverride() {
  try {
    setTodayOverride(localStorage.getItem(OV))
  } catch {
    /* ignore */
  }
  today = todayISO()
}
export function changeTodayOverride(iso: string | null) {
  try {
    if (iso) localStorage.setItem(OV, iso)
    else localStorage.removeItem(OV)
  } catch {
    /* ignore */
  }
  setTodayOverride(iso)
  refreshToday()
}

export function useSchedule(): Schedule {
  const shifts = useField<Shifts | undefined>(K.shift, undefined)
  return scheduleFor(shifts)
}
/** Re-renders on any progress change. Logic functions are pure over this reader. */
export function useReader(): Reader {
  useStoreVersion()
  return storeReader
}
export { store }
