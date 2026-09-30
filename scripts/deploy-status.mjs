// Is a commit live on Cloudflare Pages? Reads the "Cloudflare Pages" check that Cloudflare posts on the GitHub commit.
//
//   npm run deploy:status              -> status of the current HEAD
//   npm run deploy:status -- <sha>     -> status of a given commit
//   npm run deploy:status -- --wait    -> keep checking (every 15 s, up to 10 min) until it finishes
//
// Exit code: 0 deployed, 1 build failed, 2 still pending / not found. Set GITHUB_TOKEN if the repo is private.
import { execSync } from 'node:child_process'

const args = process.argv.slice(2)
const wait = args.includes('--wait')
const sha = args.find((a) => !a.startsWith('--')) ?? execSync('git rev-parse HEAD').toString().trim()
const remote = execSync('git remote get-url origin').toString().trim()
const repo = remote.match(/github\.com[/:]([^/]+\/[^/.]+)/)?.[1]
if (!repo) {
  console.error(`Cannot read owner/repo from the git remote: ${remote}`)
  process.exit(2)
}

let token = process.env.GITHUB_TOKEN
async function check() {
  const url = `https://api.github.com/repos/${repo}/commits/${sha}/check-runs`
  const headers = { accept: 'application/vnd.github+json' }
  if (token) headers.authorization = `Bearer ${token}`
  let res = await fetch(url, { headers })
  if (res.status === 401 && token) {
    // a token that GitHub rejects (e.g. a sandbox one) is worse than none on a public repo
    token = undefined
    delete headers.authorization
    res = await fetch(url, { headers })
  }
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000
    const mins = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60000)) : null
    return { state: 'pending', text: `GitHub rate limit reached${mins ? `, resets in ~${mins} min` : ''} (set GITHUB_TOKEN to avoid it)` }
  }
  if (!res.ok) return { state: 'pending', text: `GitHub API ${res.status}` }
  const run = (await res.json()).check_runs?.find((r) => r.name === 'Cloudflare Pages')
  if (!run) return { state: 'pending', text: 'no Cloudflare build yet' }
  const preview = (run.output?.summary ?? '').match(/https:\/\/[a-z0-9]+\.[a-z0-9-]+\.pages\.dev/)?.[0] ?? ''
  if (run.status !== 'completed') return { state: 'pending', text: 'build in progress' }
  return run.conclusion === 'success' ? { state: 'ok', text: `deployed ${preview}` } : { state: 'failed', text: `build ${run.conclusion} · logs: ${run.details_url}` }
}

const deadline = Date.now() + 10 * 60000
for (;;) {
  const r = await check()
  console.log(`${new Date().toISOString().slice(11, 19)}  ${sha.slice(0, 7)}  ${r.state.toUpperCase()}  ${r.text}`)
  if (r.state === 'ok') process.exit(0)
  if (r.state === 'failed') process.exit(1)
  if (!wait || Date.now() > deadline) process.exit(2)
  await new Promise((ok) => setTimeout(ok, 15000))
}
