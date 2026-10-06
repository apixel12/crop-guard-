import { describe, expect, it, beforeAll } from 'vitest'
import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-cpu'
import golden from './fixtures/resize_golden.json'
import { resizeBilinearRGB } from '../src/ml/preprocess'

// Same ops as src/ml/preprocess.ts, applied to raw RGB data (jsdom has no canvas pixels)
const preprocessRGB = (rgb: number[], h: number, w: number) =>
  tf.tidy(() =>
    tf.expandDims(tf.clipByValue(tf.image.resizeBilinear(tf.tensor3d(rgb, [h, w, 3], 'float32'), [224, 224], false, true), 0, 255), 0),
  )

describe('preprocessing matches training (tf.image.resize bilinear)', () => {
  beforeAll(async () => { await tf.setBackend('cpu') })

  it('produces [1,224,224,3] float32 in [0,255]', () => {
    const t = preprocessRGB(golden.rgb, golden.h, golden.w)
    expect(t.shape).toEqual([1, 224, 224, 3])
    expect(t.dtype).toBe('float32')
    expect(tf.max(t).dataSync()[0]).toBeLessThanOrEqual(255)
    expect(tf.min(t).dataSync()[0]).toBeGreaterThanOrEqual(0)
    t.dispose()
  })

  it('pixel values match Python golden samples', () => {
    const t = preprocessRGB(golden.rgb, golden.h, golden.w)
    const a = t.arraySync() as number[][][][]
    for (const s of golden.samples)
      s.rgb.forEach((v, c) => expect(a[0][s.y][s.x][c]).toBeCloseTo(v, 2))
    expect(tf.mean(t).dataSync()[0]).toBeCloseTo(golden.mean, 2)
    t.dispose()
  })

  it('app CPU resize (resizeBilinearRGB) matches Python golden samples', () => {
    const out = resizeBilinearRGB(golden.rgb, golden.w, golden.h, 3)
    for (const s of golden.samples)
      s.rgb.forEach((v, c) => expect(out[(s.y * 224 + s.x) * 3 + c]).toBeCloseTo(v, 2))
    expect(out.reduce((a, b) => a + b, 0) / out.length).toBeCloseTo(golden.mean, 2)
  })

  it('app CPU resize matches tf.image.resizeBilinear everywhere', () => {
    const ref = preprocessRGB(golden.rgb, golden.h, golden.w)
    const a = ref.dataSync()
    const b = resizeBilinearRGB(golden.rgb, golden.w, golden.h, 3)
    let max = 0
    for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i]))
    expect(max).toBeLessThan(1e-3)
    ref.dispose()
  })

  it('does not leak tensors', () => {
    const before = tf.memory().numTensors
    preprocessRGB(golden.rgb, golden.h, golden.w).dispose()
    expect(tf.memory().numTensors).toBe(before)
  })
})
