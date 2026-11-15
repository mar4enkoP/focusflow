import { afterEach, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { createOwnedPinia } from './workspaceTestUtils'
import { useTimerStore } from '../stores/timer'
import { useTasksStore } from '../stores/tasks'
import { useWorkspaceAccessStore } from '../stores/workspaceAccess'
import { useTimerPulse } from '../composables/useTimerPulse'

afterEach(() => vi.useRealTimers())

it('polls only active visible work, reconciles return, and cleans up', async () => {
  vi.useFakeTimers()
  const pinia = createOwnedPinia()
  const timer = useTimerStore(pinia)
  const tasks = useTasksStore(pinia)
  const access = useWorkspaceAccessStore(pinia)
  const sync = vi.spyOn(timer, 'sync')
  let hidden = false
  const visibility = vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  const wrapper = mount(
    defineComponent({
      setup() {
        useTimerPulse(timer, access)
        return () => null
      },
    }),
  )
  try {
    expect(vi.getTimerCount()).toBe(0)
    tasks.save({ title: 'Work', duration: 1, category: 'Work' })
    timer.select(tasks.tasks[0]!.id)
    timer.start()
    await nextTick()
    expect(vi.getTimerCount()).toBe(1)
    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(61_000)
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()
    expect(timer.state).toBe('expired')
    expect(vi.getTimerCount()).toBe(1) // Overtime is still measured.
    timer.pause()
    await nextTick()
    expect(vi.getTimerCount()).toBe(0)
    timer.continueFocus()
    await nextTick()
    expect(vi.getTimerCount()).toBe(1)
    access.transition('disposed')
    await nextTick()
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    wrapper.unmount()
    visibility.mockRestore()
  }
  sync.mockClear()
  document.dispatchEvent(new Event('visibilitychange'))
  expect(sync).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})
