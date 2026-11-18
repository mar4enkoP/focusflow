// A single circular rail. Travel angle and the lamp's orientation are independent.
// The center stop stays at the existing anchor; both ends sit above it.
export function workspaceRail(position: number) {
  const theta = position * ((25 * Math.PI) / 180)
  const radius = 110
  return {
    x: radius * Math.sin(theta),
    y: radius * (Math.cos(theta) - 1),
    angle: -12 * position,
  }
}
