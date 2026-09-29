import { store } from '../store/store'

/** Read access to progress fields. Logic is pure over this so it tests without IndexedDB. */
export interface Reader {
  get<T>(key: string): T | undefined
  /** last-write timestamp (ms) of a field */
  t(key: string): number | undefined
  /** bumps on every change; lets pure logic cache results per state (optional: test readers omit it) */
  version?(): number
}
export const storeReader: Reader = {
  get: (k) => store.get(k),
  t: (k) => store.field(k)?.t,
  version: () => store.version,
}
export const mapReader = (m: Record<string, unknown>, t: Record<string, number> = {}): Reader => ({
  get: <T,>(k: string) => (m[k] === null ? undefined : (m[k] as T | undefined)),
  t: (k) => t[k],
})
