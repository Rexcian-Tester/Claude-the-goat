// GET /api/companion -> { summary: CompanionSummary }
// For the Desk Buddy companion app (separate repo): today's plan, ticks, study time, late starts, behind/ahead,
// unfinished work, the next few days and the last week, built by src/companion/summary.ts with the site's own logic.
// Auth: `Authorization: Bearer <COMPANION_TOKEN>` (its own Pages secret, not the site passcode). Read-only: it only
// reads the `progress` key and never writes anything, so it can't change progress or use up the daily KV writes.
import { dhakaDate } from '../../src/data/dhaka'
import { buildCompanionSummary } from '../../src/companion/summary'
import { authorized, denied, json } from '../../src/watch/server'

interface Env {
  PROGRESS: KVNamespace
  COMPANION_TOKEN?: string
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'GET') return json({ error: 'method' }, 405)
  if (!env.COMPANION_TOKEN || !env.PROGRESS) return json({ error: 'server-not-configured' }, 500)
  if (!(await authorized(request, env.COMPANION_TOKEN))) return denied()
  const now = Date.now()
  const doc = (await env.PROGRESS.get('progress', 'json')) as { fields?: Record<string, { v?: unknown }> } | null
  return json({ summary: buildCompanionSummary(doc?.fields ?? {}, dhakaDate(now), now) })
}
