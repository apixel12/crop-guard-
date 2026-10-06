import { describe, expect, it, beforeAll } from 'vitest'
import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-cpu'
import golden from './fixtures/resize_golden.json'

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

  it('does not leak tensors', () => {
    const before = tf.memory().numTensors
    preprocessRGB(golden.rgb, golden.h, golden.w).dispose()
    expect(tf.memory().numTensors).toBe(before)
  })
})
