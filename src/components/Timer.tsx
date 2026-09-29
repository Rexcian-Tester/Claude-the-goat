import { useEffect, useRef, useState } from 'react'
import { bn } from '../data/bn'

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/* A running timer survives leaving the page (e.g. opening the formula sheet mid-recall) and reloads. */
interface Saved {
  endsAt: number | null
  pausedLeft: number | null
}
const LS = (id: string) => `mist-timer:${id}`
function load(id?: string): Saved | null {
  if (!id) return null
  try {
    const s = JSON.parse(localStorage.getItem(LS(id)) ?? 'null') as Saved | null
    return s && (typeof s.endsAt === 'number' || typeof s.pausedLeft === 'number') ? s : null
  } catch {
    return null
  }
}
function save(id: string | undefined, s: Saved | null) {
  if (!id) return
  try {
    if (s) localStorage.setItem(LS(id), JSON.stringify(s))
    else localStorage.removeItem(LS(id))
  } catch {
    /* ignore */
  }
}

/** Countdown based on wall-clock timestamps, so it stays right when the tab is throttled. */
export function Timer({ id, minutes, onMinutes, label, big }: { id?: string; minutes: number; onMinutes?: (m: number) => void; label: string; big?: boolean }) {
  const [initial] = useState(() => load(id))
  const [endsAt, setEndsAt] = useState<number | null>(initial?.endsAt ?? null)
  const [left, setLeft] = useState(() => (initial?.endsAt ? Math.max(0, initial.endsAt - Date.now()) : initial?.pausedLeft ?? minutes * 60000))
  const [finished, setFinished] = useState(false)
  const pausedLeft = useRef<number | null>(initial?.pausedLeft ?? null)
  useEffect(() => {
    if (endsAt === null) return
    const tick = () => {
      const l = endsAt - Date.now()
      setLeft(Math.max(0, l))
      if (l <= 0) {
        clearInterval(iv)
        setEndsAt(null)
        setFinished(true)
        save(id, null)
        try {
          navigator.vibrate?.([300, 150, 300])
        } catch {
          /* ignore */
        }
      }
    }
    const iv = setInterval(tick, 250)
    tick()
    return () => clearInterval(iv)
  }, [endsAt, id])
  useEffect(() => {
    if (endsAt === null && pausedLeft.current === null) setLeft(minutes * 60000)
  }, [minutes, endsAt])
  const running = endsAt !== null
  const start = () => {
    setFinished(false)
    const base = pausedLeft.current ?? left
    pausedLeft.current = null
    const at = Date.now() + (base > 0 ? base : minutes * 60000)
    setEndsAt(at)
    save(id, { endsAt: at, pausedLeft: null })
  }
  const pause = () => {
    pausedLeft.current = Math.max(0, (endsAt ?? Date.now()) - Date.now())
    setLeft(pausedLeft.current)
    setEndsAt(null)
    save(id, { endsAt: null, pausedLeft: pausedLeft.current })
  }
  const reset = () => {
    pausedLeft.current = null
    setEndsAt(null)
    setFinished(false)
    setLeft(minutes * 60000)
    save(id, null)
  }
  const total = Math.max(1, minutes * 60000)
  const frac = Math.min(1, Math.max(0, 1 - left / total))
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className={`timer ${big ? 'big' : ''} ${running ? 'running' : ''}`} role="timer" aria-label={label} aria-live="off">
        {mmss(left)}
      </div>
      <span className="timer-track" aria-hidden="true"><i style={{ transform: `scaleX(${frac})` }} /></span>
      {finished && <div className="banner info" role="status"><b>Time is up.</b> {label}</div>}
      <div className="row-flex" style={{ justifyContent: 'center' }}>
        {running ? <button className="btn" onClick={pause}>Pause</button> : <button className="btn primary" onClick={start}>{pausedLeft.current !== null ? 'Resume' : 'Start'}</button>}
        <button className="btn" onClick={reset}>Reset</button>
        {onMinutes && (
          <label className="row-flex small">
            Minutes
            <input className="input" style={{ width: 84 }} type="number" min={1} max={300} value={minutes} disabled={running || pausedLeft.current !== null} onChange={(e) => onMinutes(Math.max(1, Math.min(300, +e.target.value || 1)))} />
          </label>
        )}
        <span className="small">{bn(minutes)} মিনিট</span>
      </div>
    </div>
  )
}
