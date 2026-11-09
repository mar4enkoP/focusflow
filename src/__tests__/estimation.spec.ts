import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { createOwnedPinia as createPinia } from './workspaceTestUtils'
import { mount } from '@vue/test-utils'
import { estimateDuration, validObservation, type Observation } from '../estimation'
import { useFocusHistoryStore } from '../stores/focusHistory'
import { useTasksStore } from '../stores/tasks'
import { useTimerStore } from '../stores/timer'
import { installPersistence, STORAGE_KEY, persistenceNotice } from '../persistence'
import TaskForm from '../components/TaskForm.vue'
import FocusTimer from '../components/FocusTimer.vue'

function boot() {
  const pinia = createPinia()
  setActivePinia(pinia)
  installPersistence(pinia)
  return {
    pinia,
    tasks: useTasksStore(pinia),
    timer: useTimerStore(pinia),
    history: useFocusHistoryStore(pinia),
  }
}
function setup(duration = 30) {
  const stores = boot()
  stores.tasks.save({ title: 'Programming', duration, category: 'Study', priority: 'High' })
  stores.timer.select(stores.tasks.tasks[stores.tasks.tasks.length - 1]!.id)
  return stores
}
function elapsed(timer: ReturnType<typeof useTimerStore>, minutes: number) {
  for (let i = 0; i < minutes; i++) {
    vi.advanceTimersByTime(60000)
    timer.sync()
  }
}
function observation(minutes: number, index = 0): Observation {
  return {
    sessionId: `s${index}`,
    taskId: `t${index}`,
    title: 'Programming',
    plannedMinutes: 30,
    actualMs: minutes * 60000,
    completedAt: Date.now() - index,
    reliable: true,
  }
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1700000000000)
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: vi.fn<(k: string, v: string) => void>((k, v) => {
      storage.set(k, v)
    }),
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('accumulates multiple intervals, excludes pauses, and ignores repeated sync/start', () => {
  const { timer, history } = setup()
  timer.start()
  elapsed(timer, 2)
  timer.pause()
  vi.advanceTimersByTime(3600000)
  timer.start()
  timer.start()
  elapsed(timer, 3)
  timer.sync()
  timer.complete()
  expect(history.observations[0]).toMatchObject({
    actualMs: 300000,
    plannedMinutes: 30,
    reliable: true,
  })
})
it('keeps measuring past zero without completing; overtime supports pause and resume', () => {
  const { timer, tasks, history } = setup(1)
  timer.start()
  elapsed(timer, 3)
  expect(timer.state).toBe('expired')
  expect(tasks.tasks[0]!.completed).toBe(false)
  expect(timer.isFocusing).toBe(true)
  timer.pause()
  vi.advanceTimersByTime(600000)
  timer.continueFocus()
  elapsed(timer, 2)
  timer.complete()
  expect(history.observations[0]!.actualMs).toBe(300000)
})
it('preserves focus through extensions and resets without changing the original plan', () => {
  const { timer, history } = setup(1)
  timer.start()
  elapsed(timer, 2)
  timer.addTime()
  expect(timer.isFocusing).toBe(false)
  timer.start()
  elapsed(timer, 1)
  timer.addTime()
  elapsed(timer, 1)
  timer.reset()
  timer.start()
  elapsed(timer, 1)
  timer.complete()
  expect(history.observations[0]).toMatchObject({ actualMs: 300000, plannedMinutes: 1 })
})
it('isolates switched tasks and records completion from the task list', () => {
  const { timer, tasks, history } = setup()
  const first = timer.selectedId!
  tasks.save({ title: 'Other', duration: 10, category: 'Work' })
  const second = tasks.tasks[1]!.id
  timer.start()
  elapsed(timer, 2)
  timer.select(second)
  timer.start()
  elapsed(timer, 3)
  tasks.toggle(first)
  expect(history.observations[0]).toMatchObject({ taskId: first, actualMs: 120000 })
  timer.complete()
  expect(history.observations[1]).toMatchObject({ taskId: second, actualMs: 180000 })
})
it('does not fabricate untracked completions or learn from deleted/incomplete tasks', () => {
  const { timer, tasks, history } = setup()
  tasks.toggle(timer.selectedId!)
  expect(history.observations).toEqual([])
  tasks.toggle(tasks.tasks[0]!.id)
  timer.select(tasks.tasks[0]!.id)
  timer.start()
  elapsed(timer, 1)
  tasks.remove(timer.selectedId!)
  expect(history.observations).toEqual([])
  expect(history.sessions).toEqual([])
})
it('deduplicates completion across toggles/reloads and retains records after deletion', () => {
  const { timer, tasks, history } = setup()
  const id = timer.selectedId!
  timer.start()
  elapsed(timer, 1)
  timer.complete()
  tasks.toggle(id)
  tasks.toggle(id)
  expect(history.observations).toHaveLength(1)
  tasks.remove(id)
  expect(boot().history.observations).toEqual(history.observations)
})
it('restores paused totals reliably without counting closed time', () => {
  const { timer } = setup()
  timer.start()
  elapsed(timer, 2)
  timer.pause()
  vi.advanceTimersByTime(3600000)
  const restored = boot()
  restored.timer.start()
  elapsed(restored.timer, 1)
  restored.timer.complete()
  expect(restored.history.observations[0]).toMatchObject({ actualMs: 180000, reliable: true })
})
it('recovers running countdowns but excludes unattended recovery from learning', () => {
  const { timer } = setup()
  timer.start()
  elapsed(timer, 2)
  vi.advanceTimersByTime(3600000)
  const restored = boot()
  expect(restored.timer.state).toBe('expired')
  restored.timer.complete()
  expect(restored.history.observations[0]).toMatchObject({ actualMs: 62 * 60000, reliable: false })
  expect(boot().history.observations).toHaveLength(1)
})
it('marks long live gaps and backward clock changes uncertain', () => {
  const { timer, history } = setup()
  timer.start()
  vi.advanceTimersByTime(600000)
  timer.sync()
  timer.complete()
  expect(history.observations[0]!.reliable).toBe(false)
  const next = setup()
  next.timer.start()
  vi.setSystemTime(Date.now() - 1000)
  next.timer.pause()
  expect(next.history.sessions[0]!.actualMs).toBe(0)
  expect(next.history.sessions[0]!.reliable).toBe(false)
})
it('migrates v1 countdowns without inventing prior work or losing memory', () => {
  const { timer } = setup()
  timer.start()
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
  raw.version = 1
  delete raw.focus
  localStorage.setItem(STORAGE_KEY, JSON.stringify(raw))
  const restored = boot()
  expect(restored.timer.remaining).toBe(30 * 60000)
  elapsed(restored.timer, 1)
  restored.timer.complete()
  expect(restored.history.observations[0]).toMatchObject({ actualMs: 60000, reliable: false })
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).version).toBe(2)
})
it('recovers valid history entries and preserves corrupted storage without resetting tasks', () => {
  setup()
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
  raw.focus.observations = [
    null,
    observation(40),
    observation(40),
    { ...observation(30, 1), actualMs: -1 },
  ]
  const text = JSON.stringify(raw)
  localStorage.setItem(STORAGE_KEY, text)
  const restored = boot()
  expect(restored.tasks.tasks).toHaveLength(1)
  expect(restored.history.observations).toHaveLength(1)
  restored.timer.start()
  expect(localStorage.getItem(STORAGE_KEY)).toBe(text)
  expect(persistenceNotice.value).toContain('preserved')
})
it.each([
  null,
  {},
  { ...observation(1), completedAt: -1 },
  { ...observation(1), reliable: 'yes' },
  { ...observation(1), since: 0 },
])('rejects invalid observation %j', (value) => {
  expect(validObservation(value)).toBe(false)
})
it('uses preferences with fewer than three reliable observations', () => {
  expect(estimateDuration('Programming', 32, [observation(120), observation(100, 1)])).toEqual({
    minutes: 32,
    count: 2,
    learned: false,
  })
  expect(estimateDuration('Other', 17, [observation(40)])).toMatchObject({
    minutes: 17,
    learned: false,
  })
})
it('blends the median conservatively and resists one extreme sample', () => {
  expect(estimateDuration(' PROGRAMMING ', 30, [40, 45, 50].map(observation))).toMatchObject({
    minutes: 40,
    learned: true,
    count: 3,
  })
  expect(estimateDuration('Programming', 30, [40, 45, 45, 50, 400].map(observation)).minutes).toBe(
    40,
  )
})
it('prefers recent samples, excludes unreliable/tiny/implausible durations and respects bounds', () => {
  const recent = Array.from({ length: 9 }, (_, i) => observation(50, i))
  expect(estimateDuration('Programming', 30, [...recent, observation(1000, 10)]).minutes).toBe(45)
  expect(
    estimateDuration('Programming', 30, [
      observation(0),
      observation(1500, 1),
      { ...observation(40, 2), reliable: false },
    ]).learned,
  ).toBe(false)
  expect(estimateDuration('Programming', 1440, [1440, 1440, 1440].map(observation)).minutes).toBe(
    1440,
  )
  expect(estimateDuration('Programming', 1, [1, 1, 1].map(observation)).minutes).toBe(1)
})
it('excludes implausibly long work even when updates are regular', () => {
  const { timer, history } = setup()
  timer.start()
  elapsed(timer, 481)
  timer.complete()
  expect(history.observations[0]).toMatchObject({ actualMs: 481 * 60000, reliable: false })
})
it('repeated recovery never adds the same interval twice, and noop actions avoid writes', () => {
  const { timer } = setup()
  timer.start()
  elapsed(timer, 2)
  const first = boot()
  const second = boot()
  expect(first.history.sessions[0]!.actualMs).toBe(120000)
  expect(second.history.sessions[0]!.actualMs).toBe(120000)
  second.timer.pause()
  const count = vi.mocked(localStorage.setItem).mock.calls.length
  second.timer.pause()
  expect(vi.mocked(localStorage.setItem).mock.calls.length).toBe(count)
  second.timer.complete()
  expect(boot().history.observations[0]!.actualMs).toBe(120000)
})
it('keeps saved focus totals across reload and switching back to a task', () => {
  const { timer, tasks } = setup()
  const first = timer.selectedId!
  timer.start()
  elapsed(timer, 2)
  tasks.save({ title: 'Other', duration: 10, category: 'Work' })
  timer.select(tasks.tasks[1]!.id)
  const restored = boot()
  restored.timer.select(first)
  restored.timer.start()
  elapsed(restored.timer, 1)
  restored.timer.complete()
  expect(restored.history.observations[0]).toMatchObject({ actualMs: 180000, reliable: true })
})
it('keeps the existing timer control usable for overtime pause/resume', async () => {
  const { pinia, timer } = setup(1)
  const wrapper = mount(FocusTimer, { global: { plugins: [pinia] } })
  try {
    await wrapper.get('[aria-label="Start or resume timer"]').trigger('click')
    elapsed(timer, 2)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Focus time is still being recorded')
    await wrapper.get('[aria-label="Pause timer"]').trigger('click')
    expect(timer.isFocusing).toBe(false)
    await wrapper.get('[aria-label="Start or resume timer"]').trigger('click')
    expect(timer.isFocusing).toBe(true)
  } finally {
    wrapper.unmount()
  }
})
it('offers learned estimates explicitly, preserves memory metadata and manual edits', async () => {
  const { pinia, history } = setup()
  history.observations = [40, 45, 50].map(observation)
  const wrapper = mount(TaskForm, { global: { plugins: [pinia] } })
  try {
    await wrapper.get('#task-title').setValue('Prog')
    await wrapper.get('[role="option"]').trigger('click')
    expect((wrapper.get('#task-duration').element as HTMLInputElement).value).toBe('30')
    expect(wrapper.text()).toContain('Suggested: 40 min')
    expect(wrapper.get('#task-category').text()).toContain('Study')
    await wrapper.get('.estimate-help button').trigger('click')
    expect((wrapper.get('#task-duration').element as HTMLInputElement).value).toBe('40')
    await wrapper.get('#task-duration').setValue('17')
    await wrapper.get('#task-title').setValue('Prog')
    await wrapper.get('[role="option"]').trigger('click')
    expect((wrapper.get('#task-duration').element as HTMLInputElement).value).toBe('17')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
      duration: 17,
      category: 'Study',
      priority: 'High',
    })
  } finally {
    wrapper.unmount()
  }
})
