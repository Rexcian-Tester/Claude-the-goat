import { useEffect } from 'react'

/* Sound, vibration, notifications and screen wake lock, shared by the question timer and Study Blocks. */
let audio: AudioContext | null = null
/** Call from a tap (browsers only allow sound after one). */
export function unlockAudio() {
  try {
    audio ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    void audio.resume()
  } catch {
    /* ignore */
  }
}
export function beep(times = 1) {
  try {
    if (audio) {
      for (let r = 0; r < times; r++)
        for (const [at, f] of [[0, 880], [0.28, 880], [0.56, 1175]] as const) {
          const o = audio.createOscillator()
          const g = audio.createGain()
          o.connect(g)
          g.connect(audio.destination)
          o.frequency.value = f
          const t = audio.currentTime + at + r * 1.1
          g.gain.setValueAtTime(0.0001, t)
          g.gain.exponentialRampToValueAtTime(0.18, t + 0.02)
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
          o.start(t)
          o.stop(t + 0.24)
        }
    }
  } catch {
    /* ignore */
  }
  try {
    // browsers refuse (and log an error) before you have tapped the page once
    if ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive !== false) navigator.vibrate?.([250, 120, 250])
  } catch {
    /* ignore */
  }
}

/** Ask once (from a tap) whether the app may show system notifications. */
export function askNotify() {
  try {
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
  } catch {
    /* ignore */
  }
}
/** A system notification when the app is in the background (works while the app is open or minimised). */
export function notify(title: string, body: string) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted' || document.visibilityState === 'visible') return
    const opts = { body, icon: '/pwa-192.png', badge: '/pwa-192.png', tag: 'mist-study', renotify: true } as NotificationOptions
    if (navigator.serviceWorker?.controller) void navigator.serviceWorker.ready.then((r) => r.showNotification(title, opts))
    else new Notification(title, opts)
  } catch {
    /* ignore */
  }
}

/** keep the phone screen awake while a timer runs */
export function useWakeLock(on: boolean) {
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
