import { useSyncExternalStore } from 'react'

export type RouteName = 'today' | 'plan' | 'map' | 'chapter' | 'progress' | 'settings'
export interface Route {
  name: RouteName
  param?: string
  query: URLSearchParams
}
const NAMES: RouteName[] = ['today', 'plan', 'map', 'chapter', 'progress', 'settings']

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
  settings: () => '#/settings',
}
export function go(h: string, replace = false) {
  if (replace) history.replaceState(null, '', h)
  else location.hash = h.replace(/^#/, '')
  if (replace) dispatchEvent(new HashChangeEvent('hashchange'))
}
