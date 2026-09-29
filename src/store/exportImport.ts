import { parseDoc } from '../sync/merge'
import { store } from './store'

export function exportJSON(): string {
  return JSON.stringify({ app: 'mist-prep', version: 1, exportedAt: new Date().toISOString(), doc: store.snapshot() }, null, 1)
}
export function downloadBackup() {
  const blob = new Blob([exportJSON()], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `mist-prep-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
export async function importBackup(file: File, mode: 'merge' | 'replace'): Promise<number> {
  const text = await file.text()
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  const o = raw as { app?: string; doc?: unknown }
  const doc = parseDoc(o?.app === 'mist-prep' ? o.doc : raw)
  if (!doc) throw new Error('That does not look like a MIST Prep backup.')
  return store.importDoc(doc, mode)
}
