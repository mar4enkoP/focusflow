<script setup lang="ts">
import { advanceLight } from '@/visuals/lightMotion'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    mode?: 'focus' | 'list' | 'form' | 'workspace'
    running?: boolean
    workspaceView?: 'Planner' | 'Analytics'
    compact?: boolean
    welcome?: boolean
  }>(),
  { mode: 'focus', running: false },
)
const id = useId()
const root = ref<HTMLElement>()
// One curve, one position, one animation clock. All optical layers share its geometry.
type Light = {
  x: number
  y: number
  width: number
  bend: number
  angle: number
  power: number
  depth: number
  concentration: number
  radiance: number
  form: number
  opening: number
}
const light = ref<Light>({
  x: 0,
  y: 0,
  width: 400,
  bend: 60,
  angle: 0,
  power: 0,
  depth: 160,
  concentration: 0,
  radiance: 0,
  form: 0,
  opening: 0,
})
let frame = 0
let settle: ReturnType<typeof setTimeout> | undefined
let observer: ResizeObserver | undefined
let motion: MediaQueryList | undefined
let target: Light = { ...light.value }
let interaction: HTMLElement | undefined
let observedPanel: Element | undefined
let layoutFrame = 0
const passage = ref(1)
let passageStart = -Infinity
const velocity = Object.fromEntries(Object.keys(light.value).map((key) => [key, 0])) as Light
function stopMotion() {
  cancelAnimationFrame(frame)
  for (const key of Object.keys(velocity) as (keyof Light)[]) velocity[key] = 0
}

function move(destination: Light) {
  if (
    Object.keys(destination).every(
      (key) => destination[key as keyof Light] === target[key as keyof Light],
    )
  )
    return
  cancelAnimationFrame(frame)
  target = destination
  if (motion?.matches) {
    stopMotion()
    light.value = { ...destination }
    passage.value = 1
    return
  }
  // First appearance fades in at its anchor instead of flying from the viewport corner.
  const listArrival = light.value.power === 0 && props.mode === 'list'
  if (light.value.power === 0)
    light.value = {
      ...destination,
      power: 0,
      concentration: listArrival ? 0 : destination.concentration,
    }
  let previous = performance.now()
  const arrivalStart = previous
  function animate(now: number) {
    const seconds = Math.max(0, (now - previous) / 1000)
    previous = now
    const state = { ...light.value }
    let settled = true
    for (const key of Object.keys(state) as (keyof Light)[]) {
      const next = advanceLight(state[key], velocity[key], destination[key], seconds)
      state[key] = next.value
      velocity[key] = next.velocity
      const tolerance = ['power', 'concentration', 'radiance', 'form', 'opening'].includes(key)
        ? 0.001
        : 0.05
      if (
        Math.abs(next.value - destination[key]) > tolerance ||
        Math.abs(next.velocity) > tolerance
      )
        settled = false
    }
    if (listArrival) {
      const progress = Math.min(1, (now - arrivalStart) / 1400)
      const intensity = 1 - (1 - progress) ** 3
      state.power = destination.power * intensity
      state.concentration = destination.concentration * intensity
      if (progress < 1) settled = false
    }
    light.value = settled ? { ...destination } : state
    passage.value = Math.min(1, (now - passageStart) / 1400)
    if (!settled || passage.value < 1) frame = requestAnimationFrame(animate)
    else stopMotion()
  }
  frame = requestAnimationFrame(animate)
}

function locate() {
  const shell = root.value?.parentElement
  if (!shell) return
  const bounds = shell.getBoundingClientRect()
  const w = bounds.width
  const h = bounds.height
  const selector = {
    form: '.creation form',
    list: '.task-panel',
    workspace: '.workspace-panel',
    focus: '.focus',
  }[props.mode]
  const element = shell.querySelector(selector)
  // During out-in transitions, hold the previous destination until the next panel exists.
  if (!element) return
  if (element !== observedPanel) {
    if (observedPanel) observer?.unobserve(observedPanel)
    observer?.observe(element)
    observedPanel = element
  }
  const panel = element.getBoundingClientRect()
  if (props.mode === 'list') {
    // The entrance of the task panel must not retarget the light mid-reveal.
    const transform = getComputedStyle(element).transform
    if (transform && transform !== 'none') {
      const matrix = new DOMMatrixReadOnly(transform)
      panel.x -= matrix.m41
      panel.y -= matrix.m42
    }
  }
  const cx = panel ? panel.left + panel.width / 2 - bounds.left : w / 2
  const cy = panel ? panel.top + panel.height / 2 - bounds.top : h / 2
  const compact = w < 600
  let pose: Omit<Light, 'concentration' | 'radiance' | 'form' | 'opening'>
  const bottom = panel ? panel.bottom - bounds.top : h * 0.72
  if (props.mode === 'focus') {
    // The light is a landscape behind the interface, not an object fitted into
    // the gap between controls. Keep its scale even in short windows.
    const bend = Math.min(props.running ? 160 : 130, h * 0.18)
    const rim = h - (h < 600 ? 76 : 100)
    pose = {
      x: w / 2,
      y: rim - bend,
      width: Math.min(w * (compact ? 1.12 : 0.78), props.running ? 1060 : 860),
      bend,
      depth: Math.min(props.running ? 370 : 300, h * (props.running ? 0.4 : 0.34)),
      angle: 0,
      power: props.running ? 0.96 : 0.88,
    }
  } else if (props.mode === 'workspace') {
    const analytics = props.workspaceView === 'Analytics'
    pose = analytics
      ? {
          x: cx,
          y: bottom - 120,
          width: Math.min(w * 0.94, panel.width + 300),
          bend: 145,
          depth: 220,
          angle: 0,
          power: 0.9,
        }
      : {
          x: cx,
          y: bottom - 8,
          width: Math.min(w * 0.85, 630),
          bend: 8,
          depth: 185,
          angle: 0,
          power: 0.65,
        }
  } else if (props.mode === 'form' && props.welcome) {
    // Match the approved welcome bow in viewport coordinates. Both forms and
    // the list now keep this same source alive across panel transitions.
    const opening = props.compact ? 0 : 1
    const scale = (580 / 600) * (1 + opening * 0.04)
    const anchor = (110 - opening * 45 - 150) * scale
    const angle = (-12 * Math.PI) / 180
    pose = {
      x: cx - Math.sin(angle) * anchor,
      y: panel.top - bounds.top + 140 + opening * 110 + Math.cos(angle) * anchor,
      width: (550 + opening * 30) * scale,
      bend: (110 + opening * 65) * scale,
      depth: (160 - opening * 15) * scale,
      angle: -12,
      power: 1,
    }
  } else if (props.mode === 'form') {
    // Measure the resting form position, not its transient slide-in translation.
    // Otherwise the first fade starts too low and the next layout read lifts it.
    const scene = element.closest('.creation')
    const transform = scene ? getComputedStyle(scene).transform : 'none'
    const slideY = transform && transform !== 'none' ? new DOMMatrixReadOnly(transform).m42 : 0
    // Match the approved welcome bow in viewport coordinates. Both forms and
    // the list now keep this same source alive across panel transitions.
    const opening = props.compact ? 0 : 1
    const scale = (580 / 600) * (1 + opening * 0.04)
    const welcomeCurve = props.compact ? 24 : 0
    // Raise the shoulders while keeping the lower light near the title field.
    const anchor = (110 - opening * 45 - 150 - welcomeCurve) * scale
    const angle = (-12 * Math.PI) / 180
    // In the compact scene, place the crescent between the heading and field;
    // its lower bloom overlaps the glass rather than sitting below the input.
    const compactLift = props.compact ? 48 : 0
    pose = {
      x: cx - Math.sin(angle) * anchor,
      y:
        panel.top -
        slideY -
        bounds.top +
        70 -
        compactLift +
        opening * 110 +
        Math.cos(angle) * anchor,
      width: (550 - (props.compact ? 30 : 0) + opening * 30) * scale,
      bend: (110 + welcomeCurve + opening * 65) * scale,
      depth: (160 - opening * 15) * scale,
      angle: -12,
      power: 1,
    }
  } else {
    pose = {
      x: cx + 30,
      y: bottom - 70,
      width: Math.min(w * 0.85, 600),
      bend: 155,
      depth: 160,
      angle: -12,
      power: 0.65,
    }
  }
  const destination: Light = {
    ...pose,
    form: props.mode === 'form' ? 1 : 0,
    opening: props.compact ? 0 : 1,
    radiance: props.mode === 'focus' ? 1 : props.workspaceView === 'Analytics' ? 0.45 : 0,
    concentration:
      props.mode === 'list'
        ? 0.72
        : props.mode === 'workspace'
          ? props.workspaceView === 'Analytics'
            ? 0.5
            : 0.3
          : 0,
  }
  if (
    interaction?.isConnected &&
    panel &&
    interaction.closest(selector) &&
    props.mode !== 'focus' &&
    props.mode !== 'form' &&
    props.workspaceView !== 'Analytics'
  ) {
    const rect = interaction.getBoundingClientRect()
    destination.y += Math.max(
      -65,
      Math.min(65, (rect.top + rect.height / 2 - bounds.top - cy) * 0.35),
    )
    destination.depth *= 0.9
  }
  if (compact && props.mode !== 'focus' && props.mode !== 'form') {
    destination.width = Math.min(destination.width, w * 0.85)
    destination.depth *= 0.75
    destination.bend *= 0.8
    destination.power *= 0.8
  }
  move(destination)
}
function relayout() {
  cancelAnimationFrame(layoutFrame)
  layoutFrame = requestAnimationFrame(locate)
}
function schedule() {
  void nextTick(locate)
  clearTimeout(settle)
  // Re-measure after the existing out-in panel transition has mounted its destination.
  settle = setTimeout(locate, 360)
}
function interact(event: Event) {
  if (!(event.target instanceof Element)) return
  const control = event.target.closest<HTMLElement>('input, select, button')
  if (!control || !root.value?.parentElement?.contains(control)) return
  interaction = control
  schedule()
}
function motionChanged() {
  if (motion?.matches) {
    stopMotion()
    light.value = { ...target }
    passage.value = 1
  }
}
watch(
  () => [props.mode, props.running, props.workspaceView, props.compact],
  () => {
    interaction = undefined
    passageStart = performance.now()
    passage.value = motion?.matches ? 1 : 0
    schedule()
  },
)
onMounted(() => {
  motion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  motion?.addEventListener('change', motionChanged)
  document.addEventListener('focusin', interact)
  document.addEventListener('click', interact)
  window.addEventListener('resize', relayout)
  document.addEventListener('scroll', relayout, true)
  if (typeof ResizeObserver !== 'undefined' && root.value?.parentElement) {
    observer = new ResizeObserver(relayout)
    observer.observe(root.value.parentElement)
    // The centered welcome step changes the content area's top as it expands.
    const content = root.value.parentElement.querySelector('main')
    if (content) observer.observe(content)
  }
  schedule()
})
defineExpose({ refresh: schedule })
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  clearTimeout(settle)
  observer?.disconnect()
  motion?.removeEventListener('change', motionChanged)
  document.removeEventListener('focusin', interact)
  document.removeEventListener('click', interact)
  window.removeEventListener('resize', relayout)
  document.removeEventListener('scroll', relayout, true)
  cancelAnimationFrame(layoutFrame)
})
// A single luminous aperture: its lower lip stays crisp while light diffuses inward.
// Cubic control points interpolate continuously between a slit, crescent and oval.
const geometry = computed(() => {
  const { width, bend, depth, form, opening } = light.value
  const r = width / 2
  const lower = 0.55 + form * ((60 + opening * 30) / (110 + opening * 65) - 0.55)
  const shoulder = 0.55 + form * ((150 + opening * 10) / (275 + opening * 15) - 0.55)
  const upper = 0.7 + form * ((90 - opening * 10) / (160 - opening * 15) - 0.7)
  const ripple = Math.sin(Math.PI * passage.value) ** 2 * 10
  const lip = `M ${-r} 0 C ${-r} ${bend * lower - ripple} ${-r * shoulder} ${bend - ripple} 0 ${bend} C ${r * shoulder} ${bend + ripple} ${r} ${bend * lower + ripple} ${r} 0`
  return {
    lip,
    body: `${lip} C ${r} ${-depth * upper} ${r * shoulder} ${-depth} 0 ${-depth} C ${-r * shoulder} ${-depth} ${-r} ${-depth * upper} ${-r} 0 Z`,
  }
})
</script>

<template>
  <div
    ref="root"
    class="focus-backdrop"
    :data-mode="mode"
    :data-running="running"
    aria-hidden="true"
  >
    <svg class="light-field" width="100%" height="100%">
      <defs>
        <linearGradient
          :id="`${id}-form-volume`"
          gradientUnits="userSpaceOnUse"
          x1="0"
          :y1="-light.depth"
          x2="0"
          :y2="light.bend"
        >
          <stop offset="0" stop-color="#a51d08" stop-opacity="0" />
          <stop offset=".6" stop-color="#ef3e0c" stop-opacity=".04" />
          <stop offset=".84" stop-color="#f64409" stop-opacity=".18" />
          <stop offset=".95" stop-color="#ff8217" stop-opacity=".5" />
          <stop
            offset="1"
            :stop-color="`rgb(255 ${233 - light.opening * 41} ${172 - light.opening * 32})`"
            stop-opacity=".7"
          />
        </linearGradient>
        <linearGradient :id="`${id}-form-rim`">
          <stop offset="0" stop-color="#ff761c" stop-opacity="0" />
          <stop
            offset=".52"
            :stop-color="`rgb(255 ${231 - light.opening * 43} ${165 - light.opening * 28})`"
            :stop-opacity="0.65 - light.opening * 0.1"
          />
          <stop offset="1" stop-color="#ff6017" stop-opacity="0" />
        </linearGradient>
        <linearGradient :id="`${id}-form-fade`">
          <stop offset="0" stop-color="white" stop-opacity="0" />
          <stop offset=".25" stop-color="white" />
          <stop offset=".75" stop-color="white" />
          <stop offset="1" stop-color="white" stop-opacity="0" />
        </linearGradient>
        <mask
          :id="`${id}-form-mask`"
          maskUnits="userSpaceOnUse"
          :x="-light.width"
          :y="-light.depth - 180"
          :width="light.width * 2"
          :height="light.depth + light.bend + 360"
        >
          <rect
            :x="-light.width * 0.55"
            :y="-light.depth - 180"
            :width="light.width * 1.1"
            :height="light.depth + light.bend + 360"
            :fill="`url(#${id}-form-fade)`"
          />
        </mask>
        <radialGradient
          :id="`${id}-passage`"
          gradientUnits="userSpaceOnUse"
          :cx="light.width * (passage - 0.5)"
          :cy="light.bend * 0.9"
          :r="light.width * 0.25"
        >
          <stop offset="0" stop-color="#ffd6a4" stop-opacity=".8" />
          <stop offset=".35" stop-color="#ff934a" stop-opacity=".4" />
          <stop offset="1" stop-color="#ef541b" stop-opacity="0" />
        </radialGradient>
        <linearGradient
          :id="`${id}-volume`"
          gradientUnits="userSpaceOnUse"
          x1="0"
          :y1="-light.depth"
          x2="0"
          :y2="light.bend"
        >
          <stop offset="0" stop-color="#a51d08" stop-opacity="0" />
          <stop offset=".22" stop-color="#d52a07" stop-opacity=".08" />
          <stop
            :offset="0.48 + light.concentration * 0.48"
            stop-color="#f64409"
            stop-opacity=".32"
          />
          <stop
            :offset="0.72 + light.concentration * 0.3"
            stop-color="#ff8217"
            stop-opacity=".75"
          />
          <stop
            :offset="0.91 + light.concentration * 0.1 - light.radiance * 0.065"
            stop-color="#ffc747"
          />
          <stop offset="1" stop-color="#ffe9ac" />
        </linearGradient>
        <radialGradient :id="`${id}-envelope`" cx="50%" cy="70%" r="50%">
          <stop offset="0" stop-color="white" />
          <stop offset=".55" stop-color="white" stop-opacity=".95" />
          <stop offset="1" stop-color="white" stop-opacity="0" />
        </radialGradient>
        <linearGradient
          :id="`${id}-rim`"
          gradientUnits="userSpaceOnUse"
          :x1="-light.width / 2"
          y1="0"
          :x2="light.width / 2"
          y2="0"
        >
          <stop offset="0" stop-color="#ff761c" stop-opacity="0" />
          <stop offset=".3" stop-color="#ffb53b" stop-opacity=".5" />
          <stop offset=".52" stop-color="#ffe7a5" stop-opacity=".85" />
          <stop offset=".8" stop-color="#ffab32" stop-opacity=".4" />
          <stop offset="1" stop-color="#ff6017" stop-opacity="0" />
        </linearGradient>
        <linearGradient
          :id="`${id}-air-color`"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0" stop-color="#d92a0c" stop-opacity="0" />
          <stop offset=".55" stop-color="#ef3e0c" stop-opacity=".2" />
          <stop offset="1" stop-color="#ff6515" stop-opacity=".75" />
        </linearGradient>
        <clipPath :id="`${id}-aperture`"><path :d="geometry.body" /></clipPath>
        <mask
          :id="`${id}-falloff`"
          maskUnits="userSpaceOnUse"
          :x="-light.width"
          :y="-light.depth * 2"
          :width="light.width * 2"
          :height="(light.depth + light.bend) * 3"
        >
          <rect
            :x="-light.width / 2"
            :y="-light.depth"
            :width="light.width"
            :height="light.depth + light.bend + 1"
            :fill="`url(#${id}-envelope)`"
          />
        </mask>
        <filter
          v-for="[name, blur] in [
            ['air', 52],
            ['bloom', 16],
            ['soft', 7],
            ['edge', 3],
          ]"
          :id="`${id}-${name}`"
          :key="name"
          filterUnits="userSpaceOnUse"
          :x="-light.width / 2 - 180"
          :y="-light.depth - 180"
          :width="light.width + 360"
          :height="light.depth + light.bend + 360"
        >
          <feGaussianBlur :stdDeviation="blur" />
        </filter>
      </defs>
      <g
        :transform="`translate(${light.x} ${light.y}) rotate(${light.angle})`"
        :opacity="light.power"
      >
        <g v-if="light.form > 0" :opacity="light.form" :mask="`url(#${id}-form-mask)`">
          <path
            :d="geometry.body"
            :fill="`url(#${id}-form-volume)`"
            style="filter: blur(40px)"
            :opacity="0.55 + light.opening * 0.13"
          />
          <path
            :d="geometry.body"
            :fill="`url(#${id}-form-volume)`"
            :style="{ filter: `blur(${9 - light.opening}px)` }"
            :opacity="0.7 + light.opening * 0.2"
          />
          <path
            :d="geometry.lip"
            fill="none"
            :stroke="`url(#${id}-form-rim)`"
            :stroke-width="1 + light.opening"
            :style="{ filter: `blur(${2 + light.opening * 0.5}px)` }"
            :opacity="0.4 + light.opening * 0.15"
          />
        </g>
        <g v-if="light.form < 1" :opacity="1 - light.form">
          <!-- The air, bloom and aperture all emit from the same filled shape. -->
          <path
            :d="geometry.body"
            :fill="`url(#${id}-air-color)`"
            :filter="`url(#${id}-air)`"
            :opacity="0.52 + light.radiance * 0.23"
          />
          <path
            :d="geometry.body"
            :fill="`url(#${id}-volume)`"
            :filter="`url(#${id}-bloom)`"
            opacity=".45"
          />
          <g :clip-path="`url(#${id}-aperture)`" :mask="`url(#${id}-falloff)`">
            <path :d="geometry.body" :fill="`url(#${id}-volume)`" :filter="`url(#${id}-soft)`" />
          </g>
          <!-- A soft caustic follows the same aperture edge, giving the wide
             focus source a luminous lip without introducing another light. -->
          <path
            :d="geometry.lip"
            fill="none"
            :stroke="`url(#${id}-rim)`"
            :filter="`url(#${id}-edge)`"
            stroke-width="5"
            :opacity="light.radiance * 0.55"
          />
          <path
            :d="geometry.lip"
            fill="none"
            :stroke="`url(#${id}-rim)`"
            stroke-width=".8"
            opacity=".72"
          />
        </g>
        <g v-if="passage < 1" :opacity="Math.sin(Math.PI * passage) ** 2">
          <path
            :d="geometry.body"
            :fill="`url(#${id}-passage)`"
            style="filter: blur(18px)"
            opacity=".45"
          />
          <path
            :d="geometry.lip"
            fill="none"
            :stroke="`url(#${id}-passage)`"
            stroke-width="4"
            style="filter: blur(4px)"
            opacity=".65"
          />
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
  overflow: hidden;
}
.light-field {
  position: absolute;
  inset: 0;
  overflow: visible;
}
</style>
