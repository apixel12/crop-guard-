import type { ConditionInfo, Severity } from './types'
import { genericInfo, prettify } from './generic'

export function plantVillageInfo(label: string): ConditionInfo | undefined {
  const [crop, ...rest] = label.split('___')
  if (!rest.length) return undefined
  const cropName = prettify(crop.replace(/\(.*\)/, ''))
  const disease = prettify(rest.join(' ').replace(/\(.*?\)/g, ''))
  const severity: Severity = /healthy/i.test(label) ? 'none' : 'moderate'
  return genericInfo(/healthy/i.test(label) ? 'Healthy' : disease, cropName, severity)
}
