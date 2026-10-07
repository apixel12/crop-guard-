import { runModel, type Prediction } from './classify'
import type { LoadedModel } from './modelLoader'

/** PlantVillage labels look like "Tomato___Late_blight". */
export const cropOf = (label: string) => label.split('___')[0]

/** Ordered by how commonly home gardeners grow them (National Gardening Association survey). */
export const PV_CROPS: { key: string; name: string }[] = [
  { key: 'Tomato', name: 'Tomato' },
  { key: 'Pepper,_bell', name: 'Bell pepper' },
  { key: 'Bean', name: 'Bean' },
  { key: 'Squash', name: 'Squash' },
  { key: 'Potato', name: 'Potato' },
  { key: 'Strawberry', name: 'Strawberry' },
  { key: 'Corn_(maize)', name: 'Corn' },
  { key: 'Grape', name: 'Grape' },
  { key: 'Apple', name: 'Apple' },
  { key: 'Peach', name: 'Peach' },
  { key: 'Cherry_(including_sour)', name: 'Cherry' },
  { key: 'Blueberry', name: 'Blueberry' },
  { key: 'Raspberry', name: 'Raspberry' },
  { key: 'Orange', name: 'Orange' },
  { key: 'Soybean', name: 'Soybean' },
]

export interface PVPrediction extends Prediction {
  cropMismatch: boolean
}

/** Runs the full 38-way model. If the top class belongs to a different crop
 * than the user selected, the result is forced to "uncertain" instead of
 * renormalising inside the chosen crop (which would fabricate confidence). */
export async function classifyPlantVillage(
  m: LoadedModel,
  img: ImageBitmap | HTMLImageElement,
  cropKey: string,
): Promise<PVPrediction> {
  if (m.id !== 'plantvillage-v2') throw new Error('requires the PlantVillage model')
  const p = await runModel(m, img)
  const cropMismatch = cropOf(p.top[0].label) !== cropKey
  return { ...p, cropMismatch, status: cropMismatch ? 'uncertain' : p.status }
}
