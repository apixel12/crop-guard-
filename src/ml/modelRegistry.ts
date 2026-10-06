export type ModelId = 'lemon-v1' | 'plantvillage-v1'

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
}

export const MODELS: Record<ModelId, { label: string; base: string }> = {
  'lemon-v1': { label: 'Lemon', base: '/models/lemon-v1' },
  'plantvillage-v1': { label: 'PlantVillage', base: '/models/plantvillage-v1' },
}

export const modelUrl = (id: ModelId) => `${MODELS[id].base}/model.json`
export const metadataUrl = (id: ModelId) => `${MODELS[id].base}/metadata.json`
