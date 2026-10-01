import { useEffect, useRef, useState } from 'react'
import { dateEn } from '../data/bn'
import { dhakaDate } from '../data/dhaka'
import * as F from '../logic/focus'
import type { FocusConfig, FocusSession } from '../logic/focus'

/* Everything here lives on this device only (localStorage): a session survives page changes and reloads. */
const LS_SESSION = 'mist-focus'
const LS_SETUP = 'mist-focus-setup'
const LS_HISTORY = 'mist-focus-history'
function read<T>(k: string, def: T): T {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : def
  } catch {
    return def
  }
}
function write(k: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}
interface Past {
  at: number
  n: number
  total: number
  avg: number
  from: number
  to: number
  cycleMs: number
  /** per-question times, kept so an older session can be copied again */
  laps?: F.Lap[]
}

/** Copy text; falls back to a hidden textarea where the clipboard API is unavailable. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
function CopyButton({ text, label = 'Copy report', className = 'btn' }: { text: () => string; label?: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const t = setTimeout(() => setState('idle'), 2200)
    return () => clearTimeout(t)
  }, [state])
  return (
    <button type="button" className={`${className} copy-btn ${state}`} onClick={async () => setState((await copyText(text())) ? 'ok' : 'fail')}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {state === 'ok' ? <path d="m5 12 5 5 9-10" /> : <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>}
      </svg>
      <span aria-live="polite">{state === 'ok' ? 'Copied' : state === 'fail' ? 'Copy failed' : label}</span>
    </button>
  )
}
const whenOf = (ms: number) => dateEn(dhakaDate(ms))

const PUSH = [
  "Hard work beats talent when talent doesn't work hard.",
  "You don't get there by resting. Back to work.",
  'Consistency is what turns talent into results.',
  "Every rep counts, even the ones nobody's timing.",
  'Champions are built in the reps no one applauds.',
  'Small disciplined minutes now, big results later.',
]
const FINISH = ["Finish strong. Champions perform when it's hardest.", 'The last one matters as much as the first. Close it out.', 'Pressure is a privilege. Finish this.']
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)]

/* ---------- sound / vibration / screen ---------- */
let audio: AudioContext | null = null
function unlockAudio() {
  try {
    audio ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    void audio.resume()
  } catch {
    /* ignore */
  }
}
function beep() {
  try {
    if (!audio) return
    for (const [at, f] of [[0, 880], [0.28, 880], [0.56, 1175]] as const) {
      const o = audio.createOscillator()
      const g = audio.createGain()
      o.connect(g)
      g.connect(audio.destination)
      o.frequency.value = f
      const t = audio.currentTime + at
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
      o.start(t)
      o.stop(t + 0.24)
    }
  } catch {
    /* ignore */
  }
  try {
    navigator.vibrate?.([250, 120, 250])
  } catch {
    /* ignore */
  }
}
/** keep the phone screen awake while a session runs */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return
    let lock: { release: () => Promise<void> } | null = null
    let live = true
    const get = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock.request('screen').then((l) => (live ? (lock = l) : void l.release())).catch(() => {})
    }
    get()
    document.addEventListener('visibilitychange', get)
    return () => {
      live = false
      document.removeEventListener('visibilitychange', get)
      void lock?.release().catch(() => {})
    }
  }, [on])
}
function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    setNow(Date.now())
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [active])
  return now
}

/* ---------- setup ---------- */
function Setup({ onStart }: { onStart: (c: FocusConfig) => void }) {
  const [c, setC] = useState<FocusConfig>(() => ({ totalMin: 150, cycleMin: 3, startQ: 1, ...read<Partial<FocusConfig>>(LS_SETUP, {}) }))
  const [raw, setRaw] = useState(() => ({ totalMin: String(c.totalMin), cycleMin: String(c.cycleMin), startQ: String(c.startQ) }))
  const history = read<Past[]>(LS_HISTORY, [])
  const p = F.plan(c)
  const field = (k: keyof FocusConfig, label: string, step: number, min: number, hint: string) => (
    <div className="field">
      <label htmlFor={`fc-${k}`}>{label}</label>
      <input
        id={`fc-${k}`}
        className="input"
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={raw[k]}
        onChange={(e) => {
          setRaw({ ...raw, [k]: e.target.value })
          const n = parseFloat(e.target.value)
          if (Number.isFinite(n) && n >= min) setC({ ...c, [k]: n })
        }}
      />
      <span className="small">{hint}</span>
    </div>
  )
  const go = () => {
    write(LS_SETUP, c)
    onStart(c)
  }
  const last = history[0]
  return (
    <div className="stack">
      <div className="card">
        <div className="card-h">
          <h2>New session</h2>
          <span className="small">Question by question, against the clock</span>
        </div>
        <div className="grid3">
          {field('totalMin', 'Total time (minutes)', 5, 1, 'The whole sitting')}
          {field('cycleMin', 'Per question (minutes)', 0.5, 0.1, 'Target for each one')}
          {field('startQ', 'Start at question', 1, 1, 'Numbering only')}
        </div>
        {last && last.to + 1 !== c.startQ && (
          <div>
            <button type="button" className="chip-s" onClick={() => { setC({ ...c, startQ: last.to + 1 }); setRaw({ ...raw, startQ: String(last.to + 1) }) }}>
              Continue from Q{last.to + 1}
            </button>
          </div>
        )}
        <div className="fc-preview">
          <b>{p.count} questions</b> · Q{p.startQ} – Q{p.lastQ} · {F.mmss(p.cycleMs)} each · {F.hms(p.totalMs)} total
        </div>
        <button type="button" className="btn primary big" onClick={go}>Start session</button>
        <p className="small">Space or Enter = done, next question · P = pause. The screen stays awake while it runs, and the session keeps going if you switch pages.</p>
      </div>
      {history.length > 0 && (
        <div className="card">
          <h3>Recent sessions</h3>
          <div className="fc-hist">
            {history.slice(0, 8).map((h) => (
              <div key={h.at} className="fc-hist-r">
                <b>{dateEn(dhakaDate(h.at))}</b>
                <span>Q{h.from}–Q{h.to} · {h.n} done</span>
                <span className="num muted">avg {F.mmss(h.avg)} of {F.mmss(h.cycleMs)} · {F.hms(h.total)}</span>
                {h.laps?.length ? <CopyButton className="btn sm" label="Copy" text={() => F.reportText(h.laps!, h.cycleMs, whenOf(h.at), h.total)} /> : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- running ---------- */
function Ring({ frac, over }: { frac: number; over: boolean }) {
  const R = 92
  const C = 2 * Math.PI * R
  return (
    <svg className={`fc-ring ${over ? 'over' : ''}`} viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r={R} className="trk" />
      <circle cx="100" cy="100" r={R} className="val" strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, frac))} />
    </svg>
  )
}

function Running({ s, save }: { s: FocusSession; save: (n: FocusSession | null) => void }) {
  const now = useNow(F.running(s))
  const v = F.view(s, now)
  const [line, setLine] = useState('')
  const [kept, setKept] = useState(-1) // question index you chose to keep working on after the prompt
  const isLast = s.laps.length + 1 >= s.count
  const prompt = s.alerted && kept !== s.laps.length
  useWakeLock(F.running(s))

  useEffect(() => {
    if (!v.due) return
    beep()
    setLine(pick(isLast ? FINISH : PUSH))
    save(F.markAlerted(s))
  }, [v.due, s, save, isLast])

  const q = F.currentQ(s)
  const nextQ = () => save(F.next(s, Date.now()))
  const toggle = () => save(F.running(s) ? F.pause(s, Date.now()) : F.resume(s, Date.now()))
  const ref = useRef({ nextQ, toggle, prompt })
  ref.current = { nextQ, toggle, prompt }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      // a focused button or field handles its own keys
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A' || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        ref.current.nextQ()
      } else if (e.key.toLowerCase() === 'p') ref.current.toggle()
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [])
  useEffect(() => {
    const t = document.title
    document.title = `${F.mmss(v.spent)} · Q${q} · Focus`
    return () => {
      document.title = t
    }
  })

  return (
    <div className="stack">
      <section className={`focus-hero ${v.overtime ? 'over' : ''} ${F.running(s) ? '' : 'paused'}`} aria-label="Focus session">
        <div className="fc-top">
          <span className="fc-q">Question <b>{q}</b> <span>of Q{s.startQ}–Q{s.startQ + s.count - 1}</span></span>
          {!F.running(s) && <span className="fc-paused">Paused</span>}
        </div>
        <div className="fc-dial">
          <Ring frac={v.spent / s.cycleMs} over={v.overtime} />
          <div className="fc-center" role="timer" aria-label={`Time on this question ${F.mmss(v.spent)}`}>
            <span className="fc-spent">{F.mmss(v.spent)}</span>
            <span className="fc-sub">{v.overtime ? `+${F.mmss(v.spent - s.cycleMs)} over` : `${F.mmss(v.cycleLeft)} left`}</span>
          </div>
        </div>
        <div className="fc-stats">
          <div><b className={v.remaining === 0 ? 'bad' : ''}>{F.hms(v.remaining)}</b><span>Time remaining</span></div>
          <div><b>{F.hms(v.elapsed)}</b><span>Elapsed</span></div>
          <div><b>{v.completed}<small> / {s.count}</small></b><span>Completed</span></div>
        </div>
        <div className="fc-prog" aria-hidden="true"><i style={{ transform: `scaleX(${v.completed / s.count})` }} /></div>
        <button type="button" className="fc-done" onClick={nextQ}>{isLast ? 'Done — finish session' : 'Done — next question'}</button>
        <div className="fc-ctl">
          <button type="button" className="fc-b" onClick={toggle}>{F.running(s) ? 'Pause' : 'Resume'}</button>
          <button type="button" className="fc-b" onClick={() => confirm('End the session now and see the report?') && save(F.finish(s, Date.now()))}>Finish</button>
          <button type="button" className="fc-b ghost" onClick={() => confirm('Throw this session away?') && save(null)}>Reset</button>
        </div>
      </section>

      {prompt && (
        <div className="dlg-scrim" role="presentation">
          <div className="dlg" role="alertdialog" aria-modal="true" aria-labelledby="fc-dlg-t">
            <div className="dlg-ic" aria-hidden="true">⏰</div>
            <p id="fc-dlg-t" className="dlg-t">{isLast ? 'Time is up. That was the last question.' : `Time is up for Q${q}. Start the next one.`}</p>
            <div className="dlg-times" role="timer" aria-live="off" aria-label={`Over time ${F.mmss(v.spent - s.cycleMs)}, time taken ${F.mmss(v.spent)}`}>
              <div className="over"><b>+{F.mmss(v.spent - s.cycleMs)}</b><span>Over time</span></div>
              <div><b>{F.mmss(v.spent)}</b><span>Time taken · target {F.mmss(s.cycleMs)}</span></div>
            </div>
            <p className="dlg-s">{line || pick(PUSH)}</p>
            <button type="button" className="fc-done" autoFocus onClick={nextQ}>{isLast ? 'Finish' : `Next: Q${q + 1}`}</button>
            <button type="button" className="fc-b ghost" onClick={() => setKept(s.laps.length)}>Keep working on Q{q}</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- report ---------- */
function Report({ s, onNew }: { s: FocusSession; onNew: () => void }) {
  const r = F.report(s)
  const scale = Math.max(r.slowest, s.cycleMs) || 1
  return (
    <div className="stack">
      <div className="card accent">
        <div className="card-h">
          <h2>Session report</h2>
          <span className="small">Q{s.startQ}–Q{s.startQ + Math.max(0, r.n - 1)} · target {F.mmss(s.cycleMs)} each</span>
        </div>
        <div className="stat-grid">
          <div className="stat"><b>{r.n}</b><span>Questions</span></div>
          <div className="stat"><b>{F.hms(r.total)}</b><span>Total time</span></div>
          <div className="stat"><b>{F.mmss(r.avg)}</b><span>Average</span></div>
          <div className="stat"><b>{F.mmss(r.fastest)}</b><span>Fastest</span></div>
          <div className="stat"><b>{F.mmss(r.slowest)}</b><span>Slowest</span></div>
        </div>
        <div className="row-flex">
          <span className="fc-tag early">{r.early} early</span>
          <span className="fc-tag ontime">{r.ontime} on time</span>
          <span className="fc-tag over">{r.over} over</span>
        </div>
        {r.n > 0 && (
          <div className="row-flex">
            <CopyButton className="btn primary" text={() => F.reportText(s.laps, s.cycleMs, whenOf(s.startedAt), r.total)} />
            <span className="small">One line per question, ready to paste into a chat.</span>
          </div>
        )}
      </div>
      {r.n > 0 && (
        <div className="card">
          <h3>Question by question</h3>
          <div className="fc-laps" style={{ ['--cyc' as string]: `${(s.cycleMs / scale) * 100}%` }}>
            {s.laps.map((l) => {
              const t = F.tag(l.ms, s.cycleMs)
              return (
                <div key={l.q} className="fc-lap">
                  <span className="q">Q{l.q}</span>
                  <span className="bar"><i className={t} style={{ width: `${(l.ms / scale) * 100}%` }} /></span>
                  <span className="num">{F.mmss(l.ms)}</span>
                  <span className={`fc-tag ${t}`}>{t === 'ontime' ? 'on time' : t}</span>
                </div>
              )
            })}
          </div>
          <p className="small">The thin line marks your target time per question.</p>
        </div>
      )}
      <button type="button" className="btn primary big" onClick={onNew}>New session</button>
    </div>
  )
}

export function FocusView() {
  const [s, setS] = useState<FocusSession | null>(() => read<FocusSession | null>(LS_SESSION, null))
  const save = useRef((n: FocusSession | null) => {
    setS(n)
    write(LS_SESSION, n)
  }).current
  // record finished sessions once
  useEffect(() => {
    if (!s?.done || !s.laps.length) return
    const h = read<Past[]>(LS_HISTORY, [])
    if (h.some((x) => x.at === s.startedAt)) return
    const r = F.report(s)
    write(LS_HISTORY, [{ at: s.startedAt, n: r.n, total: r.total, avg: r.avg, from: s.startQ, to: s.laps[s.laps.length - 1].q, cycleMs: s.cycleMs, laps: s.laps }, ...h].slice(0, 20))
  }, [s])
  return (
    <div className="view">
      <div className="page-h">
        <div className="eyebrow">Focus mode</div>
        <h1>Question timer</h1>
        <p className="small">Discipline over motivation. Stay locked in.</p>
      </div>
      {!s ? (
        <Setup onStart={(c) => { unlockAudio(); save(F.start(c, Date.now())) }} />
      ) : s.done ? (
        <Report s={s} onNew={() => save(null)} />
      ) : (
        <Running s={s} save={(n) => { unlockAudio(); save(n) }} />
      )}
    </div>
  )
}
