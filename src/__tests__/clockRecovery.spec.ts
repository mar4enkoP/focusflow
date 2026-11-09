import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { disposePinia } from 'pinia'
import { createOwnedPinia } from './workspaceTestUtils'
import { installPersistence, persistenceNotice, STORAGE_KEY } from '../persistence'
import { useTasksStore } from '../stores/tasks'
import { useTimerStore } from '../stores/timer'
import { useFocusHistoryStore } from '../stores/focusHistory'
import { estimateDuration, validObservation, validSession } from '../estimation'

const epoch = 1_700_000_000_000
const cleanup: (() => void)[] = []
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(epoch)
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: vi.fn<(key: string, value: string) => void>((key, value) => {
      data.set(key, value)
    }),
  })
})
afterEach(() => {
  cleanup.reverse().forEach((stop) => stop())
  cleanup.length = 0
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
function boot() {
  const pinia = createOwnedPinia()
  const stop = installPersistence(pinia)
  cleanup.push(() => {
    stop()
    disposePinia(pinia)
  })
  return {
    tasks: useTasksStore(pinia),
    timer: useTimerStore(pinia),
    history: useFocusHistoryStore(pinia),
  }
}
function setup() {
  const stores = boot()
  stores.tasks.save({ title: 'Work', duration: 30, category: 'Work' })
  stores.timer.select(stores.tasks.tasks[0]!.id)
  stores.timer.start()
  return stores
}
it('preserves tasks and pauses a future deadline on repeated reloads', () => {
  const { tasks, timer } = setup()
  const remaining = timer.remaining
  vi.setSystemTime(epoch - 3_600_000)
  for (let attempt = 0; attempt < 2; attempt++) {
    const restored = boot()
    expect(restored.tasks.tasks).toEqual(tasks.tasks)
    expect(restored.timer.state).toBe('paused')
    expect(restored.timer.remaining).toBe(remaining)
    expect(restored.timer.isFocusing).toBe(false)
    expect(restored.history.sessions[0]!.reliable).toBe(false)
    restored.timer.pause()
  }
})
it('preserves future history and excludes future completions from learning', () => {
  const { timer, history } = setup()
  vi.setSystemTime(epoch + 60_000)
  timer.complete()
  const observation = history.observations[0]!
  vi.setSystemTime(epoch - 1000)
  expect(validObservation(observation)).toBe(true)
  expect(validSession({ ...observation, since: epoch })).toBe(true)
  expect(boot().history.observations).toEqual([observation])
  expect(estimateDuration('Work', 30, [observation]).count).toBe(0)
})
it('does not count overlapping portions after rollback and resume', () => {
  const { timer, history, tasks } = setup()
  vi.setSystemTime(epoch + 60_000)
  timer.pause()
  vi.setSystemTime(epoch + 30_000)
  timer.start()
  vi.setSystemTime(epoch + 45_000)
  history.tick(tasks.tasks[0]!.id)
  expect(history.sessions[0]!.actualMs).toBe(60_000)
  expect(history.sessions[0]!.reliable).toBe(false)
  vi.setSystemTime(epoch + 75_000)
  timer.complete()
  expect(history.observations[0]!.actualMs).toBe(75_000)
  expect(validObservation(history.observations[0])).toBe(true)
  expect(boot().history.observations).toEqual(history.observations)
})
it('marks completion while paused before its last interval unreliable', () => {
  const { timer, history } = setup()
  vi.setSystemTime(epoch + 60_000)
  timer.pause()
  vi.setSystemTime(epoch + 30_000)
  timer.complete()
  expect(history.observations[0]!.reliable).toBe(false)
  expect(validObservation(history.observations[0])).toBe(true)
})
it('persists live rollback recovery without increasing remaining time', () => {
  const { timer, history } = setup()
  vi.setSystemTime(epoch + 60_000)
  timer.sync()
  const remaining = timer.remaining
  vi.setSystemTime(epoch + 59_000)
  timer.sync()
  expect(timer.state).toBe('paused')
  expect(timer.remaining).toBe(remaining)
  expect(history.sessions[0]!.actualMs).toBe(60_000)
  expect(history.sessions[0]!.reliable).toBe(false)
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).timer.state).toBe('paused')
  expect(boot().timer.remaining).toBe(remaining)
})

it.each([1, 2])(
  'recovers version %s without changing the saved budget or extensions',
  (version) => {
    const { timer } = setup()
    vi.setSystemTime(epoch + 60_000)
    timer.pause()
    timer.addTime()
    timer.start()
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    raw.version = version
    if (version === 1) delete raw.focus
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw))
    // Small enough to pass the former deadline <= now + budget check.
    vi.setSystemTime(epoch + 59_000)
    const restored = boot()
    expect(restored.timer.state).toBe('paused')
    expect(restored.timer.remaining).toBe(raw.timer.remaining)
    expect(restored.timer.budget).toBe(raw.timer.budget)
    restored.timer.start()
    vi.setSystemTime(epoch + 69_000)
    restored.timer.sync()
    expect(restored.timer.remaining).toBe(raw.timer.remaining - 10_000)
    restored.timer.complete()
    expect(restored.history.observations[0]!.reliable).toBe(false)
    expect(estimateDuration('Work', 30, restored.history.observations).count).toBe(0)
  },
)

it.each(['timer', 'history'])(
  'preserves malformed %s bytes even during rollback recovery',
  (kind) => {
    const { tasks } = setup()
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    if (kind === 'timer') raw.timer.saved = [null]
    else raw.focus.observations = [{ actualMs: -1 }]
    const original = JSON.stringify(raw)
    localStorage.setItem(STORAGE_KEY, original)
    vi.setSystemTime(epoch - 60_000)
    const restored = boot()
    expect(restored.tasks.tasks).toEqual(tasks.tasks)
    restored.tasks.save({ title: 'New', duration: 10, category: 'Study' })
    restored.timer.start()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original)
  },
)

it('recovers active overtime using history timestamps even without a deadline', () => {
  const { timer, history } = setup()
  vi.setSystemTime(epoch + 31 * 60_000)
  timer.sync()
  expect(timer.state).toBe('expired')
  const actual = history.sessions[0]!.actualMs
  vi.setSystemTime(epoch + 30 * 60_000)
  timer.sync()
  expect(timer.state).toBe('expired')
  expect(timer.isFocusing).toBe(false)
  expect(history.sessions[0]!.actualMs).toBe(actual)
  expect(boot().timer.isFocusing).toBe(false)
})

it('never extends or double-counts intervals on repeated negative ticks', () => {
  const { history, tasks } = setup()
  const id = tasks.tasks[0]!.id
  history.tick(id, epoch + 60_000)
  history.tick(id, epoch + 30_000)
  history.tick(id, epoch + 45_000)
  history.tick(id, epoch + 75_000)
  expect(history.sessions[0]).toMatchObject({
    actualMs: 75_000,
    reliable: false,
    intervals: [{ start: epoch, end: epoch + 75_000 }],
  })
})

it.each(['observation', 'session', 'task', 'completed-session'] as const)(
  'preserves conflicting %s records during rollback recovery and later edits',
  (conflict) => {
    setup()
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    const session = raw.focus.sessions[0]
    const observation = {
      sessionId: 'completed',
      taskId: 'old-task',
      title: 'Old task',
      plannedMinutes: 30,
      actualMs: 60_000,
      reliable: true,
      completedAt: epoch - 1000,
    }
    if (conflict === 'observation') {
      raw.focus.observations = [observation, { ...observation, actualMs: 120_000 }]
    } else if (conflict === 'session') {
      raw.focus.sessions.push({ ...session, actualMs: 1000 })
    } else if (conflict === 'task') {
      raw.focus.sessions.push({ ...session, sessionId: 'different-session' })
    } else {
      raw.focus.observations = [{ ...observation, sessionId: session.sessionId }]
    }
    const original = JSON.stringify(raw)
    localStorage.setItem(STORAGE_KEY, original)
    vi.setSystemTime(epoch - 60_000)
    vi.mocked(localStorage.setItem).mockClear()
    const restored = boot()
    expect(restored.timer.state).toBe('paused')
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original)
    expect(persistenceNotice.value).toContain('preserved')
    restored.tasks.save({ title: 'New task', duration: 10, category: 'Study' })
    restored.timer.start()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original)
    expect(
      vi.mocked(localStorage.setItem).mock.calls.filter(([key]) => key === STORAGE_KEY),
    ).toEqual([])
  },
)

it('deduplicates identical records regardless of object key order and saves recovery', () => {
  setup()
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
  const session = raw.focus.sessions[0]
  const observation = {
    sessionId: 'completed',
    taskId: 'old-task',
    title: 'Old task',
    plannedMinutes: 30,
    actualMs: 60_000,
    reliable: true,
    completedAt: epoch - 1000,
    intervals: [{ start: epoch - 61_000, end: epoch - 1000 }],
  }
  raw.focus.observations = [
    observation,
    {
      ...Object.fromEntries(Object.entries(observation).reverse()),
      intervals: [{ end: epoch - 1000, start: epoch - 61_000 }],
    },
  ]
  raw.focus.sessions.push(Object.fromEntries(Object.entries(session).reverse()))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(raw))
  vi.setSystemTime(epoch - 60_000)
  boot()
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
  expect(saved.timer.state).toBe('paused')
  expect(saved.focus.observations).toEqual([observation])
  expect(saved.focus.sessions).toHaveLength(1)
  expect(persistenceNotice.value).not.toContain('preserved')
})
