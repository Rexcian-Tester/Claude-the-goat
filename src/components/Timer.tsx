import { useEffect, useRef, useState } from 'react'
import { bn } from '../data/bn'

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Countdown based on wall-clock timestamps, so it stays right when the tab is throttled. */
export function Timer({ minutes, onMinutes, label, big }: { minutes: number; onMinutes?: (m: number) => void; label: string; big?: boolean }) {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [left, setLeft] = useState(minutes * 60000)
  const [finished, setFinished] = useState(false)
  const pausedLeft = useRef<number | null>(null)
  useEffect(() => {
    if (endsAt === null) return
    const id = setInterval(() => {
      const l = endsAt - Date.now()
      setLeft(Math.max(0, l))
      if (l <= 0) {
        clearInterval(id)
        setEndsAt(null)
        setFinished(true)
        try {
          navigator.vibrate?.([300, 150, 300])
        } catch {
          /* ignore */
        }
      }
    }, 250)
    return () => clearInterval(id)
  }, [endsAt])
  useEffect(() => {
    if (endsAt === null && pausedLeft.current === null) setLeft(minutes * 60000)
  }, [minutes, endsAt])
  const running = endsAt !== null
  const start = () => {
    setFinished(false)
    const base = pausedLeft.current ?? left
    pausedLeft.current = null
    setEndsAt(Date.now() + base)
  }
  const pause = () => {
    pausedLeft.current = Math.max(0, (endsAt ?? Date.now()) - Date.now())
    setLeft(pausedLeft.current)
    setEndsAt(null)
  }
  const reset = () => {
    pausedLeft.current = null
    setEndsAt(null)
    setFinished(false)
    setLeft(minutes * 60000)
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className={`timer ${big ? 'big' : ''}`} role="timer" aria-label={label} aria-live="off">
        {mmss(left)}
      </div>
      {finished && <div className="banner info" role="status"><b>Time is up.</b> {label}</div>}
      <div className="row-flex" style={{ justifyContent: 'center' }}>
        {running ? <button className="btn" onClick={pause}>Pause</button> : <button className="btn primary" onClick={start}>{pausedLeft.current !== null ? 'Resume' : 'Start'}</button>}
        <button className="btn" onClick={reset}>Reset</button>
        {onMinutes && (
          <label className="row-flex small">
            Minutes
            <input className="input" style={{ width: 84 }} type="number" min={1} max={300} value={minutes} disabled={running} onChange={(e) => onMinutes(Math.max(1, Math.min(300, +e.target.value || 1)))} />
          </label>
        )}
        <span className="small">{bn(minutes)} মিনিট</span>
      </div>
    </div>
  )
}
