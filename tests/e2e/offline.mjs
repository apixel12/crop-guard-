// Offline acceptance test (spec §29) in real Chrome: load online, wait for
// "AI ready offline", go offline, reload, scan from gallery and camera, check
// history. Run: npm run build && npx vite preview & npm run test:e2e
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'
mkdirSync('test-results', { recursive: true })
const URL = process.env.E2E_URL ?? 'http://localhost:4173/'
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['camera'] })
const page = await ctx.newPage()
const log = []
page.on('console', m => { if (m.type() === 'error') log.push('console error: ' + m.text()) })
const t = Date.now()
await page.goto(URL)
await page.getByText(/works offline|Everything still works/).waitFor({ timeout: 90000 })
const online = { readyMs: Date.now() - t }
online.cached = await page.evaluate(async () => {
  const urls = (await Promise.all((await caches.keys()).map(async k => (await (await caches.open(k)).keys()).map(r => new URL(r.url).pathname)))).flat()
  return { total: urls.length, models: urls.filter(u => u.startsWith('/models/')).sort() }
})
await page.screenshot({ path: 'test-results/1-home-online.png' })

// ---- go offline (airplane mode) and reload
await ctx.setOffline(true)
const offlineReq = []
page.on('request', r => offlineReq.push(r.url().replace(URL, '/')))
page.on('requestfailed', r => log.push('FAILED offline: ' + r.url()))
await page.reload()
await page.getByText(/works offline|Everything still works/).waitFor({ timeout: 60000 })
await page.screenshot({ path: 'test-results/2-home-offline.png' })

// ---- lemon scan from gallery
await page.getByRole('button', { name: /^Lemon/ }).click()
await page.locator('input[type=file]').setInputFiles(process.env.E2E_PHOTO ?? 'tests/e2e/healthy-lemon.jpg')
await page.getByRole('button', { name: 'Check this leaf' }).click()
await page.locator('.verdict').waitFor({ timeout: 30000 })
const verdict = (await page.locator('.verdict').innerText()).split('\n').filter(Boolean).slice(0, 3).join(' | ')
const meta = await page.locator('.fine-print').last().innerText()
await page.screenshot({ path: 'test-results/3-result-offline.png', fullPage: true })

// ---- camera capture path (Chrome fake camera), still offline
await page.getByRole('button', { name: 'Check another leaf' }).click()
await page.getByRole('button', { name: 'Take photo' }).waitFor({ timeout: 15000 })
await page.screenshot({ path: 'test-results/4-camera.png' })
await page.getByRole('button', { name: 'Take photo' }).click()
await page.getByRole('button', { name: 'Check this leaf' }).click()
await page.locator('.verdict').waitFor({ timeout: 30000 })
const cameraOutcome = (await page.locator('.verdict').innerText()).split('\n').filter(Boolean).slice(2, 5).join(' | ')

// ---- history offline
await page.getByRole('button', { name: 'Plants' }).click()
await page.getByRole('button', { name: 'History' }).first().click()
await page.locator('.list-row').first().waitFor({ timeout: 10000 })
const historyCount = await page.locator('.list-row').count()
await page.screenshot({ path: 'test-results/5-history.png' })

console.log(JSON.stringify({ online, offline: { verdict, meta, cameraOutcome, historyCount,
  requestsWhileOffline: [...new Set(offlineReq)].filter(u => !u.startsWith('blob:') && !u.startsWith('data:')) }, errors: log }, null, 2))
await browser.close()
const fail = !verdict || historyCount < 2 || log.length > 0
if (fail) { console.error('E2E FAILED'); process.exit(1) }
console.log('E2E PASSED')
