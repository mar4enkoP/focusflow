import { onMounted, onUnmounted, watch } from 'vue'
import type { useTimerStore } from '../stores/timer'
import type { useWorkspaceAccessStore } from '../stores/workspaceAccess'

const TIMER_REFRESH_MS = 250

// Deadlines remain the source of truth. Poll only while measuring work, including
// intentional overtime after expiry; reconcile immediately on returning to a tab.
export function useTimerPulse(
  timer: ReturnType<typeof useTimerStore>,
  access: ReturnType<typeof useWorkspaceAccessStore>,
) {
  let pulse: ReturnType<typeof setInterval> | undefined
  let stop: (() => void) | undefined
  function update() {
    clearInterval(pulse)
    pulse = undefined
    if (access.canEdit && !document.hidden && (timer.state === 'running' || timer.isFocusing))
      pulse = setInterval(timer.sync, TIMER_REFRESH_MS)
  }
  function visibilityChanged() {
    timer.sync()
    update()
  }
  onMounted(() => {
    stop = watch(() => [access.canEdit, timer.state, timer.isFocusing], update, { immediate: true })
    document.addEventListener('visibilitychange', visibilityChanged)
  })
  onUnmounted(() => {
    stop?.()
    clearInterval(pulse)
    document.removeEventListener('visibilitychange', visibilityChanged)
  })
}
