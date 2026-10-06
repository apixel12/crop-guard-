import * as tf from '@tensorflow/tfjs-core'
import { assess, type Assessment } from './confidence'
import type { LoadedModel } from './modelLoader'
import { toInputTensor } from './preprocess'

export interface Prediction extends Assessment {
  modelVersion: string
  inferenceMs: number
}

export async function runModel(m: LoadedModel, img: ImageBitmap | HTMLImageElement): Promise<Prediction> {
  const t0 = performance.now()
  const input = toInputTensor(img)
  const out = m.model.predict(input) as tf.Tensor
  try {
    const probs = await out.data()
    return { ...assess(probs, m.meta.classes, m.meta.thresholds), modelVersion: m.meta.modelVersion, inferenceMs: performance.now() - t0 }
  } finally {
    input.dispose()
    out.dispose()
  }
}
