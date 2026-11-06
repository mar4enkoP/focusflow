<script setup lang="ts">
import { computed, onBeforeUnmount, watch, useId, ref } from 'vue'

const props = withDefaults(defineProps<{ mode?: 'focus' | 'list' | 'form' }>(), {
  mode: 'focus',
})
const gradientId = useId()
const interiorId = useId()
const focusGradientId = useId()
const fadeId = useId()
const maskId = useId()
const blurId = useId()
const bend = ref(props.mode === 'focus' ? 0 : 1)
let frame: number | undefined

watch(
  () => props.mode,
  (mode) => {
    if (frame !== undefined) cancelAnimationFrame(frame)
    const target = mode === 'focus' ? 0 : 1
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      bend.value = target
      return
    }
    const from = bend.value
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = Math.min((now - start) / 900, 1)
      const eased = 1 - Math.pow(1 - elapsed, 3)
      bend.value = from + (target - from) * eased
      if (elapsed < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
  },
)
onBeforeUnmount(() => {
  if (frame !== undefined) cancelAnimationFrame(frame)
})

// The same open curve bends into a nearly closed circle; no rectangular paint or masks.
const curve = computed(() => {
  const amount = bend.value
  const radiusX = 500 - 80 * amount
  const radiusY = 800 - 380 * amount
  const centerY = 500 * amount
  const sweep = 1.35 + (Math.PI - 0.04 - 1.35) * amount
  return Array.from({ length: 121 }, (_, index) => {
    const angle = -sweep + (2 * sweep * index) / 120
    const x = 500 + radiusX * Math.sin(angle)
    const y = centerY + radiusY * Math.cos(angle)
    return `${index ? 'L' : 'M'}${x.toFixed(3)},${y.toFixed(3)}`
  }).join(' ')
})
</script>

<template>
  <div class="focus-backdrop" :data-mode="mode" aria-hidden="true">
    <svg class="horizon" viewBox="0 0 1000 1000" preserveAspectRatio="none">
      <defs>
        <linearGradient :id="gradientId" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#d82b26" stop-opacity="0.12" />
          <stop offset="25%" stop-color="#ff4925" />
          <stop offset="43%" stop-color="#ff922f" />
          <stop offset="60%" stop-color="#ff6b21" />
          <stop offset="80%" stop-color="#f01840" />
          <stop offset="100%" stop-color="#d82b26" stop-opacity="0.12" />
        </linearGradient>
        <linearGradient :id="focusGradientId" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#a51226" stop-opacity="0" />
          <stop offset="12%" stop-color="#db2525" stop-opacity="0.25" />
          <stop offset="30%" stop-color="#ff401c" />
          <stop offset="45%" stop-color="#ff751e" />
          <stop offset="60%" stop-color="#ff4c16" />
          <stop offset="76%" stop-color="#ff2035" />
          <stop offset="90%" stop-color="#bc102c" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#8b102b" stop-opacity="0" />
        </linearGradient>
        <clipPath :id="interiorId">
          <path :d="`${curve} Z`" />
        </clipPath>
        <linearGradient :id="fadeId" x1="0" y1="0" x2="0" y2="1000" gradientUnits="userSpaceOnUse">
          <stop offset="20%" stop-color="white" stop-opacity="0" />
          <stop offset="45%" stop-color="white" stop-opacity="0.15" />
          <stop offset="75%" stop-color="white" />
        </linearGradient>
        <mask :id="maskId" maskUnits="userSpaceOnUse" x="-200" y="-500" width="1400" height="2000">
          <rect x="-200" y="-500" width="1400" height="2000" :fill="`url(#${fadeId})`" />
        </mask>
        <filter :id="`${blurId}-halo`" x="-50%" y="-100%" width="200%" height="300%">
          <feGaussianBlur stdDeviation="20 110" />
        </filter>
        <filter :id="`${blurId}-band`" x="-50%" y="-100%" width="200%" height="300%">
          <feGaussianBlur stdDeviation="12 65" />
        </filter>
        <filter :id="`${blurId}-core`" x="-50%" y="-100%" width="200%" height="300%">
          <feGaussianBlur stdDeviation="4 24" />
        </filter>
      </defs>
      <g :stroke="`url(#${gradientId})`" fill="none" stroke-linecap="round" :opacity="bend">
        <path class="halo" :d="curve" vector-effect="non-scaling-stroke" />
        <path class="band" :d="curve" vector-effect="non-scaling-stroke" />
        <path class="edge" :d="curve" vector-effect="non-scaling-stroke" />
      </g>
      <g
        :stroke="`url(#${focusGradientId})`"
        fill="none"
        stroke-linecap="round"
        :opacity="1 - bend"
        :mask="`url(#${maskId})`"
      >
        <path class="focus-spill" :d="curve" vector-effect="non-scaling-stroke" />
        <!-- Confine the broad light to the inside of the curve, like the reference horizon. -->
        <g :clip-path="`url(#${interiorId})`">
          <path
            class="focus-halo"
            :d="curve"
            :filter="`url(#${blurId}-halo)`"
            vector-effect="non-scaling-stroke"
          />
          <path
            class="focus-band"
            :d="curve"
            :filter="`url(#${blurId}-band)`"
            vector-effect="non-scaling-stroke"
          />
          <path
            class="focus-core"
            :d="curve"
            :filter="`url(#${blurId}-core)`"
            vector-effect="non-scaling-stroke"
          />
        </g>
        <path class="focus-edge" :d="curve" vector-effect="non-scaling-stroke" />
      </g>
    </svg>
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
  bottom: 88px;
  width: min(1840px, 94vw);
  height: clamp(220px, 32vh, 340px);
  overflow: visible;
  transform: translate(-50%, 0%);
  transition:
    width 900ms cubic-bezier(0.33, 1, 0.68, 1),
    height 900ms cubic-bezier(0.33, 1, 0.68, 1),
    bottom 900ms cubic-bezier(0.33, 1, 0.68, 1),
    transform 900ms cubic-bezier(0.33, 1, 0.68, 1),
    opacity 900ms cubic-bezier(0.33, 1, 0.68, 1);
}

.halo {
  stroke-width: 68px;
  opacity: 0.32;
  filter: blur(32px);
}
.band {
  stroke-width: 24px;
  opacity: 0.65;
  filter: blur(12px);
}
.edge {
  stroke-width: 3px;
  opacity: 0.85;
  filter: blur(3px);
}

.focus-spill {
  stroke-width: 16px;
  opacity: 0.35;
  filter: blur(12px);
}
.focus-halo {
  stroke-width: 180px;
  opacity: 0.28;
}
.focus-band {
  stroke-width: 84px;
  opacity: 0.7;
}
.focus-core {
  stroke-width: 28px;
  opacity: 0.95;
}
.focus-edge {
  stroke-width: 2px;
  opacity: 0.8;
  filter: blur(1.5px);
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
.focus-backdrop[data-mode='list'] .horizon,
.focus-backdrop[data-mode='form'] .horizon {
  width: min(956px, calc(100vw - 32px), calc(100svh - 96px));
  height: min(956px, calc(100vw - 32px), calc(100svh - 96px));
  bottom: 50%;
  transform: translate(-50%, calc(50% + 32px));
  opacity: 0.38;
}
.focus-backdrop[data-mode='form'] .horizon {
  opacity: 0.3;
}
@media (prefers-reduced-motion: reduce) {
  .horizon {
    transition: none;
  }
}
</style>
