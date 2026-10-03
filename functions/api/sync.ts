// POST /api/sync  { doc }  ->  { doc: mergedDoc, at }
// GET  /api/sync            ->  { doc, at }
// Auth: `Authorization: Bearer <passcode>` compared with env.SYNC_PASSCODE (a Pages secret).
// Storage: one KV key holding the whole progress document. KV is eventually consistent and has
// no compare-and-swap, so clients always re-send their full document; a lost write self-heals.
import { emptyDoc, mergeDocs, parseDoc, type Doc } from '../../src/sync/merge'

interface Env {
  PROGRESS: KVNamespace
  SYNC_PASSCODE?: string
}
const KEY = 'progress'
const MAX_BODY = 3_000_000

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
}
async function authorized(request: Request, secret: string): Promise<boolean> {
  const h = request.headers.get('authorization') ?? ''
  const given = h.startsWith('Bearer ') ? h.slice(7) : ''
  const [a, b] = await Promise.all([sha256(given), sha256(secret)])
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SYNC_PASSCODE || !env.PROGRESS) return json({ error: 'server-not-configured' }, 500)
  if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'method' }, 405)

  if (!(await authorized(request, env.SYNC_PASSCODE))) {
    await new Promise((r) => setTimeout(r, 500)) // slow down guessing
    return json({ error: 'unauthorized' }, 401)
  }

  const stored = parseDoc(await env.PROGRESS.get(KEY, 'json')) ?? emptyDoc()
  if (request.method === 'GET') return json({ doc: stored, at: Date.now() })

  const text = await request.text()
  if (text.length > MAX_BODY) return json({ error: 'too-large' }, 413)
  let incoming: Doc | null = null
  try {
    incoming = parseDoc((JSON.parse(text) as { doc?: unknown }).doc)
  } catch {
    /* fallthrough */
  }
  if (!incoming) return json({ error: 'bad-document' }, 400)

  const { doc, changedKeys } = mergeDocs(stored, incoming)
  // only write when the client actually brought something new
  if (changedKeys.length > 0) {
    try {
      await env.PROGRESS.put(KEY, JSON.stringify(doc))
    } catch {
      // free plan: ~1,000 writes a day, reset at 00:00 UTC; the device keeps its changes and retries later
      return json({ error: 'daily-limit' }, 429)
    }
  }
  return json({ doc, at: Date.now() })
}
