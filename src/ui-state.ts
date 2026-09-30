import { useSyncExternalStore } from 'react'

let open = false
let initial = ''
const ls = new Set<() => void>()
const emit = () => ls.forEach((l) => l())
export const openSearch = (q = '') => {
  open = true
  initial = q
  emit()
}
export const closeSearch = () => {
  open = false
  emit()
}
export const useSearchOpen = () => useSyncExternalStore((fn) => (ls.add(fn), () => ls.delete(fn)), () => open)
export const searchInitial = () => initial

export type Theme = 'system' | 'light' | 'dark'
export function getTheme(): Theme {
  try {
    const t = localStorage.getItem('mist-theme')
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}
export function applyTheme(t: Theme) {
  try {
    if (t === 'system') localStorage.removeItem('mist-theme')
    else localStorage.setItem('mist-theme', t)
  } catch {
    /* ignore */
  }
  if (t === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', t)
}

/* A newer deploy has taken over in the background. Shown as a bar so an old saved copy is never mistaken for the
   live site; tapping it (or leaving the app) loads the new version. */
let updateReady = false
const ul = new Set<() => void>()
export const markUpdateReady = () => {
  updateReady = true
  ul.forEach((l) => l())
}
export const useUpdateReady = () => useSyncExternalStore((fn) => (ul.add(fn), () => ul.delete(fn)), () => updateReady)
