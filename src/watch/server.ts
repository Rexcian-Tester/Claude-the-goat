// Small helpers for the watch Pages Functions (functions/api/watch/*). Workers runtime; no DOM, no store.

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
}
/** `Authorization: Bearer <secret>`, compared in constant time. */
export async function authorized(request: Request, secret: string): Promise<boolean> {
  const h = request.headers.get('authorization') ?? ''
  const given = h.startsWith('Bearer ') ? h.slice(7) : ''
  const [a, b] = await Promise.all([sha256(given), sha256(secret)])
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}
export const denied = async () => {
  await new Promise((r) => setTimeout(r, 500)) // slow down guessing
  return json({ error: 'unauthorized' }, 401)
}
