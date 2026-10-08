export type Severity = 'none' | 'low' | 'moderate' | 'high' | 'regulated'

export interface ConditionInfo {
  name: string
  crop: string
  severity: Severity
  shortDescription: string
  visualSigns: string[]
  generalNextSteps: string[]
  note?: string
}
