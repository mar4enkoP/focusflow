import { describe, expect, it } from 'vitest'
import { workspaceRail } from '@/visuals/workspaceRail'

describe('workspace light rail', () => {
  it('keeps the center anchored and the end stops mirrored', () => {
    expect(workspaceRail(0)).toEqual({ x: 0, y: 0, angle: -0 })
    const left = workspaceRail(-1)
    const right = workspaceRail(1)
    expect(left.x).toBe(-right.x)
    expect(left.y).toBe(right.y)
    expect(left.y).toBeLessThan(0)
    expect(left.angle).toBe(-right.angle)
    expect(Math.abs(left.x)).toBeLessThan(65)
    expect(left.angle).toBeGreaterThan(7)
  })
  it('stays on the same circle throughout a direct end-to-end transition', () => {
    for (let step = 0; step <= 100; step++) {
      const point = workspaceRail(-1 + step / 50)
      expect(point.x ** 2 + (point.y + 110) ** 2).toBeCloseTo(110 ** 2, 8)
    }
  })
})
