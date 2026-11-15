import { describe, expect, it } from 'vitest'
import { advanceLight } from '../visuals/lightMotion'

describe('light motion', () => {
  it('produces the same position and velocity at different frame rates', () => {
    const single = advanceLight(0, 0, 300, 1)
    let state = { value: 0, velocity: 0 }
    for (let i = 0; i < 120; i++) state = advanceLight(state.value, state.velocity, 300, 1 / 120)
    expect(state.value).toBeCloseTo(single.value, 8)
    expect(state.velocity).toBeCloseTo(single.velocity, 8)
  })
  it('keeps motion continuous when its destination reverses', () => {
    const moving = advanceLight(0, 0, 300, 0.1)
    expect(advanceLight(moving.value, moving.velocity, -100, 0)).toEqual(moving)
    const settled = advanceLight(moving.value, moving.velocity, -100, 3)
    expect(settled.value).toBeCloseTo(-100, 5)
    expect(settled.velocity).toBeCloseTo(0, 5)
  })
  it('approaches a stationary destination without oscillation', () => {
    let state = { value: 0, velocity: 0 }
    for (let i = 0; i < 180; i++) {
      const next = advanceLight(state.value, state.velocity, 1, 1 / 60)
      expect(next.value).toBeGreaterThanOrEqual(state.value)
      expect(next.value).toBeLessThanOrEqual(1)
      state = next
    }
    expect(state.value).toBeCloseTo(1, 6)
  })
})
