/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// Which commit this build is (Cloudflare Pages sets CF_PAGES_COMMIT_SHA), shown in Settings so you can tell
// whether your screen runs the latest deploy or an older saved copy.
function commit() {
  if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD').toString().trim()
  } catch {
    return 'local'
  }
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(commit()), __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'MIST Prep',
        short_name: 'MIST Prep',
        description: 'MIST Unit-A study plan and chapter priority map',
        theme_color: '#15241b',
        background_color: '#FDF6E3',
        display: 'standalone',
        orientation: 'any',
        start_url: '/#/today',
        scope: '/',
        lang: 'bn',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
