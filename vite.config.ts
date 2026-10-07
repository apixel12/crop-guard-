/// <reference types="vitest/config" />
import { readdirSync, existsSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import securityHeaders from './security-headers.json' with { type: 'json' }

// Explicitly enumerate every model file so each shard is precached by name
// (a "/models/" prefix alone does not guarantee shards are cached).
const MODEL_DIRS = ['lemon-v1', 'plantvillage-v2']
const modelFiles = MODEL_DIRS.flatMap((d) => {
  const dir = `public/models/${d}`
  return existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.json') || f.endsWith('.bin')).map((f) => `models/${d}/${f}`)
    : []
})

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // never reload mid-scan: a new version takes over on next launch
      includeAssets: ['icons/*.png', 'icons/*.svg', ...modelFiles],
      manifest: {
        name: 'CropGuard',
        short_name: 'CropGuard',
        description: 'Offline plant-leaf disease screening. Photos stay on your device.',
        theme_color: '#2f6b3a',
        background_color: '#f7f6f1',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // same headers as production (vercel.json), so the CSP is exercised before deploy
  preview: { headers: securityHeaders },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
  },
})
