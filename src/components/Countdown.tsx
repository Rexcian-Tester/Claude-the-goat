import { useEffect, useState } from 'react'
import { bn } from '../data/bn'
import { dhakaDate, diffDays, getTodayOverride } from '../data/dhaka'

/** Live countdown to 00:00 Asia/Dhaka on `target` (Dhaka is UTC+6 all year, no daylight saving). */
const DHAKA_OFFSET = 6 * 3600000
const at = (iso: string) => Date.parse(`${iso}T00:00:00Z`) - DHAKA_OFFSET

/** Wall clock, moved to the Settings test date (same time of day) when one is set. */
function now() {
  const n = Date.now()
  const ov = getTodayOverride()
  return ov ? n + diffDays(dhakaDate(n), ov) * 86400000 : n
}

function useNow() {
  const [t, setT] = useState(now)
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>
    const loop = () => {
      setT(now())
      id = setTimeout(loop, 1000 - (Date.now() % 1000) + 5) // tick on the second boundary
    }
    loop()
    const vis = () => document.visibilityState === 'visible' && setT(now())
    document.addEventListener('visibilitychange', vis)
    return () => {
      clearTimeout(id)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [])
  return t
}

function Unit({ v, label }: { v: number; label: string }) {
  const s = bn(String(v).padStart(2, '0'))
  return (
    <div className="cd-unit">
      <span className="cd-num" key={s}>{s}</span>
      <span className="cd-lbl">{label}</span>
    </div>
  )
}

export function Countdown({ target, from, title, sub }: { target: string; from: string; title: string; sub: string }) {
  const t = useNow()
  const end = at(target)
  const start = at(from)
  const ms = Math.max(0, end - t)
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const pct = Math.min(1, Math.max(0, (t - start) / (end - start)))
  return (
    <section className="countdown" aria-label={`${title}: ${d} days ${h} hours ${m} minutes left`}>
      <div className="cd-head">
        <span className="cd-title">{title}</span>
        <span className="cd-sub">{sub}</span>
      </div>
      {ms === 0 ? (
        <div className="cd-done">Endgame has begun.</div>
      ) : (
        <div className="cd-grid" aria-hidden="true">
          <Unit v={d} label="দিন" />
          <span className="cd-colon">:</span>
          <Unit v={h} label="ঘণ্টা" />
          <span className="cd-colon">:</span>
          <Unit v={m} label="মিনিট" />
          <span className="cd-colon">:</span>
          <Unit v={s} label="সেকেন্ড" />
        </div>
      )}
      <div className="cd-track" aria-hidden="true">
        <i style={{ transform: `scaleX(${pct})` }} />
      </div>
      <div className="cd-foot">
        <span>{bn(Math.round(pct * 100))}% of the study window gone</span>
        <span>Every second counts. One shot.</span>
      </div>
    </section>
  )
}
