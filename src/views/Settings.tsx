import { useRef, useState } from 'react'
import { getTodayOverride } from '../data/dhaka'
import { changeTodayOverride, useToday } from '../hooks'
import { downloadBackup, importBackup } from '../store/exportImport'
import { getPasscode, setPasscode, syncNow, useSyncState } from '../store/syncClient'
import { store } from '../store/store'
import { applyTheme, getTheme, type Theme } from '../ui-state'
import { toast } from '../components/ui'

export function SettingsView() {
  const today = useToday()
  const sync = useSyncState()
  const [pass, setPass] = useState(getPasscode())
  const [theme, setTheme] = useState<Theme>(getTheme())
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const file = useRef<HTMLInputElement>(null)
  const ov = getTodayOverride()
  const last = sync.lastAt ? new Date(sync.lastAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' }) + ' (Dhaka)' : 'never'

  const doImport = async (f: File | undefined) => {
    if (!f) return
    if (mode === 'replace' && !confirm('Replace ALL progress on this device with the backup? Anything not in the backup is cleared (and will sync to your other devices).')) return
    try {
      const n = await importBackup(f, mode)
      toast(`Imported ${n} field${n === 1 ? '' : 's'} (${mode}).`)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      if (file.current) file.current.value = ''
    }
  }

  return (
    <div className="view">
      <div className="page-h"><div className="eyebrow">Settings</div><h1>Settings</h1></div>

      <div className="card">
        <h2>Sync across devices</h2>
        <p className="small">Enter the same passcode on every device (the one you set as the <code>SYNC_PASSCODE</code> secret in Cloudflare). Everything works offline; sync catches up when you're online. It never overwrites the other device: each tick merges by its own timestamp.</p>
        <form className="field" onSubmit={(e) => { e.preventDefault(); setPasscode(pass.trim()) }}>
          <label htmlFor="pass">Passcode</label>
          <div className="row-flex" style={{ flexWrap: 'nowrap' }}>
            <input id="pass" className="input" type="password" autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Not set: progress stays on this device only" />
            <button className="btn primary" type="submit">Save</button>
          </div>
        </form>
        <div className="row-flex">
          <span className={`chip-s ${sync.status === 'synced' ? 'ok' : sync.status === 'auth' || sync.status === 'error' ? 'bad' : sync.status === 'conflict' ? 'warn' : ''}`}><span className="dot" />{sync.status}</span>
          <span className="small">Last synced: {last} · {sync.pending} change{sync.pending === 1 ? '' : 's'} pending</span>
        </div>
        {sync.message && <p className="small" role="status">{sync.message}</p>}
        <div className="row-flex">
          <button className="btn" onClick={() => syncNow()} disabled={!getPasscode()}>Sync now</button>
          {getPasscode() && <button className="btn danger" onClick={() => { setPasscode(''); setPass('') }}>Remove passcode from this device</button>}
        </div>
      </div>

      <div className="card">
        <h2>Backup</h2>
        <p className="small">Export everything (ticks, notes, reflections, formula sheets, statuses) as a JSON file, and import it back.</p>
        <div className="row-flex">
          <button className="btn primary" onClick={downloadBackup}>Export backup</button>
          <div className="seg" role="group" aria-label="Import mode">
            <button aria-pressed={mode === 'merge'} onClick={() => setMode('merge')}>Merge</button>
            <button aria-pressed={mode === 'replace'} onClick={() => setMode('replace')}>Replace</button>
          </div>
          <button className="btn" onClick={() => file.current?.click()}>Import backup…</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
        </div>
        <p className="small">Merge keeps whichever side edited each field most recently. Replace makes this device match the file exactly.</p>
      </div>

      <div className="card">
        <h2>Appearance</h2>
        <div className="seg" role="group" aria-label="Theme">
          {(['system', 'light', 'dark'] as Theme[]).map((t) => (
            <button key={t} aria-pressed={theme === t} onClick={() => { setTheme(t); applyTheme(t) }}>{t}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Test date</h2>
        <p className="small">Pretend it's another day (Asia/Dhaka), for previewing endgame mode or a catch-up scenario. This stays on this device only and is never synced. Today is <b>{today}</b>{ov ? ' (overridden)' : ''}.</p>
        <div className="row-flex">
          <input className="input" style={{ width: 180 }} type="date" value={ov ?? ''} min="2026-09-01" max="2026-12-31" onChange={(e) => changeTodayOverride(e.target.value || null)} aria-label="Test date" />
          {ov && <button className="btn" onClick={() => changeTodayOverride(null)}>Back to real today</button>}
        </div>
      </div>

      <div className="card">
        <h2>This device</h2>
        <p className="small">Device id <code>{store.deviceId}</code>. To install: on iPhone use Share → Add to Home Screen; on Android use the browser menu → Install app; on Mac Chrome/Edge use the install icon in the address bar.</p>
        <div><button className="btn danger" onClick={async () => { if (confirm('Delete all progress stored on THIS device? If sync is on, it will download again from the server.')) { await store.wipeLocal(); toast('Local data cleared.') } }}>Clear local data</button></div>
      </div>
    </div>
  )
}
