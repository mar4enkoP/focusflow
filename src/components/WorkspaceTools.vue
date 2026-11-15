<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import ThemeSettings from './ThemeSettings.vue'
import AppIcon from './AppIcon.vue'
import SessionPlanner from './SessionPlanner.vue'
import ProductivityAnalytics from './ProductivityAnalytics.vue'
import { usePlannerStore } from '@/stores/planner'
import { useTasksStore } from '@/stores/tasks'
const planner = usePlannerStore()
const tasks = useTasksStore()
const emit = defineEmits<{
  focus: [id: string]
  active: [value: boolean, panel?: 'Planner' | 'Analytics']
  tasks: []
}>()
const opened = ref<'Planner' | 'Analytics' | 'Theme'>()
watch(
  opened,
  (value) => emit('active', !!value && value !== 'Theme', value === 'Theme' ? undefined : value),
  { flush: 'sync' },
)
const dialog = ref<HTMLElement>()
const navigation = ref<HTMLElement>()
const supportsPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype
let opener: HTMLElement | undefined
async function open(panel: 'Planner' | 'Analytics' | 'Theme', event: MouseEvent) {
  opener = event.currentTarget as HTMLElement
  if (opened.value === panel) {
    close()
    return
  }
  opened.value = panel
  await nextTick()
  dialog.value?.showPopover?.()
  dialog.value?.querySelector<HTMLButtonElement>('button')?.focus()
}
function close() {
  dialog.value?.hidePopover?.()
  opened.value = undefined
  opener?.focus()
}
function outside(event: PointerEvent) {
  if (
    !opened.value ||
    dialog.value?.contains(event.target as Node) ||
    navigation.value?.contains(event.target as Node)
  )
    return
  dialog.value?.hidePopover?.()
  opened.value = undefined
}
function escape(event: KeyboardEvent) {
  if (opened.value && event.key === 'Escape') close()
}
onMounted(() => {
  document.addEventListener('pointerdown', outside)
  document.addEventListener('keydown', escape)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', escape)
})
function focus(id: string) {
  close()
  emit('focus', id)
}
function showTasks() {
  close()
  emit('tasks')
}
</script>
<template>
  <nav ref="navigation" aria-label="Workspace tools">
    <button
      type="button"
      aria-label="Planner"
      :aria-expanded="opened === 'Planner'"
      :title="
        planner.overrun
          ? 'A task exceeded its plan. Review the remaining schedule.'
          : 'Plan a focus session'
      "
      @click="open('Planner', $event)"
    >
      <AppIcon name="list" /><span
        v-if="planner.overrun"
        class="review-dot"
        aria-label="Schedule needs review"
      ></span></button
    ><button
      type="button"
      aria-label="Analytics"
      title="Analytics"
      :aria-expanded="opened === 'Analytics'"
      @click="open('Analytics', $event)"
    >
      <AppIcon name="chart" />
    </button>
    <button
      class="theme-trigger"
      type="button"
      aria-label="Тема"
      title="Тема"
      :aria-expanded="opened === 'Theme'"
      @click="open('Theme', $event)"
    >
      <AppIcon name="layers" /><span>Тема</span>
    </button>
  </nav>
  <div
    v-if="opened"
    ref="dialog"
    class="workspace-panel"
    :class="{ 'theme-panel': opened === 'Theme' }"
    role="dialog"
    aria-modal="false"
    :popover="supportsPopover ? 'manual' : undefined"
    aria-labelledby="tool-title"
    @keydown.esc.prevent.stop="close"
  >
    <div class="panel-content">
      <div class="heading">
        <h2 id="tool-title">
          <AppIcon
            :name="opened === 'Planner' ? 'list' : opened === 'Theme' ? 'layers' : 'chart'"
          />{{ opened === 'Theme' ? 'Тема' : opened }}
        </h2>
        <button
          type="button"
          :aria-label="opened === 'Theme' ? 'Закрыть тему' : `Close ${opened}`"
          @click="close"
        >
          <AppIcon name="close" />
        </button>
      </div>
      <SessionPlanner v-if="opened === 'Planner'" @focus="focus" />
      <ProductivityAnalytics v-else-if="opened === 'Analytics'" />
      <ThemeSettings v-else />
    </div>
    <button
      v-if="opened !== 'Theme'"
      class="workspace-dock"
      type="button"
      aria-label="Open task list"
      @click="showTasks"
    >
      <span class="dock-count"
        ><strong>{{ tasks.remaining }}</strong> {{ tasks.remaining === 1 ? 'task' : 'tasks' }} to
        do</span
      >
      <span class="dock-time">{{ tasks.totalMinutes }} min</span>
      <AppIcon name="arrow" />
    </button>
  </div>
</template>
<style scoped lang="scss">
nav button.theme-trigger {
  width: auto;
  padding: 0 10px;
  gap: 7px;
}
.workspace-panel.theme-panel {
  inset: 76px 24px auto auto;
  width: min(340px, calc(100vw - 32px));
  height: auto;
  max-height: calc(100svh - 100px);
}
.theme-panel .panel-content {
  max-height: calc(100svh - 100px);
  background: #151215ed;
}
@media (max-width: 480px) {
  .workspace-panel.theme-panel {
    right: 16px;
  }
}

nav {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  button {
    position: relative;
    background: transparent;
    border-color: transparent;
    color: var(--muted);
    font-size: 12px;
    width: 38px;
    height: 30px;
    padding: 0;
    &:hover,
    &[aria-expanded='true'] {
      color: var(--text);
      background: var(--glass-hover);
      border-color: var(--glass-edge);
    }
  }
  .review-dot {
    position: absolute;
    top: 5px;
    right: 6px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--text);
  }
}
.workspace-panel {
  --panel-bottom: calc(clamp(88px, 16vh, 160px) + 8px);
  position: fixed;
  inset: auto 0 var(--panel-bottom);
  margin: 0 auto;
  z-index: 50;
  width: min(420px, calc(100vw - 32px));
  height: min(540px, calc(100svh - var(--panel-bottom) - 88px));
  max-height: calc(100svh - var(--panel-bottom) - 88px);
  overflow: visible;
  padding: 0;
  border: 0;
  background: transparent;
  animation: reveal 180ms var(--motion-ease);
}
.panel-content {
  height: 100%;
  overflow-y: auto;
  padding: 22px;
  color: var(--text);
  color-scheme: dark;
  background: var(--workspace-glass);
  -webkit-backdrop-filter: blur(24px) saturate(115%);
  backdrop-filter: blur(24px) saturate(115%);
  border: 1px solid #ffffff14;
  border-radius: var(--panel-radius);
  box-shadow:
    0 16px 56px #0005,
    var(--glass-highlight);
  scrollbar-width: thin;
  scrollbar-color: #ffffff24 transparent;
}
.workspace-dock {
  position: absolute;
  top: calc(100% + 24px);
  left: 0;
  width: 100%;
  height: 44px;
  gap: 12px;
  padding: 0 8px;
  font-size: 12px;
  background: transparent;
  border: 0;
  border-radius: 6px;
  color: var(--muted);
  &:hover:not(:disabled) {
    background: transparent;
    color: var(--text);
  }
  .dock-count {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  strong {
    font-size: 24px;
    font-weight: 300;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .dock-time {
    margin-left: auto;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
}
.workspace-panel::backdrop {
  // Keep the actual arc visible to the panel's backdrop filter.
  background: transparent;
  pointer-events: none;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .panel-content {
    background: #151216;
  }
}
.heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 15px;
    font-weight: 400;
    letter-spacing: -0.25px;
    margin: 0;
    svg {
      width: 18px;
      height: 18px;
      color: #d5d1d7;
    }
  }
  button {
    width: 28px;
    height: 28px;
    padding: 0;
    border-color: transparent;
    background: transparent;
    color: var(--muted);
  }
}
@keyframes reveal {
  from {
    transform: translateY(6px);
  }
  to {
    transform: translateY(0);
  }
}
@media (max-width: 480px) {
  nav {
    position: static;
    transform: none;
    margin-left: auto;
    gap: 6px;
    button {
      width: 32px;
      padding: 0;
    }
  }
  .panel-content {
    padding: 14px;
  }
}
</style>
