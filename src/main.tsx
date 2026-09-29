import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/noto-serif-bengali/bengali-600.css'
import '@fontsource/noto-serif-bengali/bengali-700.css'
import '@fontsource/noto-serif-bengali/bengali-800.css'
import '@fontsource/noto-serif-bengali/latin-700.css'
import '@fontsource/hind-siliguri/bengali-400.css'
import '@fontsource/hind-siliguri/bengali-500.css'
import '@fontsource/hind-siliguri/bengali-600.css'
import '@fontsource/hind-siliguri/bengali-700.css'
import '@fontsource/hind-siliguri/latin-400.css'
import '@fontsource/hind-siliguri/latin-500.css'
import '@fontsource/hind-siliguri/latin-600.css'
import '@fontsource/hind-siliguri/latin-700.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/app.css'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { loadTodayOverride } from './hooks'
import { store } from './store/store'
import { startSync } from './store/syncClient'

async function boot() {
  // ask the browser not to clear this site's saved progress when storage runs low (weeks of offline use)
  void navigator.storage?.persist?.().catch(() => {})
  await store.init()
  loadTodayOverride()
  startSync()
  // A new deploy takes over in the background; reload into it only once the app is out of sight,
  // never under your fingers while you are ticking or typing.
  let reloadPending = false
  const reloadIfHidden = () => reloadPending && document.visibilityState === 'hidden' && location.reload()
  document.addEventListener('visibilitychange', reloadIfHidden)
  registerSW({
    immediate: true,
    onNeedReload() {
      reloadPending = true
      reloadIfHidden()
    },
  })
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
void boot()
