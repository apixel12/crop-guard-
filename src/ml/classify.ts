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
  frames?: number // how many images/frames were averaged
}

export type ImageSource = HTMLImageElement | HTMLCanvasElement

/** Class probabilities for one image, exactly as calibrated in training
 * (mirror test-time augmentation, then prior correction). */
export async function predictProbs(m: LoadedModel, img: ImageSource): Promise<Float32Array> {
  const input = toInputTensor(img)
  // Test-time augmentation must match how thresholds were calibrated.
  const out = tf.tidy(() => {
    const p = m.model.predict(input) as tf.Tensor
    if (m.meta.tta !== 'hflip') return p
    const flipped = m.model.predict(tf.reverse(input, 2)) as tf.Tensor
    return tf.div(tf.add(p, flipped), 2)
  })
  try {
    return applyPriorCorrection(await out.data(), m.meta.priorCorrection)
  } finally {
    input.dispose()
    out.dispose()
  }
}

/** Analyse one photo, or several frames of a video: per-frame probabilities
 * are averaged before the confidence decision, so one blurred frame can't
 * swing the result. */
export async function runModel(m: LoadedModel, imgs: ImageSource | ImageSource[]): Promise<Prediction> {
  const t0 = performance.now()
  const list = Array.isArray(imgs) ? imgs : [imgs]
  if (!list.length) throw new Error('No image to analyse.')
  const mean = new Float32Array(m.meta.classCount)
  for (const img of list) {
    const p = await predictProbs(m, img)
    for (let i = 0; i < mean.length; i++) mean[i] += p[i] / list.length
  }
  return { ...assess(mean, m.meta.classes, m.meta.thresholds), modelVersion: m.meta.modelVersion, inferenceMs: performance.now() - t0, frames: list.length }
}
