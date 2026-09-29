import { store } from '../store/store'

/** Read access to progress fields. Logic is pure over this so it tests without IndexedDB. */
export interface Reader {
  get<T>(key: string): T | undefined
  /** last-write timestamp (ms) of a field */
  t(key: string): number | undefined
}
export const storeReader: Reader = {
  get: (k) => store.get(k),
  t: (k) => store.field(k)?.t,
}
export const mapReader = (m: Record<string, unknown>, t: Record<string, number> = {}): Reader => ({
  get: <T,>(k: string) => (m[k] === null ? undefined : (m[k] as T | undefined)),
  t: (k) => t[k],
})
