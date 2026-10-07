import { centerSquare } from './preprocess'
/** Cheap pre-inference checks on a downscaled copy of the photo.
 * Thresholds are deliberately conservative: they reject clearly unusable
 * photos only. Tune against real phone shots (see docs/lemon-tree-test.md). */
export const QUALITY = {
  minSide: 160, // px of the original image
  darkMean: 35, // mean luminance 0-255
  brightMean: 235,
  clippedFrac: 0.6, // fraction of near-white or near-black pixels
  blurVar: 18, // Laplacian variance on 160px grayscale
  minPlantFrac: 0.06, // fraction of plant-coloured pixels
} as const

export type QualityIssue = 'too-small' | 'too-dark' | 'too-bright' | 'blurry' | 'no-leaf'

export interface QualityReport {
  ok: boolean
  issues: QualityIssue[]
  stats: { mean: number; clipped: number; blurVar: number; plantFrac: number; w: number; h: number }
}

export function analyzePixels(rgba: Uint8ClampedArray, w: number, h: number, srcW: number, srcH: number): QualityReport {
  const n = w * h
  const gray = new Float32Array(n)
  let sum = 0
  let clipped = 0
  let plant = 0
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2]
    const y = 0.299 * r + 0.587 * g + 0.114 * b
    gray[i] = y
    sum += y
    if (y < 12 || y > 245) clipped++
    // plant-like: green, yellow or brown hues with some saturation
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const sat = max === 0 ? 0 : (max - min) / max
    if (sat > 0.15 && max > 30) {
      let hue = 0
      const d = max - min
      if (max === r) hue = ((g - b) / d) % 6
      else if (max === g) hue = (b - r) / d + 2
      else hue = (r - g) / d + 4
      hue = (hue * 60 + 360) % 360
      if (hue >= 20 && hue <= 170) plant++
    }
  }
  const mean = sum / n
  let lsum = 0, lsq = 0, cnt = 0
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const lap = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i]
      lsum += lap
      lsq += lap * lap
      cnt++
    }
  const blurVar = cnt ? lsq / cnt - (lsum / cnt) ** 2 : 0
  const stats = { mean, clipped: clipped / n, blurVar, plantFrac: plant / n, w: srcW, h: srcH }
  const issues: QualityIssue[] = []
  if (Math.min(srcW, srcH) < QUALITY.minSide) issues.push('too-small')
  if (mean < QUALITY.darkMean) issues.push('too-dark')
  else if (mean > QUALITY.brightMean || stats.clipped > QUALITY.clippedFrac) issues.push('too-bright')
  if (blurVar < QUALITY.blurVar) issues.push('blurry')
  if (stats.plantFrac < QUALITY.minPlantFrac) issues.push('no-leaf')
  return { ok: issues.length === 0, issues, stats }
}

export function checkQuality(img: ImageBitmap | HTMLImageElement): QualityReport {
  const srcW = 'naturalWidth' in img ? img.naturalWidth : img.width
  const srcH = 'naturalHeight' in img ? img.naturalHeight : img.height
  // Judge the same center square the model analyzes (see preprocess.ts).
  const { sx, sy, s: side } = centerSquare(srcW, srcH)
  const w = 160, h = 160
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, sx, sy, side, side, 0, 0, w, h)
  return analyzePixels(ctx.getImageData(0, 0, w, h).data, w, h, side, side)
}

export const ISSUE_TEXT: Record<QualityIssue, string> = {
  'too-small': 'The photo is very small. Move closer, or use a larger photo.',
  'too-dark': 'It’s too dark. Try again in daylight.',
  'too-bright': 'It’s washed out. Step out of direct sun or glare.',
  blurry: 'It’s blurry. Hold still and tap the leaf to focus.',
  'no-leaf': 'The leaf is too small or hard to see. Move closer so one leaf fills the square.',
}
