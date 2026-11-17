<script setup lang="ts">
import { computed, ref, watch } from 'vue'
const props = defineProps<{
  text: string
  id: string
  reducedMotion?: boolean
  relocate?: boolean
}>()
const heldTop = ref<number>()
const displayedText = ref(props.text)
const lines = computed(() => displayedText.value.split('\n'))
const lineDuration = 400
const lineStagger = 60
const overlapOffset = 240
const appearing = ref(true)
const transitioning = ref(false)
const leavingLines = ref(1)
const enterDelay = computed(() => (appearing.value ? 0 : props.relocate ? 540 : overlapOffset))
// Vue must wait for the nested lines, rather than the stationary outer wrapper.
const duration = computed(() =>
  props.reducedMotion
    ? 0
    : {
        enter: enterDelay.value + lineDuration + (lines.value.length - 1) * lineStagger,
        leave: lineDuration + (leavingLines.value - 1) * lineStagger,
      },
)
function updateText() {
  leavingLines.value = lines.value.length
  displayedText.value = props.text
}
function finishTransition() {
  appearing.value = false
  transitioning.value = false
  // Rapid navigation keeps only the latest requested heading, as in the reference.
  if (displayedText.value !== props.text) updateText()
}
watch(
  () => props.text,
  () => {
    if (!transitioning.value || props.reducedMotion) updateText()
  },
)
const heading = ref<HTMLElement>()
defineExpose({
  focus: () => heading.value?.focus({ preventScroll: true }),
  holdPosition: () => {
    heldTop.value = heading.value?.offsetTop
  },
})
</script>

<template>
  <h1
    :id="id"
    ref="heading"
    class="screen-heading"
    tabindex="-1"
    :style="{ top: heldTop === undefined ? undefined : `${heldTop}px` }"
  >
    <Transition
      name="heading-copy"
      :duration="duration"
      :css="!reducedMotion"
      :mode="relocate ? 'out-in' : undefined"
      appear
      @before-enter="transitioning = true"
      @after-enter="finishTransition"
      @after-leave="heldTop = undefined"
    >
      <span
        :key="displayedText"
        class="heading-copy"
        :style="{ '--line-duration': `${lineDuration}ms`, '--enter-delay': `${enterDelay}ms` }"
      >
        <span
          v-for="(line, index) in lines"
          :key="index"
          class="heading-line"
          :style="{ '--line-delay': `${index * lineStagger}ms` }"
        >
          <span class="heading-line-text">{{ line }}</span>
        </span>
      </span>
    </Transition>
  </h1>
</template>

<style scoped lang="scss">
.screen-heading {
  position: absolute;
  top: var(--screen-title-top);
  left: 50%;
  transform: translateX(-50%);
  width: min(560px, calc(100% - 32px));
  height: var(--screen-title-height);
  overflow: hidden;
  margin: 0;
  color: var(--text);
  text-align: center;
  font-size: 26px;
  line-height: 34px;
  font-weight: 400;
  letter-spacing: -0.6px;
  pointer-events: none;
  &:focus-visible {
    outline: none;
  }
}
.heading-copy,
.heading-line,
.heading-line-text {
  display: block;
}
.heading-copy {
  position: absolute;
  inset: 0 0 auto;
}
.heading-line {
  overflow: hidden;
}
.heading-copy-enter-active .heading-line-text {
  transition: transform var(--line-duration) cubic-bezier(0.333333, 0.666667, 0.666667, 1)
    calc(var(--enter-delay) + var(--line-delay));
}
.heading-copy-leave-active .heading-line-text {
  transition: transform var(--line-duration) cubic-bezier(0.333333, 0, 0.666667, 0.333333)
    var(--line-delay);
}
.heading-copy-enter-from .heading-line-text,
.heading-copy-leave-to .heading-line-text {
  transform: translateY(150%);
}
@media (prefers-reduced-motion: reduce) {
  .heading-line-text {
    transform: none !important;
    transition: none !important;
  }
}
@media (max-height: 650px), (max-width: 480px) {
  .screen-heading {
    font-size: 23px;
    line-height: 30px;
  }
}
</style>
