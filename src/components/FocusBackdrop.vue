<template>
  <div class="focus-backdrop" aria-hidden="true">
    <div class="horizon">
      <div class="halo" />
      <div class="band" />
      <div class="edge" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.focus-backdrop {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(ellipse 360px 100px at 50% 102%, #ad241523, transparent 100%);
}

.horizon {
  position: absolute;
  left: 50%;
  bottom: 44px;
  width: min(1840px, 104vw);
  height: clamp(220px, 32vh, 340px);
  transform: translateX(-50%);

  // Keep the ellipse un-clipped: its light fades outside the luminous lower edge.
  > div {
    position: absolute;
    inset: 0;
    mask-image:
      linear-gradient(transparent 28%, #000 78%, transparent 100%),
      linear-gradient(90deg, transparent 2%, #000 23%, #000 77%, transparent 98%);
    mask-composite: intersect;
  }
}

.halo {
  background: radial-gradient(
    ellipse 50% 80% at 50% 0%,
    transparent 40%,
    #72102045 66%,
    #ce172873 85%,
    #f3302378 97%,
    #c32b1830 104%,
    transparent 116%
  );
  filter: blur(32px);
  transform: scale(1.04, 1.07);
}

.horizon .band {
  background: linear-gradient(100deg, #d82b26 10%, #ff561c 40%, #ff4b1b 57%, #f01840 85%);
  mask-image:
    radial-gradient(
      ellipse 50% 80% at 50% 0%,
      transparent 50%,
      #0002 66%,
      #0007 80%,
      #000 94%,
      #000 98%,
      transparent 106%
    ),
    linear-gradient(transparent 24%, #000 80%),
    linear-gradient(90deg, transparent 2%, #000 23%, #000 77%, transparent 98%);
  filter: blur(12px);
}

.horizon .edge {
  background: linear-gradient(100deg, #ff3b25 15%, #ff922f 40%, #ff6b21 57%, #ff2340 82%);
  // A narrow elliptical rim with a soft falloff on both sides, rather than a border.
  filter: blur(3px);
  opacity: 0.85;
  mask-image:
    radial-gradient(
      ellipse 50% 80% at 50% 0%,
      transparent 94%,
      #0009 98%,
      #000 99%,
      transparent 101%
    ),
    linear-gradient(transparent 42%, #000 84%),
    linear-gradient(90deg, transparent 5%, #000 28%, #000 72%, transparent 95%);
}

@media (max-width: 600px) {
  .horizon {
    width: 140vw;
    height: 230px;
  }
}

@media (max-height: 600px) {
  .horizon {
    bottom: 64px;
    height: 180px;
  }
}
</style>
