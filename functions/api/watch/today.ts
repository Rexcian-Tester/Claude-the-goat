// GET /api/watch/today -> { today: TodaySummary | null }
// Auth: the watch token (WATCH_TOKEN). This is the only thing the watch token can read: today's study blocks
// (names, times, targets, studied time), the day's total and goal, and which watch sessions those numbers already
// include. It reads the one summary field the website keeps for the watch and passes it through cleanToday(), so
// no other progress data can ever leave through here. Read-only: it never writes.
import { dhakaDate } from '../../../src/data/dhaka'
import { cleanToday, summaryKey } from '../../../src/watch/today'
import { authorized, denied, json } from '../../../src/watch/server'

interface Env {
  PROGRESS: KVNamespace
  WATCH_TOKEN?: string
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'GET') return json({ error: 'method' }, 405)
  if (!env.WATCH_TOKEN || !env.PROGRESS) return json({ error: 'server-not-configured' }, 500)
  if (!(await authorized(request, env.WATCH_TOKEN))) return denied()
  const date = dhakaDate(Date.now())
  const doc = (await env.PROGRESS.get('progress', 'json')) as { fields?: Record<string, { v?: unknown }> } | null
  const today = cleanToday(doc?.fields?.[summaryKey(date)]?.v, date)
  return json({ today })
}
