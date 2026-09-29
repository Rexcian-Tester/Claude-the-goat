import { useSyncExternalStore } from 'react'

export type RouteName = 'today' | 'plan' | 'map' | 'chapter' | 'progress' | 'focus' | 'routine' | 'settings'
export interface Route {
  name: RouteName
  param?: string
  query: URLSearchParams
}
const NAMES: RouteName[] = ['today', 'plan', 'map', 'chapter', 'progress', 'focus', 'routine', 'settings']

export function parse(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/today'
  const [path, qs = ''] = raw.split('?')
  const [, n, ...rest] = path.split('/')
  const name = (NAMES as string[]).includes(n) ? (n as RouteName) : 'today'
  return { name, param: rest.length ? decodeURIComponent(rest.join('/')) : undefined, query: new URLSearchParams(qs) }
}
let cache: { hash: string; route: Route } | null = null
function snapshot(): Route {
  const h = location.hash
  if (!cache || cache.hash !== h) cache = { hash: h, route: parse(h) }
  return cache.route
}
export const useRoute = (): Route => useSyncExternalStore((fn) => (addEventListener('hashchange', fn), () => removeEventListener('hashchange', fn)), snapshot)

export const href = {
  today: () => '#/today',
  plan: (date?: string) => (date ? `#/plan/${date}` : '#/plan'),
  map: (tab?: string) => (tab ? `#/map/${tab}` : '#/map'),
  chapter: (id: string, focus?: string) => `#/chapter/${encodeURIComponent(id)}${focus ? `?focus=${encodeURIComponent(focus)}` : ''}`,
  progress: () => '#/progress',
  focus: () => '#/focus',
  routine: () => '#/routine',
  settings: () => '#/settings',
}

/* ---------- history bookkeeping ----------
 * Every history entry gets an index in history.state, so we can tell a Back/Forward (restore where you
 * were: page scroll and the open sheet's scroll) from a new navigation (start at the top), and so a routed
 * sheet can close with a real "back" instead of stacking a new entry on top. */
interface HState {
  i: number
  /** hash of the entry this one was opened from */
  prev?: string
  /** set on the throwaway entry an unrouted sheet pushes so Back closes it */
  sheet?: string
}
interface Saved {
  y: number
  sheet?: number
}
const SS = 'mist-scroll'
const saved = new Map<number, Saved>()
let cur = 0
let lastNav: 'push' | 'pop' = 'push'
let lastHash = ''

const st = (): Partial<HState> => (history.state && typeof history.state === 'object' ? history.state : {})

function persist() {
  try {
    sessionStorage.setItem(SS, JSON.stringify([...saved].slice(-60)))
  } catch {
    /* ignore */
  }
}
function syncEntry(prevHash: string) {
  const s = st()
  if (s.i === cur) return
  // the page we are leaving: the last scroll event may not have been delivered yet (momentum, tap right after)
  if (document.body.style.overflow !== 'hidden') saved.set(cur, { ...saved.get(cur), y: scrollY })
  if (typeof s.i === 'number') {
    lastNav = 'pop'
    cur = s.i
  } else {
    cur = cur + 1
    lastNav = 'push'
    saved.delete(cur)
    history.replaceState({ ...s, i: cur, prev: prevHash } satisfies HState, '')
  }
}

if (typeof window !== 'undefined') {
  try {
    for (const [k, v] of JSON.parse(sessionStorage.getItem(SS) ?? '[]') as [number, Saved][]) saved.set(k, v)
  } catch {
    /* ignore */
  }
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  const s = st()
  // a reload keeps its history entry: come back to the same spot
  if (typeof s.i === 'number') (cur = s.i), (lastNav = 'pop')
  else history.replaceState({ ...s, i: 0 } satisfies HState, '')
  lastHash = location.hash
  // registered before React subscribes, so the entry index is right when views render
  addEventListener('hashchange', () => {
    syncEntry(lastHash)
    lastHash = location.hash
  })
  addEventListener('popstate', () => syncEntry(lastHash))
  let raf = 0
  addEventListener('scroll', (e) => {
    const t = e.target
    if (t instanceof Element && t.classList.contains('sheet')) {
      saved.set(cur, { y: saved.get(cur)?.y ?? scrollY, sheet: t.scrollTop })
    } else if (t === document || t === window) {
      // body is locked while a sheet is open; keep the page position we had
      if (document.body.style.overflow !== 'hidden') saved.set(cur, { ...saved.get(cur), y: scrollY })
    } else return
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(persist)
  }, { capture: true, passive: true })
  addEventListener('pagehide', persist)
}

/** Where to put the page after this navigation: the saved spot on Back/Forward, otherwise null. */
export function restoredScroll(): Saved | null {
  return lastNav === 'pop' ? saved.get(cur) ?? null : null
}
/** True when the page on screen came from Back/Forward (or a reload), not a fresh navigation. */
export const cameBack = () => lastNav === 'pop'
/** Record the current page position for this entry (scroll events alone miss a page you never scrolled). */
export function rememberScroll() {
  saved.set(cur, { ...saved.get(cur), y: scrollY })
}

export function go(h: string, replace = false) {
  if (!replace) {
    location.hash = h.replace(/^#/, '')
    return
  }
  const s = st()
  history.replaceState({ i: s.i ?? cur, prev: s.sheet ? location.hash : s.prev } satisfies HState, '', h)
  saved.delete(cur)
  lastNav = 'push'
  dispatchEvent(new HashChangeEvent('hashchange'))
}

/** Close a routed sheet: step back if we came from `to`, otherwise swap this entry for `to`. */
export function closeTo(to: string) {
  if (st().prev === to) history.back()
  else go(to, true)
}

/** Leave an unrouted sheet for another page without leaving its throwaway entry behind. */
export function goFromSheet(h: string) {
  go(h, !!st().sheet)
}

/** Push a same-URL entry so the browser/phone Back button closes an unrouted sheet. Returns a cleanup. */
export function pushSheetEntry(onBack: () => void): () => void {
  const id = Math.random().toString(36).slice(2)
  let pushed = false
  let alive = true
  const pop = () => {
    if (st().sheet !== id) {
      alive = false
      removeEventListener('popstate', pop)
      onBack()
    }
  }
  // deferred so a mount/unmount/mount (React StrictMode) doesn't push twice
  const t = setTimeout(() => {
    if (!alive) return
    history.pushState({ i: cur + 1, prev: location.hash, sheet: id } satisfies HState, '')
    cur = cur + 1
    saved.set(cur, { y: scrollY })
    pushed = true
    addEventListener('popstate', pop)
  }, 0)
  return () => {
    clearTimeout(t)
    removeEventListener('popstate', pop)
    if (alive && pushed && st().sheet === id) history.back()
    alive = false
  }
}
