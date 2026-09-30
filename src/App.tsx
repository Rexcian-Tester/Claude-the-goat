import { useEffect, useLayoutEffect, useMemo } from 'react'
import { bn } from './data/bn'
import { behindInfo, lagLabel, phaseOf } from './logic/behind'
import { PLAN_START } from './data/plan'
import { diffDays } from './data/dhaka'
import { cameBack, href, rememberScroll, restoredScroll, useRoute } from './router'
import { useReader, useSchedule, useToday } from './hooks'
import { useSyncState } from './store/syncClient'
import { openSearch, useSearchOpen, useUpdateReady } from './ui-state'
import { Toast } from './components/ui'
import { TodayView } from './views/Today'
import { PlanView } from './views/Plan'
import { MapView } from './views/Map'
import { ChapterView } from './views/Chapter'
import { ProgressView } from './views/Progress'
import { SettingsView } from './views/Settings'
import { SearchSheet } from './views/Search'
import { FocusView } from './views/Focus'
import { RoutineView } from './views/Routine'
import { ReminderPopup } from './views/Habits'

/** The mark: a single gold numeral 1 in a thin gold frame. Same art as the favicon. */
function Logo() {
  return (
    <svg className="logo" viewBox="0 0 512 512" aria-hidden="true">
      <defs>
        <linearGradient id="lg-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#15241b" /><stop offset="1" stopColor="#0a120d" /></linearGradient>
        <linearGradient id="lg-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e6cf95" /><stop offset="1" stopColor="#b8904a" /></linearGradient>
      </defs>
      <rect width="512" height="512" rx="104" fill="url(#lg-bg)" />
      <rect x="40" y="40" width="432" height="432" rx="74" fill="none" stroke="#c9a45c" strokeOpacity=".6" strokeWidth="14" />
      <path d="M288 104V364H340V404H172V364H224V178L176 200V160L260 104Z" fill="url(#lg-gold)" />
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
  const nav: { name: string; label: string; short?: string; to: string; cur: boolean }[] = [
    { name: 'today', label: 'Today', to: href.today(), cur: route.name === 'today' },
    { name: 'plan', label: 'Plan', to: href.plan(), cur: route.name === 'plan' },
    { name: 'map', label: 'Priority Map', short: 'Map', to: href.map(), cur: route.name === 'map' || route.name === 'chapter' },
    { name: 'progress', label: 'Progress', to: href.progress(), cur: route.name === 'progress' },
    { name: 'focus', label: 'Focus', to: href.focus(), cur: route.name === 'focus' },
    { name: 'routine', label: 'Routine', to: href.routine(), cur: route.name === 'routine' },
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
              <a href={n.to} aria-current={n.cur ? 'page' : undefined} aria-label={n.short ? n.label : undefined}>
                {n.short ? <><span className="lg-only" aria-hidden="true">{n.label}</span><span className="sm-only" aria-hidden="true">{n.short}</span></> : n.label}
              </a>
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
  const updateReady = useUpdateReady()
  // decided once per page: flipping it later (e.g. opening a day) would replay the entrance animation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const returning = useMemo(() => cameBack(), [route.name])
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
      <main className={`main ${returning ? 'returning' : ''}`} id="main" tabIndex={-1}>
        {route.name === 'today' && <TodayView />}
        {route.name === 'plan' && <PlanView />}
        {route.name === 'map' && <MapView />}
        {route.name === 'chapter' && <ChapterView />}
        {route.name === 'progress' && <ProgressView />}
        {route.name === 'focus' && <FocusView />}
        {route.name === 'routine' && <RoutineView />}
        {route.name === 'settings' && <SettingsView />}
      </main>
      {searchOpen && <SearchSheet />}
      <ReminderPopup />
      {updateReady && (
        <button type="button" className="update-bar" onClick={() => location.reload()}>
          New version ready · <b>Tap to reload</b>
        </button>
      )}
      <Toast />
    </div>
  )
}
export { bn }
