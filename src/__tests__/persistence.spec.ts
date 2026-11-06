import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { installPersistence, STORAGE_KEY } from '../persistence'
import { useTasksStore } from '../stores/tasks'
import { useTimerStore } from '../stores/timer'
function boot() {
  const pinia = createPinia()
  installPersistence(pinia)
  return { pinia, tasks: useTasksStore(pinia), timer: useTimerStore(pinia) }
}
beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  })
  vi.useFakeTimers()
  vi.setSystemTime(1000000000)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
it('preserves task edits, order, completion and deletion without duplicate hydration', () => {
  const { tasks, pinia } = boot()
  for (const title of ['A', 'B', 'C']) tasks.save({ title, duration: 30, category: 'Work' })
  const [a, b, c] = tasks.tasks
  tasks.save({ title: 'Edited', duration: 40, category: 'Health' }, a!.id)
  tasks.toggle(b!.id)
  tasks.move(c!.id, -1)
  tasks.remove(c!.id)
  installPersistence(pinia)
  expect(tasks.tasks).toHaveLength(2)
  expect(boot().tasks.tasks).toEqual(tasks.tasks)
})
it.each(['running', 'paused', 'expired'] as const)(
  'restores %s sessions and extensions',
  (mode) => {
    const { tasks, timer } = boot()
    tasks.save({ title: 'A', duration: 30, category: 'Work' })
    timer.select(tasks.tasks[0]!.id)
    timer.start()
    vi.advanceTimersByTime(300000)
    timer.pause()
    timer.addTime()
    if (mode !== 'paused') timer.start()
    vi.advanceTimersByTime(mode === 'expired' ? 3600000 : 600000)
    const restored = boot().timer
    expect(restored.selectedId).toBe(timer.selectedId)
    expect(restored.budget).toBe(2100000)
    expect(restored.remaining).toBe(mode === 'paused' ? 1800000 : mode === 'expired' ? 0 : 1200000)
    expect(restored.state).toBe(mode)
    expect(boot().timer.remaining).toBe(restored.remaining)
    expect(boot().tasks.tasks[0]!.completed).toBe(false)
  },
)
it.each(['{', '{"version":99}', '{"version":1,"tasks":[{}]}'])(
  'preserves invalid input %s',
  (raw) => {
    localStorage.setItem(STORAGE_KEY, raw)
    const { tasks } = boot()
    tasks.save({ title: 'New', duration: 10, category: 'Work' })
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
  },
)
it('does not write during ordinary timer ticks', () => {
  const { tasks, timer } = boot()
  tasks.save({ title: 'A', duration: 30, category: 'Work' })
  timer.select(tasks.tasks[0]!.id)
  timer.start()
  const raw = localStorage.getItem(STORAGE_KEY)
  vi.advanceTimersByTime(10000)
  timer.sync()
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
})
