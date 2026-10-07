import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadImage } from '../src/components/Capture'

describe('untrusted file input', () => {
  it('rejects files that are not images', async () => {
    await expect(loadImage(new Blob(['<svg onload=alert(1)>'], { type: 'text/html' }))).rejects.toThrow(/isn’t a photo/)
  })
  it('rejects oversized files before decoding (decompression bombs)', async () => {
    const big = { size: 61 * 1024 * 1024, type: 'image/png' } as Blob
    await expect(loadImage(big)).rejects.toThrow(/too large/)
  })
})

describe('security headers', () => {
  const h = JSON.parse(readFileSync('security-headers.json', 'utf8'))
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
  it('CSP forbids inline/eval scripts, framing, plugins and off-origin requests', () => {
    const csp: string = h['Content-Security-Policy']
    expect(csp).toMatch(/script-src 'self';/)
    expect(csp).not.toMatch(/unsafe-eval/)
    expect(csp).toMatch(/frame-ancestors 'none'/)
    expect(csp).toMatch(/object-src 'none'/)
    expect(csp).toMatch(/connect-src 'self'/) // photos cannot be sent anywhere
  })
  it('camera only for this origin; microphone and location off', () => {
    expect(h['Permissions-Policy']).toMatch(/camera=\(self\)/)
    expect(h['Permissions-Policy']).toMatch(/microphone=\(\)/)
    expect(h['Permissions-Policy']).toMatch(/geolocation=\(\)/)
  })
  it('production config ships exactly the tested headers', () => {
    const shipped = Object.fromEntries(vercel.headers[0].headers.map((x: { key: string; value: string }) => [x.key, x.value]))
    expect(shipped).toEqual(h)
  })
})
