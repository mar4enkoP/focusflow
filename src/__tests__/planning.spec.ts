import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { generateSchedule, type PlanSettings } from '../planning'
import { useTasksStore, type Task } from '../stores/tasks'
import { useTimerStore } from '../stores/timer'
import { usePlannerStore } from '../stores/planner'
import { useFocusHistoryStore } from '../stores/focusHistory'
import { installPersistence, PLAN_STORAGE_KEY, planNotice, STORAGE_KEY } from '../persistence'
import type { Observation } from '../estimation'
import WorkspaceTools from '../components/WorkspaceTools.vue'
import SessionPlanner from '../components/SessionPlanner.vue'
import App from '../App.vue'

const task = (id: string, duration = 10, priority: Task['priority'] = 'Medium'): Task => ({
  id,
  title: id,
  duration,
  priority,
  category: 'Work',
  completed: false,
})
const config = (ids: string[], minutes = 60): PlanSettings => ({
  selectedIds: ids,
  minutes,
  breakMinutes: 5,
  breakEvery: 2,
})
function boot() {
  const pinia = createPinia()
  setActivePinia(pinia)
  installPersistence(pinia)
  return {
    pinia,
    tasks: useTasksStore(pinia),
    timer: useTimerStore(pinia),
    planner: usePlannerStore(pinia),
    history: useFocusHistoryStore(pinia),
  }
}
function setup() {
  const state = boot()
  for (const name of ['A', 'B', 'C'])
    state.tasks.save({ title: name, duration: 10, category: 'Work' })
  state.planner.settings = config(
    state.tasks.tasks.map((t) => t.id),
    40,
  )
  return state
}
function work(timer: ReturnType<typeof useTimerStore>, minutes: number) {
  for (let i = 0; i < minutes; i++) {
    vi.advanceTimersByTime(60000)
    timer.sync()
  }
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 8, 10))
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: vi.fn<(key: string, value: string) => void>((key, value) => {
      data.set(key, value)
    }),
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('prioritizes tasks and uses manual order for ties without mutating the task list', () => {
  const tasks = [task('low', 10, 'Low'), task('high-2', 10, 'High'), task('high-1', 10, 'High')]
  const before = JSON.stringify(tasks)
  const schedule = generateSchedule(tasks, config(tasks.map((t) => t.id)), [])
  expect(schedule.slots.filter((s) => s.taskId).map((s) => s.taskId)).toEqual([
    'high-2',
    'high-1',
    'low',
  ])
  expect(JSON.stringify(tasks)).toBe(before)
})
it('packs smaller tasks after an oversized task and never discards omitted tasks', () => {
  const schedule = generateSchedule(
    [task('large', 100, 'High'), task('small', 15)],
    config(['large', 'small'], 20),
    [],
  )
  expect(schedule.total).toBe(15)
  expect(schedule.free).toBe(5)
  expect(schedule.omitted.map((o) => o.taskId)).toEqual(['large'])
})
it('accounts for breaks only between scheduled tasks', () => {
  const settings = { ...config(['a', 'b', 'c'], 34), breakEvery: 1 }
  const schedule = generateSchedule(
    ['a', 'b', 'c'].map((id) => task(id)),
    settings,
    [],
  )
  expect(schedule.slots.map((s) => s.kind)).toEqual(['task', 'break', 'task'])
  expect(schedule.total).toBe(25)
  expect(schedule.breaks).toBe(5)
  expect(schedule.free).toBe(9)
  expect(schedule.omitted[0]!.taskId).toBe('c')
  for (let i = 1; i < schedule.slots.length; i++)
    expect(schedule.slots[i]!.start).toBe(schedule.slots[i - 1]!.end)
})
it('supports zero breaks, exact fits, empty lists and missing selections', () => {
  expect(generateSchedule([task('a')], { ...config(['a'], 10), breakMinutes: 0 }, []).free).toBe(0)
  expect(generateSchedule([], config([], 10), [])).toEqual({
    slots: [],
    omitted: [],
    total: 0,
    breaks: 0,
    free: 10,
  })
  expect(generateSchedule([], config(['deleted']), []).omitted[0]!.reason).toContain('deleted')
})
it.each([0, -1, 1441, NaN, 3.5])('rejects invalid time budgets %s', (minutes) => {
  expect(() => generateSchedule([], config([], minutes), [])).toThrow('Invalid planning settings')
})
it('uses M6 estimates with enough history and otherwise the configured task duration', () => {
  const observations: Observation[] = [40, 45, 50].map((minutes, i) => ({
    sessionId: `${i}`,
    taskId: `old${i}`,
    title: 'a',
    plannedMinutes: 30,
    actualMs: minutes * 60000,
    reliable: true,
    completedAt: Date.now() - i,
  }))
  const learned = generateSchedule([task('a', 30)], config(['a']), observations)
  expect(learned.slots[0]).toMatchObject({ end: 40, learned: true })
  expect(
    generateSchedule([task('a', 17)], config(['a']), observations.slice(0, 2)).slots[0],
  ).toMatchObject({ end: 17, learned: false })
})
it('does not allocate other tasks if active work cannot fit', () => {
  const result = generateSchedule([task('a'), task('b', 1)], config(['a', 'b']), [], 3, {
    id: 'a',
    remaining: 5,
  })
  expect(result.slots).toEqual([])
  expect(result.omitted).toHaveLength(2)
})
it('requires acceptance and never starts or resets a timer when generating a plan', () => {
  const { planner, timer } = setup()
  const before = timer.snapshot()
  planner.generate()
  expect(planner.accepted).toBeUndefined()
  planner.reject()
  expect(planner.proposal).toBeUndefined()
  planner.generate()
  expect(planner.accept()).toBe(true)
  expect(timer.snapshot()).toEqual(before)
  expect(planner.accepted!.startedAt).toBeUndefined()
})
it('persists preferences and accepted plans but never proposals', () => {
  const { planner } = setup()
  planner.generate()
  expect(boot().planner.proposal).toBeUndefined()
  planner.accept()
  const restored = boot().planner
  expect(restored.settings).toEqual(planner.settings)
  expect(restored.accepted).toEqual(planner.accepted)
})
it('detects an overrun and recalculates only on confirmation without touching active timing', () => {
  const { planner, timer, tasks } = setup()
  planner.generate()
  planner.accept()
  const id = tasks.tasks[0]!.id
  planner.begin(id)
  timer.select(id)
  timer.start()
  work(timer, 12)
  expect(planner.overrun).toBe(true)
  const original = JSON.stringify(planner.accepted),
    timing = timer.snapshot()
  planner.generate(true)
  expect(JSON.stringify(planner.accepted)).toBe(original)
  expect(planner.proposal!.offset).toBe(12)
  expect(planner.proposal!.schedule.slots[0]).toMatchObject({ taskId: id, start: 0, end: 5 })
  planner.accept()
  expect(timer.snapshot()).toEqual(timing)
  expect(planner.accepted!.schedule.total + planner.accepted!.offset).toBeLessThanOrEqual(40)
})
it('handles early completion and keeps history/completed tasks when replanning', () => {
  const { planner, timer, tasks, history } = setup()
  planner.generate()
  planner.accept()
  timer.select(tasks.tasks[0]!.id)
  timer.start()
  work(timer, 2)
  timer.complete()
  expect(planner.accepted!.completedIds).toEqual([tasks.tasks[0]!.id])
  const observations = JSON.stringify(history.observations)
  planner.generate(true)
  planner.accept()
  expect(planner.accepted!.completedIds).toHaveLength(1)
  expect(planner.accepted!.offset).toBe(2)
  expect(planner.accepted!.schedule.slots.some((s) => s.taskId === tasks.tasks[0]!.id)).toBe(false)
  expect(JSON.stringify(history.observations)).toBe(observations)
})
it('uses accepted task navigation without changing manual order or auto-starting the next task', () => {
  const { planner, timer, tasks } = setup()
  tasks.tasks[1]!.priority = 'High'
  const ids = tasks.tasks.map((t) => t.id)
  planner.generate()
  planner.accept()
  timer.select(ids[1]!)
  timer.start()
  work(timer, 1)
  timer.complete()
  expect(timer.selectedId).toBe(ids[0])
  expect(timer.state).toBe('ready')
  expect(tasks.tasks.map((t) => t.id)).toEqual(ids)
})
it('refuses stale proposals after deletion or elapsed available time', () => {
  const { planner, tasks } = setup()
  planner.generate()
  tasks.remove(tasks.tasks[0]!.id)
  expect(planner.accept()).toBe(false)
  planner.generate()
  planner.accept()
  planner.begin(planner.nextId!)
  planner.generate(true)
  vi.advanceTimersByTime(40 * 60000)
  expect(planner.accept()).toBe(false)
})
it.each(['{', '{"version":99}', '{"version":1,"settings":{}}'])(
  'isolates corrupt plan data %s from tasks/history',
  (raw) => {
    setup()
    const tasksRaw = localStorage.getItem(STORAGE_KEY)
    localStorage.setItem(PLAN_STORAGE_KEY, raw)
    const restored = boot()
    expect(restored.tasks.tasks).toHaveLength(3)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(tasksRaw)
    restored.planner.settings.minutes = 90
    expect(localStorage.getItem(PLAN_STORAGE_KEY)).toBe(raw)
    expect(planNotice.value).toContain('preserved')
  },
)
it('rejects overlapping persisted slots and keeps raw storage intact', () => {
  const { planner } = setup()
  planner.generate()
  planner.accept()
  const data = JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY)!)
  data.accepted.schedule.slots[1].start = 0
  const raw = JSON.stringify(data)
  localStorage.setItem(PLAN_STORAGE_KEY, raw)
  expect(boot().planner.accepted).toBeUndefined()
  expect(localStorage.getItem(PLAN_STORAGE_KEY)).toBe(raw)
})
it('retains valid preferences and accepted progress while draft inputs are invalid', () => {
  const { planner, tasks } = setup()
  planner.generate()
  planner.accept()
  planner.settings.minutes = 0
  tasks.toggle(tasks.tasks[0]!.id)
  const restored = boot().planner
  expect(restored.settings.minutes).toBe(40)
  expect(restored.accepted!.completedIds).toEqual([tasks.tasks[0]!.id])
})
it('keeps break cadence when recalculating after completed tasks', () => {
  const { planner, tasks } = setup()
  planner.generate()
  planner.accept()
  tasks.toggle(tasks.tasks[0]!.id)
  tasks.toggle(tasks.tasks[1]!.id)
  planner.generate(true)
  expect(planner.proposal!.schedule.slots[0]!.kind).toBe('break')
  expect(planner.proposal!.schedule.breaks).toBe(5)
})
it('requires explicit carry-forward for an unstarted plan from a previous day', () => {
  const { planner } = setup()
  planner.generate()
  planner.accept()
  const id = planner.nextId!
  vi.advanceTimersByTime(24 * 3600000)
  expect(planner.begin(id)).toBe(false)
  expect(planner.error).toContain('another day')
  planner.generate()
  planner.accept()
  expect(planner.begin(id)).toBe(true)
})
it('does not navigate outside the accepted plan when its last task completes', () => {
  const { planner, timer, tasks } = setup()
  planner.settings.selectedIds = [tasks.tasks[0]!.id]
  planner.generate()
  planner.accept()
  timer.select(planner.nextId!)
  timer.start()
  work(timer, 1)
  timer.complete()
  expect(timer.selectedId).toBeUndefined()
  expect(tasks.remaining).toBe(2)
})
it('does not rewrite plans on timer ticks', () => {
  const { planner, timer } = setup()
  planner.generate()
  planner.accept()
  timer.select(planner.nextId!)
  timer.start()
  const writes = vi
    .mocked(localStorage.setItem)
    .mock.calls.filter(([key]) => key === PLAN_STORAGE_KEY).length
  work(timer, 1)
  expect(
    vi.mocked(localStorage.setItem).mock.calls.filter(([key]) => key === PLAN_STORAGE_KEY),
  ).toHaveLength(writes)
})
it('provides review/accept/focus and analytics navigation through compact panels', async () => {
  const { pinia, planner, timer } = setup()
  const wrapper = mount(WorkspaceTools, { global: { plugins: [pinia] }, attachTo: document.body })
  try {
    await wrapper.get('nav button').trigger('click')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Proposed schedule')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Accept plan')!
      .trigger('click')
    expect(planner.accepted).toBeDefined()
    expect(timer.state).toBe('ready')
    await wrapper.get('[aria-label="Focus on planned A"]').trigger('click')
    expect(wrapper.emitted('focus')?.[0]?.[0]).toBe(planner.nextId)
    await wrapper.findAll('nav button')[1]!.trigger('click')
    expect(wrapper.text()).toContain('No completed sessions yet')
    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  } finally {
    wrapper.unmount()
  }
})
it('switches open panels directly, retains the proposal and restores compact plan editing', async () => {
  const { pinia, planner } = setup()
  const wrapper = mount(WorkspaceTools, { global: { plugins: [pinia] }, attachTo: document.body })
  try {
    await wrapper.get('[aria-label="Planner"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').attributes('aria-modal')).toBe('false')
    await wrapper.get('form').trigger('submit')
    const proposal = JSON.stringify(planner.proposal)
    expect(wrapper.find('form').exists()).toBe(false)
    await wrapper.get('[aria-label="Analytics"]').trigger('click')
    expect(wrapper.get('#tool-title').text()).toBe('Analytics')
    expect(wrapper.findAll('[role="dialog"]')).toHaveLength(1)
    await wrapper.get('[aria-label="Planner"]').trigger('click')
    expect(wrapper.get('#tool-title').text()).toBe('Planner')
    expect(JSON.stringify(planner.proposal)).toBe(proposal)
    await wrapper.get('[aria-label="Edit plan settings"]').trigger('click')
    expect(wrapper.find('form').exists()).toBe(true)
    await wrapper.get('[aria-label="Planner"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  } finally {
    wrapper.unmount()
  }
})
it('hides underlying content while tools are open and restores the original screen on close', async () => {
  const { pinia } = setup()
  const wrapper = mount(App, { global: { plugins: [pinia] } })
  try {
    await wrapper.get('[aria-label="Planner"]').trigger('click')
    expect(wrapper.get('main').classes()).toContain('workspace-hidden')
    expect(wrapper.get('main').attributes('inert')).toBeDefined()
    expect(wrapper.get('footer').attributes('aria-hidden')).toBe('true')
    await wrapper.get('[aria-label="Analytics"]').trigger('click')
    expect(wrapper.get('main').classes()).toContain('workspace-hidden')
    expect(wrapper.find('details.method').exists()).toBe(false)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Sessions')!
      .trigger('click')
    expect(wrapper.get('details.method').attributes('open')).toBeUndefined()
    expect(wrapper.get('[aria-label="Open task list"]').text()).toContain('3 tasks to do')
    expect(wrapper.get('[aria-label="Open task list"]').text()).toContain('30 min')
    await wrapper.get('[aria-label="Open task list"]').trigger('click')
    expect(wrapper.get('main').classes()).not.toContain('workspace-hidden')
    expect(wrapper.get('main').attributes('inert')).toBeUndefined()
    expect(wrapper.text()).toContain('Your tasks')
  } finally {
    wrapper.unmount()
  }
})
it('shows omitted tasks and preserves an active timer when selecting another task', async () => {
  const { pinia, planner, timer, tasks } = setup()
  planner.settings.minutes = 10
  planner.generate()
  planner.accept()
  timer.select(tasks.tasks[1]!.id)
  timer.start()
  const wrapper = mount(SessionPlanner, { global: { plugins: [pinia] } })
  try {
    expect(wrapper.text()).toContain('Unscheduled · 2')
    await wrapper.get('[aria-label="Focus on planned A"]').trigger('click')
    expect(wrapper.emitted('focus')).toBeUndefined()
    expect(timer.state).toBe('running')
    expect(wrapper.text()).toContain('Pause the current task')
  } finally {
    wrapper.unmount()
  }
})
