// All "today" logic runs on Asia/Dhaka calendar dates, as ISO strings (YYYY-MM-DD).
// Date arithmetic is done in UTC on those strings so it never depends on the device timezone.
const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dhaka',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function dhakaDate(ms: number): string {
  return fmt.format(new Date(ms))
}

let override: string | null = null
/** Test-date override (Settings). Never synced. */
export function setTodayOverride(iso: string | null) {
  override = iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null
}
export function getTodayOverride() {
  return override
}
export function todayISO(nowMs: number = Date.now()): string {
  return override ?? dhakaDate(nowMs)
}

const toUTC = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
export function addDays(iso: string, n: number): string {
  return new Date(toUTC(iso) + n * 86400000).toISOString().slice(0, 10)
}
/** whole days from a to b (b - a) */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000)
}
export function weekdayIndex(iso: string): number {
  return new Date(toUTC(iso)).getUTCDay()
}
export function ms(nowMs: number = Date.now()) {
  return nowMs
}
/** Milliseconds until the next Dhaka midnight (for re-rendering "today"). */
export function msUntilDhakaMidnight(nowMs: number = Date.now()): number {
  const t = dhakaDate(nowMs)
  const next = toUTC(addDays(t, 1)) - 6 * 3600000
  return Math.max(1000, next - nowMs)
}
