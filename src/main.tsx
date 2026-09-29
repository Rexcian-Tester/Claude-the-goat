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
  await store.init()
  loadTodayOverride()
  startSync()
  registerSW({ immediate: true })
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
void boot()
