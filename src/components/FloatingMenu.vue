<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'

const props = withDefaults(defineProps<{ placement?: 'above' | 'below' }>(), {
  placement: 'below',
})
const panel = ref<HTMLElement>()
const supportsPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype
let observer: ResizeObserver | undefined

function position() {
  const element = panel.value
  const anchor = element?.parentElement
  if (!element || !anchor) return
  element.style.position = 'fixed'
  const rect = anchor.getBoundingClientRect()
  const gap = 6
  const margin = 12
  const viewportHeight = window.innerHeight
  const below = Math.max(0, viewportHeight - rect.bottom - gap - margin)
  const above = Math.max(0, rect.top - gap - margin)
  const opensAbove =
    props.placement === 'above' ? above >= 170 || above > below : below < 170 && above > below
  element.style.width = `${Math.min(rect.width, window.innerWidth - margin * 2)}px`
  element.style.left = `${Math.max(margin, Math.min(rect.left, window.innerWidth - rect.width - margin))}px`
  element.style.maxHeight = `${opensAbove ? above : below}px`
  element.style.top = opensAbove ? 'auto' : `${rect.bottom + gap}px`
  element.style.bottom = opensAbove ? `${viewportHeight - rect.top + gap}px` : 'auto'
}

onMounted(() => {
  // The top layer escapes ancestor backdrop roots, while retaining DOM focus/keyboard bubbling.
  position()
  panel.value?.showPopover?.()
  window.addEventListener('resize', position)
  window.addEventListener('scroll', position, true)
  if (typeof ResizeObserver !== 'undefined' && panel.value?.parentElement) {
    observer = new ResizeObserver(position)
    observer.observe(panel.value.parentElement)
  }
})
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', position)
  window.removeEventListener('scroll', position, true)
})
</script>

<template>
  <div ref="panel" :popover="supportsPopover ? 'manual' : undefined" class="floating-menu">
    <slot />
  </div>
</template>

<style scoped lang="scss">
.floating-menu {
  position: fixed;
  inset: auto;
  margin: 0;
  padding: 0;
  z-index: 30;
  overflow-y: auto;
  color: var(--text);
  border: 1px solid var(--floating-glass-edge);
  border-radius: var(--control-radius);
  background: var(--floating-glass-fill);
  box-shadow:
    var(--surface-shadow),
    inset 0 1px 0 #ffffff08;
  -webkit-backdrop-filter: blur(24px) saturate(115%);
  backdrop-filter: blur(24px) saturate(115%);
  scrollbar-width: thin;
  overscroll-behavior: contain;
}
.floating-menu::backdrop {
  background: transparent;
  pointer-events: none;
}
@supports not (backdrop-filter: blur(1px)) {
  .floating-menu {
    background: #1b181b;
  }
}
</style>
