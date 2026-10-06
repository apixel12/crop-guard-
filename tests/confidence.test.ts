import { describe, expect, it } from 'vitest'
import { assess } from '../src/ml/confidence'

const classes = ['A', 'B', 'C', 'D']
const t = { confidence: 0.7, margin: 0.3 }

describe('confidence assessment', () => {
  it('confident when both thresholds pass', () => {
    const r = assess([0.85, 0.1, 0.03, 0.02], classes, t)
    expect(r.status).toBe('confident')
    expect(r.top[0].label).toBe('A')
    expect(r.top).toHaveLength(3)
    expect(r.margin).toBeCloseTo(0.75)
  })
  it('uncertain when top-1 below threshold', () => {
    expect(assess([0.6, 0.2, 0.1, 0.1], classes, t).status).toBe('uncertain')
  })
  it('uncertain when margin too small even with high top-1', () => {
    expect(assess([0.72, 0.0, 0.0, 0.0].map((v, i) => (i === 1 ? 0.5 : v)), classes, { confidence: 0.5, margin: 0.3 }).status).toBe('uncertain')
  })
  it('ranks by confidence', () => {
    expect(assess([0.1, 0.2, 0.6, 0.1], classes, t).top.map((r) => r.label)).toEqual(['C', 'B', 'A'])
  })
})
