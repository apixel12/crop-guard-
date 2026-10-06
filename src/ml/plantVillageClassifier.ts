import { runModel, type Prediction } from './classify'
import type { LoadedModel } from './modelLoader'

/** PlantVillage labels look like "Tomato___Late_blight". */
export const cropOf = (label: string) => label.split('___')[0]

export const PV_CROPS: { key: string; name: string }[] = [
  { key: 'Apple', name: 'Apple' },
  { key: 'Blueberry', name: 'Blueberry' },
  { key: 'Cherry_(including_sour)', name: 'Cherry' },
  { key: 'Corn_(maize)', name: 'Corn' },
  { key: 'Grape', name: 'Grape' },
  { key: 'Orange', name: 'Orange' },
  { key: 'Peach', name: 'Peach' },
  { key: 'Pepper,_bell', name: 'Bell Pepper' },
  { key: 'Potato', name: 'Potato' },
  { key: 'Raspberry', name: 'Raspberry' },
  { key: 'Soybean', name: 'Soybean' },
  { key: 'Squash', name: 'Squash' },
  { key: 'Strawberry', name: 'Strawberry' },
  { key: 'Tomato', name: 'Tomato' },
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
