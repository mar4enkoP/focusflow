import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { disposePinia } from 'pinia'
import { createOwnedPinia } from './workspaceTestUtils'
import { createErrorRecovery } from '../errorRecovery'
import AppBoundary from '../components/AppBoundary.vue'
import { createEmergencyExport } from '../emergencyExport'
import { useTasksStore } from '../stores/tasks'
import { useTimerStore } from '../stores/timer'
import { useFocusHistoryStore } from '../stores/focusHistory'
import { useWorkspaceAccessStore } from '../stores/workspaceAccess'
import { useTaskDeletionStore, UNDO_WINDOW_MS } from '../stores/taskDeletion'
import { installPersistence, STORAGE_KEY } from '../persistence'
import { usePlannerStore } from '../stores/planner'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function workspace() {
  const pinia = createOwnedPinia()
  return {
    pinia,
    tasks: useTasksStore(pinia),
    timer: useTimerStore(pinia),
    history: useFocusHistoryStore(pinia),
    access: useWorkspaceAccessStore(pinia),
    deletion: useTaskDeletionStore(pinia),
  }
}

it('contains render errors, logs once per screen, and caps explicit retries', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const recovery = createErrorRecovery()
  const broken = defineComponent({
    setup() {
      return () => {
        throw new Error('render failed')
      }
    },
  })
  const wrapper = mount(AppBoundary, { props: { recovery }, slots: { default: () => h(broken) } })
  try {
    await nextTick()
    expect(wrapper.get('[role="alert"]').text()).toContain('has not been cleared')
    recovery.report(new Error('cascade'), 'unmount')
    expect(log).toHaveBeenCalledTimes(1)
    for (let count = 0; count < 2; count++) {
      await wrapper.get('button').trigger('click')
      await nextTick()
    }
    expect(wrapper.find('button').exists()).toBe(false)
    expect(log).toHaveBeenCalledTimes(3)
    recovery.retry()
    expect(recovery.failure.value).toBe(true)
  } finally {
    wrapper.unmount()
  }
})

it('routes global Vue errors and unhandled rejections and removes listeners', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const recovery = createErrorRecovery()
  const app = createApp({ render: () => null })
  const stop = recovery.install(app)
  app.config.errorHandler?.(new Error('action failed'), null, 'event handler')
  expect(recovery.failure.value).toBe(true)
  recovery.retry()
  const rejection = new Event('unhandledrejection', { cancelable: true })
  Object.defineProperty(rejection, 'reason', { value: new Error('async failed') })
  window.dispatchEvent(rejection)
  expect(rejection.defaultPrevented).toBe(true)
  expect(log).toHaveBeenCalledTimes(2)
  stop()
  recovery.retry()
  window.dispatchEvent(rejection)
  expect(recovery.failure.value).toBe(false)
})

it('undo restores stable ID, order, paused countdown and measured history in one save', () => {
  vi.useFakeTimers()
  const data = new Map<string, string>()
  const write = vi.fn<(key: string, raw: string) => void>((key, raw) => {
    data.set(key, raw)
  })
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: write })
  const w = workspace()
  const stop = installPersistence(w.pinia)
  try {
    for (const title of ['A', 'B'])
      w.tasks.save({ title, duration: 5, category: 'Work', priority: 'High' })
    const task = { ...w.tasks.tasks[0]! }
    w.timer.select(task.id)
    w.timer.start()
    vi.advanceTimersByTime(5000)
    write.mockClear()
    w.deletion.remove(task.id)
    expect(write.mock.calls.filter(([key]) => key === STORAGE_KEY)).toHaveLength(1)
    write.mockClear()
    expect(w.deletion.undo()).toBe(true)
    expect(w.tasks.tasks[0]).toEqual(task)
    expect(w.timer.selectedId).toBe(task.id)
    expect(w.timer.state).toBe('paused')
    expect(w.timer.remaining).toBe(295000)
    expect(w.history.sessions[0]?.actualMs).toBe(5000)
    expect(w.history.sessions[0]?.since).toBeUndefined()
    expect(write.mock.calls.filter(([key]) => key === STORAGE_KEY)).toHaveLength(1)
    expect(JSON.parse(data.get(STORAGE_KEY)!).tasks[0]).toEqual(task)
  } finally {
    stop()
    disposePinia(w.pinia)
  }
})

it('keeps later timer work and clears undo on repeated deletion, expiry and lock loss', () => {
  vi.useFakeTimers()
  const w = workspace()
  try {
    for (const title of ['A', 'B', 'C']) w.tasks.save({ title, duration: 5, category: 'Work' })
    const [a, b, c] = w.tasks.tasks
    w.timer.select(a!.id)
    w.timer.start()
    w.deletion.remove(a!.id)
    w.timer.select(c!.id)
    w.timer.start()
    w.deletion.undo()
    expect(w.timer.selectedId).toBe(c!.id)
    expect(w.timer.state).toBe('running')
    expect(w.timer.snapshot().saved.some(([id]) => id === a!.id)).toBe(true)
    w.deletion.remove(a!.id)
    w.deletion.remove(b!.id)
    w.deletion.undo()
    expect(w.tasks.tasks.some((task) => task.id === a!.id)).toBe(false)
    w.deletion.remove(b!.id)
    vi.advanceTimersByTime(UNDO_WINDOW_MS)
    expect(w.deletion.undo()).toBe(false)
    w.deletion.remove(c!.id)
    w.access.transition('disposed')
    expect(w.deletion.title).toBe('')
    expect(w.deletion.undo()).toBe(false)
  } finally {
    disposePinia(w.pinia)
  }
  expect(vi.getTimerCount()).toBe(0)
})

it('exports current data without writing and labels raw damaged or unreadable data', () => {
  const w = workspace()
  const write = vi.fn<(key: string, raw: string) => void>(() => {
    throw new DOMException('full', 'QuotaExceededError')
  })
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => {
      if (key === STORAGE_KEY) return '{damaged'
      throw new DOMException('denied', 'SecurityError')
    },
    setItem: write,
  })
  try {
    w.tasks.save({ title: '<img src=x onerror=alert(1)>', duration: 5, category: 'Work' })
    const exported = createEmergencyExport(w.pinia)
    expect(exported.validated).toBe(false)
    expect(exported.stored[STORAGE_KEY]).toBe('{damaged')
    expect(exported.current[STORAGE_KEY]).toMatchObject({ version: 2, tasks: w.tasks.tasks })
    expect(exported.warnings.some((warning) => warning.includes('Could not read'))).toBe(true)
    expect(write).not.toHaveBeenCalled()
  } finally {
    disposePinia(w.pinia)
  }
})

it('restores a saved inactive countdown without changing a newer plan or timer', () => {
  vi.useFakeTimers()
  const w = workspace()
  try {
    for (const title of ['A', 'B']) w.tasks.save({ title, duration: 5, category: 'Work' })
    const [a, b] = w.tasks.tasks
    const planner = usePlannerStore(w.pinia)
    planner.updateSettings({
      minutes: 60,
      breakMinutes: 5,
      breakEvery: 2,
      selectedIds: [a!.id, b!.id],
    })
    planner.generate()
    planner.accept()
    w.timer.select(a!.id)
    w.timer.start()
    vi.advanceTimersByTime(5000)
    w.timer.select(b!.id)
    w.deletion.remove(a!.id)
    w.timer.start()
    const plan = JSON.stringify(planner.snapshot())
    w.deletion.undo()
    expect(w.timer.selectedId).toBe(b!.id)
    expect(w.timer.state).toBe('running')
    expect(w.timer.snapshot().saved.find(([id]) => id === a!.id)?.[1].remaining).toBe(295000)
    expect(w.history.sessions.find((session) => session.taskId === a!.id)?.actualMs).toBe(5000)
    expect(JSON.stringify(planner.snapshot())).toBe(plan)
  } finally {
    disposePinia(w.pinia)
  }
})
