// The watch inbox.
// POST /api/watch/sessions  { sessions: WatchSession[] } -> { accepted: id[], rejected: { id, error }[] }
//   Auth: `Authorization: Bearer <WATCH_TOKEN>` (its own Pages secret). It can only add sessions: it can't read
//   or change progress. Re-sending a session is harmless (same id = already there), so the watch can retry freely.
// GET  /api/watch/sessions  -> { sessions: WatchSession[] }
//   Auth: the site passcode (SYNC_PASSCODE). The site reads the inbox and imports new sessions into progress itself
//   (src/watch/inbox.ts), so this endpoint never touches the `progress` key that /api/sync owns.
// Storage: one KV key, `watch-inbox`, written only when the watch brings a new session. Sessions older than
// KEEP_DAYS are dropped (every device has imported them long before). KV has no compare-and-swap, so two posts at
// the same moment could drop one; the watch therefore re-sends its last 7 days on every sync and a lost write
// self-heals (the same idea as /api/sync).
import { KEEP_DAYS, parseSession, type Span, type WatchSession } from '../../../src/watch/session'
import { authorized, denied, json } from '../../../src/watch/server'

interface Env {
  PROGRESS: KVNamespace
  SYNC_PASSCODE?: string
  WATCH_TOKEN?: string
}
interface Inbox {
  v: 1
  sessions: Record<string, { parts: Span[]; at: number }>
}
const KEY = 'watch-inbox'
const MAX_BODY = 64_000
const MAX_BATCH = 200

async function readInbox(kv: KVNamespace): Promise<Inbox> {
  const x = (await kv.get(KEY, 'json')) as Inbox | null
  return x && x.v === 1 && x.sessions && typeof x.sessions === 'object' ? x : { v: 1, sessions: {} }
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.PROGRESS) return json({ error: 'server-not-configured' }, 500)

  if (request.method === 'GET') {
    if (!env.SYNC_PASSCODE) return json({ error: 'server-not-configured' }, 500)
    if (!(await authorized(request, env.SYNC_PASSCODE))) return denied()
    const inbox = await readInbox(env.PROGRESS)
    const sessions: WatchSession[] = Object.entries(inbox.sessions).map(([id, s]) => ({ id, parts: s.parts }))
    return json({ sessions })
  }

  if (request.method !== 'POST') return json({ error: 'method' }, 405)
  if (!env.WATCH_TOKEN) return json({ error: 'server-not-configured' }, 500)
  if (!(await authorized(request, env.WATCH_TOKEN))) return denied()

  const text = await request.text()
  if (text.length > MAX_BODY) return json({ error: 'too-large' }, 413)
  let list: unknown
  try {
    list = (JSON.parse(text) as { sessions?: unknown }).sessions
  } catch {
    /* fallthrough */
  }
  if (!Array.isArray(list) || list.length > MAX_BATCH) return json({ error: 'bad-request' }, 400)

  const now = Date.now()
  const inbox = await readInbox(env.PROGRESS)
  const accepted: string[] = []
  const rejected: { id: unknown; error: string }[] = []
  let changed = false
  for (const raw of list) {
    const s = parseSession(raw, now)
    if ('error' in s) {
      rejected.push({ id: (raw as { id?: unknown } | null)?.id ?? null, error: s.error })
      continue
    }
    if (!inbox.sessions[s.id]) {
      inbox.sessions[s.id] = { parts: s.parts, at: now }
      changed = true
    }
    accepted.push(s.id) // new or already here: either way the watch can forget it
  }
  const oldest = now - KEEP_DAYS * 86400000
  for (const [id, s] of Object.entries(inbox.sessions)) {
    if (s.parts[s.parts.length - 1][1] < oldest) {
      delete inbox.sessions[id]
      changed = true
    }
  }
  if (changed) {
    try {
      await env.PROGRESS.put(KEY, JSON.stringify(inbox))
    } catch {
      // free plan: ~1,000 writes a day; the watch keeps its queue and retries later
      return json({ error: 'daily-limit' }, 429)
    }
  }
  return json({ accepted, rejected })
}
