import * as tf from '@tensorflow/tfjs-core'
import { assess, type Assessment } from './confidence'
import type { LoadedModel } from './modelLoader'
import { toInputTensor } from './preprocess'

/** Same correction training's evaluate() applied before calibrating thresholds. */
export function applyPriorCorrection(p: ArrayLike<number>, pc?: { alpha: number; classWeights: number[] }): Float32Array {
  const q = Float32Array.from(p)
  if (!pc || !pc.alpha) return q
  let sum = 0
  for (let i = 0; i < q.length; i++) sum += (q[i] *= Math.pow(pc.classWeights[i], -pc.alpha))
  for (let i = 0; i < q.length; i++) q[i] /= sum
  return q
}

export interface Prediction extends Assessment {
  modelVersion: string
  inferenceMs: number
}

export async function runModel(m: LoadedModel, img: ImageBitmap | HTMLImageElement): Promise<Prediction> {
  const t0 = performance.now()
  const input = toInputTensor(img)
  // Test-time augmentation must match how thresholds were calibrated.
  const out = tf.tidy(() => {
    const p = m.model.predict(input) as tf.Tensor
    if (m.meta.tta !== 'hflip') return p
    const flipped = m.model.predict(tf.reverse(input, 2)) as tf.Tensor
    return tf.div(tf.add(p, flipped), 2)
  })
  try {
    const probs = applyPriorCorrection(await out.data(), m.meta.priorCorrection)
    return { ...assess(probs, m.meta.classes, m.meta.thresholds), modelVersion: m.meta.modelVersion, inferenceMs: performance.now() - t0 }
  } finally {
    input.dispose()
    out.dispose()
  }
}
