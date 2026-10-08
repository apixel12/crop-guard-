import type { Thresholds } from './modelRegistry'

export interface Ranked {
  index: number
  label: string
  confidence: number
}

export interface Assessment {
  status: 'confident' | 'uncertain'
  top: Ranked[] // top-3
  margin: number
}

/** A result is named when its top class is at or above this probability. */
export const CONFIDENCE_CUTOFF = 0.7

/** Softmax confidence is NOT probability of correctness. The cutoff is fixed
 * at 70% for every model; the per-model thresholds in metadata.json are ignored. */
export function assess(probs: ArrayLike<number>, classes: string[], _t?: Thresholds): Assessment {
  const ranked = Array.from(probs, (p, i) => ({ index: i, label: classes[i], confidence: p }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
  const margin = ranked[0].confidence - (ranked[1]?.confidence ?? 0)
  const ok = ranked[0].confidence >= CONFIDENCE_CUTOFF
  return { status: ok ? 'confident' : 'uncertain', top: ranked, margin }
}
