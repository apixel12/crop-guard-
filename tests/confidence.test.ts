import { describe, expect, it } from 'vitest'
import { assess } from '../src/ml/confidence'

const classes = ['A', 'B', 'C', 'D']

describe('confidence assessment', () => {
  it('confident when top-1 is at least 70%', () => {
    const r = assess([0.85, 0.1, 0.03, 0.02], classes)
    expect(r.status).toBe('confident')
    expect(r.top[0].label).toBe('A')
    expect(r.top).toHaveLength(3)
    expect(r.margin).toBeCloseTo(0.75)
  })
  it('confident at 72% even with a close runner-up', () => {
    expect(assess([0.72, 0.28, 0, 0], classes).status).toBe('confident')
  })
  it('uncertain when top-1 below 70%', () => {
    expect(assess([0.6, 0.2, 0.1, 0.1], classes).status).toBe('uncertain')
  })
  it('ranks by confidence', () => {
    expect(assess([0.1, 0.2, 0.6, 0.1], classes).top.map((r) => r.label)).toEqual(['C', 'B', 'A'])
  })
})
