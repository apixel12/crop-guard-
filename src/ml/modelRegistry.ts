export type ModelId = 'lemon-v1' | 'plantvillage-v2'

export interface Thresholds {
  confidence: number
  margin: number
  coverage?: number
  precisionAccepted?: number
  testCoverage?: number
  testPrecisionAccepted?: number
  calibratedOn?: string
}

export interface ModelMetadata {
  modelVersion: ModelId
  architecture: string
  format: 'tfjs_graph_model'
  inputSize: [number, number]
  inputShape: [number, number, number, number]
  colorMode: 'RGB'
  dataset: string
  classCount: number
  classes: string[]
  normalization: { inputRange: [number, number]; inModel: boolean; formula: string; resize: string }
  trainingDate: string
  thresholds: Thresholds
  metrics: Record<string, number | string>
  license: string
  /** test-time augmentation used when calibrating thresholds */
  tta?: 'hflip'
}

export const MODELS: Record<ModelId, { label: string; base: string }> = {
  'lemon-v1': { label: 'Lemon', base: '/models/lemon-v1' },
  'plantvillage-v2': { label: 'PlantVillage', base: '/models/plantvillage-v2' },
}

export const modelUrl = (id: ModelId) => `${MODELS[id].base}/model.json`
export const metadataUrl = (id: ModelId) => `${MODELS[id].base}/metadata.json`
