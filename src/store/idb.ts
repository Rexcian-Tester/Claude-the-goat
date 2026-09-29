import { openDB, type IDBPDatabase } from 'idb'
import type { Field } from '../sync/merge'

let dbp: Promise<IDBPDatabase | null> | null = null
function db(): Promise<IDBPDatabase | null> {
  if (!dbp) {
    dbp = openDB('mist-prep', 1, {
      upgrade(d) {
        d.createObjectStore('fields')
        d.createObjectStore('meta')
      },
    }).catch(() => null) // IndexedDB blocked (private window): fall back to memory only
  }
  return dbp
}

export async function loadAll(): Promise<{ fields: Record<string, Field>; meta: Record<string, unknown> }> {
  const d = await db()
  if (!d) return { fields: {}, meta: {} }
  const fields: Record<string, Field> = {}
  const meta: Record<string, unknown> = {}
  const tx = d.transaction(['fields', 'meta'])
  let cur = await tx.objectStore('fields').openCursor()
  while (cur) {
    fields[cur.key as string] = cur.value as Field
    cur = await cur.continue()
  }
  cur = null
  let mc = await tx.objectStore('meta').openCursor()
  while (mc) {
    meta[mc.key as string] = mc.value
    mc = await mc.continue()
  }
  await tx.done
  return { fields, meta }
}

export async function putFields(entries: [string, Field][]) {
  const d = await db()
  if (!d || !entries.length) return
  try {
    const tx = d.transaction('fields', 'readwrite')
    for (const [k, f] of entries) tx.store.put(f, k)
    await tx.done
  } catch {
    /* quota / blocked: memory copy still valid, will retry on next write */
  }
}
export async function clearFields() {
  const d = await db()
  if (d) await d.clear('fields')
}
export async function putMeta(key: string, value: unknown) {
  const d = await db()
  if (!d) return
  try {
    await d.put('meta', value, key)
  } catch {
    /* ignore */
  }
}
