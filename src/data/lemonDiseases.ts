import type { ConditionInfo, Severity } from './types'
import { genericInfo, prettify } from './generic'

const REGULATED = new Set(['Citrus Canker', 'Greening'])

export function lemonInfo(label: string): ConditionInfo | undefined {
  const name = prettify(label.replace(/\s*\(.*\)$/, ''))
  const severity: Severity = label === 'Healthy' ? 'none' : REGULATED.has(label) ? 'regulated' : 'moderate'
  return genericInfo(name, 'Lemon', severity)
}
