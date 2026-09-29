import { useEffect, useLayoutEffect } from 'react'
import { bn } from './data/bn'
import { behindInfo, lagLabel, phaseOf } from './logic/behind'
import { PLAN_START } from './data/plan'
import { diffDays } from './data/dhaka'
import { href, rememberScroll, restoredScroll, useRoute } from './router'
import { useReader, useSchedule, useToday } from './hooks'
import { useSyncState } from './store/syncClient'
import { openSearch, useSearchOpen } from './ui-state'
import { Toast } from './components/ui'
import { TodayView } from './views/Today'
import { PlanView } from './views/Plan'
import { MapView } from './views/Map'
import { ChapterView } from './views/Chapter'
import { ProgressView } from './views/Progress'
import { SettingsView } from './views/Settings'
import { SearchSheet } from './views/Search'

/** The "one shot" mark: one gold 1, one winning arc out of countless dashed timelines. Same art as the favicon. */
function Logo() {
  return (
    <svg className="logo" viewBox="0 0 512 512" aria-hidden="true">
      <defs>
        <linearGradient id="lg-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1f3b2a" /><stop offset="1" stopColor="#0b1510" /></linearGradient>
        <linearGradient id="lg-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe7a8" /><stop offset=".55" stopColor="#eab54c" /><stop offset="1" stopColor="#b97a1f" /></linearGradient>
      </defs>
      <rect width="512" height="512" rx="120" fill="url(#lg-bg)" />
      <circle cx="256" cy="264" r="184" fill="none" stroke="#e8efe6" strokeOpacity=".14" strokeWidth="8" strokeDasharray="14 18" />
      <path d="M256 50 A214 214 0 0 1 437 150" fill="none" stroke="url(#lg-gold)" strokeWidth="18" strokeLinecap="round" />
      <path d="M437 112 L446 141 L475 150 L446 159 L437 188 L428 159 L399 150 L428 141 Z" fill="#fff4d2" />
      <path d="M232 120 H304 V372 H346 V410 H190 V372 H232 V186 L190 214 L168 178 Z" fill="url(#lg-gold)" />
    </svg>
  )
}

function TopBar() {
  const route = useRoute()
  const today = useToday()
  const sched = useSchedule()
  const r = useReader()
  const sync = useSyncState()
  const info = behindInfo(today, sched.rows, r)
  const phase = phaseOf(today)
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  const nav: { name: string; label: string; to: string; cur: boolean }[] = [
    { name: 'today', label: 'Today', to: href.today(), cur: route.name === 'today' },
    { name: 'plan', label: 'Plan', to: href.plan(), cur: route.name === 'plan' },
    { name: 'map', label: 'Priority Map', to: href.map(), cur: route.name === 'map' || route.name === 'chapter' },
    { name: 'progress', label: 'Progress', to: href.progress(), cur: route.name === 'progress' },
  ]
  const lagCls = info.lag > 2 ? 'bad' : info.lag > 0 ? 'warn' : 'ok'
  const syncTxt = { off: 'Local only', synced: 'Synced', syncing: 'Syncing…', offline: `Offline${sync.pending ? ` · ${sync.pending}` : ''}`, conflict: 'Conflict resolved', auth: 'Wrong passcode', error: 'Sync error' }[sync.status]
  const syncCls = sync.status === 'synced' ? 'ok' : sync.status === 'auth' || sync.status === 'error' ? 'bad' : sync.status === 'conflict' ? 'warn' : ''
  return (
    <header className="topbar">
      <div className="topbar-in">
        <div className="tb-row">
          <a className="brand" href={href.today()} aria-label="MIST Prep home"><Logo /><span className="brand-t">MIST Prep</span></a>
          <div className="chips">
            <span className="chip-s" role="img" aria-label={`${diffDays(today, '2026-12-19')} days left until the exam`} title="Days until 19 December 2026"><span className="lg" aria-hidden="true">{diffDays(today, '2026-12-19')} {diffDays(today, '2026-12-19') === 1 ? 'day' : 'days'} left</span><span className="sm" aria-hidden="true">{diffDays(today, '2026-12-19')}d</span></span>
            {phase === 'endgame' || phase === 'rest' || phase === 'exam' ? (
              <a className="chip-s ok" href={href.today()}>Endgame</a>
            ) : phase === 'before' ? (
              <span className="chip-s" title="Plan starts 30 September">Starts in {diffDays(today, PLAN_START)}d</span>
            ) : (
              <a className={`chip-s ${lagCls}`} href={href.plan()} title="Completed study days vs days elapsed" aria-label={lagLabel(info.lag)}>{lagLabel(info.lag).replace(' days', 'd').replace(' day', 'd')}</a>
            )}
            <a className={`chip-s ${syncCls}`} href={href.settings()} title={sync.message || 'Sync status'}><span className="dot" /><span className={`sync-txt ${sync.status === 'synced' || sync.status === 'off' || sync.status === 'syncing' ? 'quiet' : ''}`}>{syncTxt}</span></a>
          </div>
          <button className="search-btn" onClick={() => openSearch()} aria-label="Search (Ctrl or Command K)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <kbd>{mac ? '⌘K' : 'Ctrl K'}</kbd>
          </button>
          <a className="icon-btn" href={href.settings()} aria-label="Settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
          </a>
        </div>
        <nav className="nav" aria-label="Main">
          {nav.map((n, i) => (
            <span key={n.name} style={{ display: 'contents' }}>
              {(i === 1 || i === 3) && <span className="sep" aria-hidden="true" />}
              <a href={n.to} aria-current={n.cur ? 'page' : undefined}>{n.label}</a>
            </span>
          ))}
        </nav>
      </div>
    </header>
  )
}

export function App() {
  const route = useRoute()
  const searchOpen = useSearchOpen()
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement | null)?.isContentEditable
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        openSearch()
      } else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        openSearch()
      }
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [])
  useLayoutEffect(() => {
    // Back/Forward: put the page (and an open day sheet) back where you left it. New page: start at the top,
    // except when a day sheet opens over the plan or a chapter link jumps to a highlighted item.
    const s = restoredScroll()
    if (s) {
      scrollTo(0, s.y)
      const f = requestAnimationFrame(() => scrollTo(0, s.y))
      return () => cancelAnimationFrame(f)
    }
    if (!(route.name === 'chapter' && route.query.get('focus')) && !(route.name === 'plan' && route.param)) scrollTo(0, 0)
    rememberScroll()
  }, [route])
  return (
    <div className="app">
      <a href="#main" className="sr-only" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>Skip to content</a>
      <TopBar />
      <main className="main" id="main" tabIndex={-1}>
        {route.name === 'today' && <TodayView />}
        {route.name === 'plan' && <PlanView />}
        {route.name === 'map' && <MapView />}
        {route.name === 'chapter' && <ChapterView />}
        {route.name === 'progress' && <ProgressView />}
        {route.name === 'settings' && <SettingsView />}
      </main>
      {searchOpen && <SearchSheet />}
      <Toast />
    </div>
  )
}
export { bn }
