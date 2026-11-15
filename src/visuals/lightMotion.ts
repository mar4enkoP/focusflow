// Exact critically damped motion: stable across frame rates and interrupted targets.
export function advanceLight(value: number, velocity: number, target: number, seconds: number) {
  const frequency = 9
  const offset = value - target
  const impulse = velocity + frequency * offset
  const decay = Math.exp(-frequency * seconds)
  return {
    value: target + (offset + impulse * seconds) * decay,
    velocity: (velocity - frequency * impulse * seconds) * decay,
  }
}
