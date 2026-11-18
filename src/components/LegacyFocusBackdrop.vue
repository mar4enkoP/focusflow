<script setup lang="ts">
import { computed, onBeforeUnmount, watch, useId, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    mode?: 'focus' | 'list' | 'form' | 'workspace'
    arriving?: boolean
    running?: boolean
    workspaceView?: 'Planner' | 'Analytics' | 'Appearance' | 'Data'
  }>(),
  { mode: 'focus', running: false },
)
// Keep the completed animation attached: removing it on the parent's timer can
// truncate the final frame, especially under load or at different zoom levels.
const traceArrival = ref(false)
watch(
  () => [props.arriving, props.mode] as const,
  ([arriving, mode]) => {
    if (mode !== 'list') traceArrival.value = false
    else if (arriving) traceArrival.value = true
  },
  { immediate: true },
)
const isCircle = computed(() => props.mode === 'list' || props.mode === 'form')
const gradientId = useId()
const interiorId = useId()
const focusGradientId = useId()
const fadeId = useId()
const maskId = useId()
const blurId = useId()
const bend = ref(props.mode === 'focus' || props.mode === 'workspace' ? 0 : 1)
const flat = ref(props.mode === 'workspace' ? 1 : 0)
const lift = ref(props.mode === 'focus' && props.running ? 1 : 0)
let frame: number | undefined

watch(
  () => [props.mode, props.running, props.workspaceView] as const,
  ([mode, running]) => {
    if (frame !== undefined) cancelAnimationFrame(frame)
    const target = mode === 'focus' || mode === 'workspace' ? 0 : 1
    const flatTarget = mode === 'workspace' ? 1 : 0
    const liftTarget = mode === 'focus' && running ? 1 : 0
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      bend.value = target
      flat.value = flatTarget
      lift.value = liftTarget
      return
    }
    const from = bend.value
    const flatFrom = flat.value
    const liftFrom = lift.value
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = Math.min((now - start) / 900, 1)
      const eased = 1 - Math.pow(1 - elapsed, 3)
      bend.value = from + (target - from) * eased
      flat.value = flatFrom + (flatTarget - flatFrom) * eased
      lift.value = liftFrom + (liftTarget - liftFrom) * eased
      if (elapsed < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
  },
)
onBeforeUnmount(() => {
  if (frame !== undefined) cancelAnimationFrame(frame)
})

// The open horizon closes fully at the top when it becomes a circle.
const curve = computed(() => {
  const amount = bend.value
  // Deepen the bowl around its fixed bottom: centerY + radiusY stays unchanged.
  const radiusX = 500 - 80 * amount + 20 * lift.value
  const radiusY = 800 - 380 * amount + 350 * lift.value
  const centerY = 500 * amount - 350 * lift.value
  const sweep = 1.35 + (Math.PI - 1.35) * amount
  const path = Array.from({ length: 121 }, (_, index) => {
    const angle = -sweep + (2 * sweep * index) / 120
    const x = 500 + radiusX * Math.sin(angle)
    const curvedY = centerY + radiusY * Math.cos(angle)
    const y = curvedY + (800 - curvedY) * flat.value
    return `${index ? 'L' : 'M'}${x.toFixed(3)},${y.toFixed(3)}`
  }).join(' ')
  return amount === 1
    ? 'M796.985 203.015 A420 420 0 1 1 203.015 796.985 A420 420 0 1 1 796.985 203.015 Z'
    : path
})
</script>

<template>
  <div
    class="focus-backdrop"
    :class="{ 'list-arrival': traceArrival }"
    :data-mode="mode"
    :data-running="running"
    aria-hidden="true"
  >
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
        <!-- A straight path has zero bounding-box height: use SVG coordinates so
             its gradient remains visible after the morph finishes. -->
        <linearGradient
          :id="focusGradientId"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="1000"
          y2="0"
        >
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
          <!-- The closing circle must clip to its own contour. The horizon's
               remote top corners create a triangular light leak as its ends meet. -->
          <path :d="!isCircle && flat > 0 ? `${curve} L1000,-500 L0,-500 Z` : `${curve} Z`" />
        </clipPath>
        <linearGradient :id="fadeId" x1="0" y1="0" x2="0" y2="1000" gradientUnits="userSpaceOnUse">
          <stop offset="20%" stop-color="white" stop-opacity="0" />
          <stop offset="45%" stop-color="white" :stop-opacity="0.15 + 0.15 * lift" />
          <stop :offset="`${75 - 8 * lift}%`" stop-color="white" />
        </linearGradient>
        <mask :id="maskId" maskUnits="userSpaceOnUse" x="-200" y="-500" width="1400" height="2000">
          <rect x="-200" y="-500" width="1400" height="2000" :fill="`url(#${fadeId})`" />
        </mask>
        <filter
          :id="`${blurId}-halo`"
          filterUnits="userSpaceOnUse"
          x="-500"
          y="-1000"
          width="2000"
          height="3000"
        >
          <feGaussianBlur :stdDeviation="`20 ${110 + 40 * lift}`" />
        </filter>
        <filter
          :id="`${blurId}-band`"
          filterUnits="userSpaceOnUse"
          x="-500"
          y="-1000"
          width="2000"
          height="3000"
        >
          <feGaussianBlur :stdDeviation="`12 ${65 + 15 * lift}`" />
        </filter>
        <filter
          :id="`${blurId}-core`"
          filterUnits="userSpaceOnUse"
          x="-500"
          y="-1000"
          width="2000"
          height="3000"
        >
          <feGaussianBlur stdDeviation="4 24" />
        </filter>
      </defs>
      <g class="light-emission" style="transform-origin: 500px 800px">
        <g :stroke="`url(#${gradientId})`" fill="none" stroke-linecap="round" :opacity="bend">
          <g :clip-path="isCircle ? `url(#${interiorId})` : undefined">
            <path
              class="halo"
              pathLength="100"
              :d="curve"
              :vector-effect="isCircle ? undefined : 'non-scaling-stroke'"
            />
            <path
              class="band"
              pathLength="100"
              :d="curve"
              :vector-effect="isCircle ? undefined : 'non-scaling-stroke'"
            />
          </g>
          <path
            class="edge"
            pathLength="100"
            :d="curve"
            :vector-effect="isCircle ? undefined : 'non-scaling-stroke'"
          />
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
              :style="{ strokeWidth: `${180 + 140 * lift}px`, opacity: 0.28 + 0.14 * lift }"
              :d="curve"
              :filter="`url(#${blurId}-halo)`"
              vector-effect="non-scaling-stroke"
            />
            <path
              class="focus-band"
              :style="{ strokeWidth: `${84 + 80 * lift}px`, opacity: 0.7 + 0.2 * lift }"
              :d="curve"
              :filter="`url(#${blurId}-band)`"
              vector-effect="non-scaling-stroke"
            />
            <path
              class="focus-core"
              :style="{ strokeWidth: `${28 + 24 * lift}px` }"
              :d="curve"
              :filter="`url(#${blurId}-core)`"
              vector-effect="non-scaling-stroke"
            />
          </g>
          <path class="focus-edge" :d="curve" vector-effect="non-scaling-stroke" />
        </g>
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

.focus-backdrop[data-mode='focus'][data-running='true'] .horizon {
  width: min(1960px, 100vw);
}

@media (max-width: 600px) {
  .horizon {
    width: 140vw;
    height: 230px;
  }
  .focus-backdrop[data-mode='focus'][data-running='true'] .horizon {
    width: 148vw;
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
  opacity: 0.62;
}

.focus-backdrop[data-mode='list'] .horizon,
.focus-backdrop[data-mode='form'] .horizon {
  width: min(1052px, calc(100vw - 16px), calc(100svh - 24px));
  height: min(1052px, calc(100vw - 16px), calc(100svh - 24px));
}
.focus-backdrop[data-mode='form'] .horizon {
  transform: translate(-50%, calc(50% + 32px)) scale(0.94);
}
.focus-backdrop[data-mode='workspace'] .horizon {
  width: min(2040px, 110vw);
}
.focus-backdrop[data-mode='list'],
.focus-backdrop[data-mode='form'] {
  background: none;
  .halo {
    stroke-width: 84px;
    opacity: 0.38;
    filter: blur(22px);
  }
  .band {
    stroke-width: 34px;
    opacity: 0.75;
    filter: blur(8px);
  }
  .edge {
    stroke: #ff4935;
    stroke-width: 2.2px;
    opacity: 1;
    filter: none;
  }
  &.list-arrival {
    .edge {
      animation:
        trace-circle 2600ms cubic-bezier(0.25, 0.6, 0.3, 1) both,
        circle-ignite 380ms ease-out both;
    }
    .halo,
    .band {
      animation:
        trace-circle 2420ms cubic-bezier(0.25, 0.6, 0.3, 1) 180ms both,
        circle-ignite 500ms ease-out 180ms both;
    }
  }
}
@keyframes circle-ignite {
  from {
    stroke-opacity: 0;
  }
  to {
    stroke-opacity: 1;
  }
}
@keyframes trace-circle {
  from {
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
  }
  to {
    stroke-dasharray: 100;
    stroke-dashoffset: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .focus-backdrop[data-mode='list'].list-arrival {
    .edge,
    .halo,
    .band {
      animation: none;
    }
  }
  .horizon {
    transition: none;
  }
}
</style>
