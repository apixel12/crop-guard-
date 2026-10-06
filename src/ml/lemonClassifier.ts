import { runModel, type Prediction } from './classify'
import type { LoadedModel } from './modelLoader'

export function classifyLemon(m: LoadedModel, img: ImageBitmap | HTMLImageElement): Promise<Prediction> {
  if (m.id !== 'lemon-v1') throw new Error('lemon classifier requires the lemon model')
  return runModel(m, img)
}
