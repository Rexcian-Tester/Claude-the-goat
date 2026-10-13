// Pretend to be the watch: send one focus session to the watch inbox, the way the Zepp side service will.
// Usage:
//   WATCH_TOKEN=<token> node scripts/watch-send-test.mjs <site-url> [start HH:MM] [minutes] [id]
//   e.g. WATCH_TOKEN=... node scripts/watch-send-test.mjs http://127.0.0.1:8788 05:00 25
// Start is Bangladesh time today (default: 25 minutes ago). Re-running with the same id must not count twice.
// The token is read from the environment so it never ends up in a file or in git.
const [url, start, minutes = '25', id] = process.argv.slice(2)
const token = process.env.WATCH_TOKEN
if (!url || !token) {
  console.error('Usage: WATCH_TOKEN=<token> node scripts/watch-send-test.mjs <site-url> [start HH:MM] [minutes] [id]')
  process.exit(1)
}
const len = Number(minutes) * 60000
let from = Date.now() - len
if (start) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date())
  from = Date.parse(`${today}T${start}:00+06:00`)
}
const session = { id: id ?? `test-${from.toString(36)}`, parts: [[from, from + len]] }
const res = await fetch(new URL('/api/watch/sessions', url), {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ sessions: [session] }),
})
console.log(res.status, await res.text())
console.log('sent', session.id, new Date(from).toISOString(), `${minutes} min`)
