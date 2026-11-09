import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { createOwnedPinia as createPinia } from './workspaceTestUtils'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useTasksStore, type TaskInput } from '../stores/tasks'
import { useTimerStore } from '../stores/timer'
import { installPersistence, STORAGE_KEY } from '../persistence'
import TaskList from '../components/TaskList.vue'
import TaskForm from '../components/TaskForm.vue'

const wrappers: ReturnType<typeof mount>[] = []
function boot() {
  const pinia = createPinia()
  setActivePinia(pinia)
  installPersistence(pinia)
  return { pinia, tasks: useTasksStore(pinia), timer: useTimerStore(pinia) }
}
function seed(tasks: ReturnType<typeof useTasksStore>) {
  for (const title of ['A', 'B', 'C', 'D']) tasks.save({ title, duration: 25, category: 'Work' })
  return tasks.tasks.map((task) => task.id)
}
beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  })
  vi.useFakeTimers()
  vi.setSystemTime(1000000)
})
afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount())
  wrappers.length = 0
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('inserts before/after in both directions without losing data, and ignores invalid drops', () => {
  const { tasks } = boot()
  const [a, b, c, d] = seed(tasks) as [string, string, string, string]
  tasks.toggle(c)
  const original = [...tasks.tasks]
  tasks.reorder(a, d, 'after')
  expect(tasks.tasks.map((t) => t.id)).toEqual([b, c, d, a])
  tasks.reorder(a, b, 'before')
  expect(tasks.tasks).toEqual(original)
  tasks.reorder(d, b, 'after')
  expect(tasks.tasks.map((t) => t.id)).toEqual([a, b, d, c])
  tasks.reorder(a, c, 'before')
  expect(tasks.tasks.map((t) => t.id)).toEqual([b, d, a, c])
  expect(tasks.reorder(a, a, 'after')).toBe(false)
  expect(tasks.reorder('missing', c, 'before')).toBe(false)
  expect(tasks.reorder(a, 'missing', 'before')).toBe(false)
  for (const task of original) expect(tasks.tasks.find((t) => t.id === task.id)).toBe(task)
  expect(tasks.tasks.find((t) => t.id === c)?.completed).toBe(true)
  expect(boot().tasks.tasks).toEqual(tasks.tasks)
})

it.each(['running', 'paused'] as const)(
  'keeps a %s timer and saved sessions stable through reorder and reload',
  (state) => {
    const { tasks, timer } = boot()
    const [a, b, c, d] = seed(tasks) as [string, string, string, string]
    timer.select(b)
    timer.start()
    vi.advanceTimersByTime(10000)
    timer.select(a)
    timer.start()
    vi.advanceTimersByTime(5000)
    timer.sync()
    if (state === 'paused') timer.pause()
    tasks.toggle(c)
    const session = timer.snapshot()
    tasks.move(a, 1)
    tasks.reorder(a, d, 'after')
    tasks.save({ ...tasks.tasks.find((t) => t.id === a)!, priority: 'High' }, a)
    expect(timer.snapshot()).toEqual(session)
    const restored = boot()
    expect(restored.tasks.tasks).toEqual(tasks.tasks)
    expect(restored.timer.snapshot()).toEqual(session)
    vi.advanceTimersByTime(10000)
    restored.timer.sync()
    expect(restored.timer.remaining).toBe(session.remaining - (state === 'running' ? 10000 : 0))
    restored.timer.complete()
    expect(restored.timer.selectedId).toBe(b)
    expect(restored.timer.remaining).toBe(1490000)
    expect(restored.tasks.tasks.find((t) => t.id === c)?.completed).toBe(true)
  },
)

it('migrates legacy tasks to Medium without changing order, completion or session recovery', () => {
  const { tasks, timer } = boot()
  seed(tasks)
  tasks.toggle(tasks.tasks[2]!.id)
  timer.select(tasks.tasks[0]!.id)
  timer.start()
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
  for (const task of raw.tasks) delete task.priority
  localStorage.setItem(STORAGE_KEY, JSON.stringify(raw))
  const restored = boot()
  expect(restored.tasks.tasks).toEqual(tasks.tasks)
  expect(restored.timer.snapshot()).toEqual(timer.snapshot())
  restored.tasks.move(restored.tasks.tasks[0]!.id, 1)
  expect(boot().tasks.tasks).toEqual(restored.tasks.tasks)
})

it('persists priorities independently of manual order and rejects invalid priority', () => {
  const { tasks } = boot()
  seed(tasks)
  const order = tasks.tasks.map((t) => t.id)
  for (const [index, priority] of ['Low', 'High', 'Medium'].entries()) {
    const task = tasks.tasks[index]!
    tasks.save({ ...task, priority } as TaskInput, task.id)
  }
  expect(tasks.tasks.map((t) => t.id)).toEqual(order)
  expect(boot().tasks.tasks).toEqual(tasks.tasks)
  expect(
    tasks.save({ ...tasks.tasks[0]!, priority: 'Urgent' } as unknown as TaskInput, order[0]),
  ).toBe(false)
  expect(tasks.tasks[0]!.priority).toBe('Low')
})

it('offers priority on creation and editing without changing other form values', async () => {
  const wrapper = mount(TaskForm)
  wrappers.push(wrapper)
  expect((wrapper.get('input[value="Medium"]').element as HTMLInputElement).checked).toBe(true)
  await wrapper.get('#task-title').setValue('Write')
  await wrapper.get('input[value="High"]').setValue(true)
  await wrapper.get('form').trigger('submit')
  expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({ title: 'Write', priority: 'High' })
  const edit = mount(TaskForm, {
    props: {
      task: {
        id: 'a',
        title: 'Write',
        duration: 25,
        category: 'Work',
        completed: true,
        priority: 'High',
      },
    },
  })
  wrappers.push(edit)
  expect((edit.get('input[value="High"]').element as HTMLInputElement).checked).toBe(true)
  await edit.get('input[value="Low"]').setValue(true)
  await edit.get('form').trigger('submit')
  expect(edit.emitted('save')?.[0]?.[0]).toMatchObject({
    title: 'Write',
    duration: 25,
    priority: 'Low',
  })
})

it('shows precise drop feedback, cancels safely and retains keyboard focus with position announcements', async () => {
  const { pinia, tasks } = boot()
  seed(tasks)
  const wrapper = mount(TaskList, { global: { plugins: [pinia] }, attachTo: document.body })
  wrappers.push(wrapper)
  const rows = wrapper.findAll('li')
  vi.spyOn(rows[2]!.element, 'getBoundingClientRect').mockReturnValue({
    top: 100,
    height: 60,
  } as DOMRect)
  await rows[0]!.get('.drag-handle').trigger('dragstart')
  await rows[2]!.trigger('dragover', { clientY: 110 })
  expect(rows[2]!.classes()).toContain('drop-before')
  await rows[2]!.trigger('dragover', { clientY: 150 })
  expect(rows[2]!.classes()).toContain('drop-after')
  await rows[2]!.trigger('drop', { clientY: 150 })
  expect(tasks.tasks.map((t) => t.title)).toEqual(['B', 'C', 'A', 'D'])
  expect(wrapper.find('.dragging').exists()).toBe(false)
  await wrapper.get('.drag-handle').trigger('dragstart')
  await wrapper.get('ol').trigger('keydown', { key: 'Escape' })
  await rows[2]!.trigger('drop', { clientY: 150 })
  expect(tasks.tasks.map((t) => t.title)).toEqual(['B', 'C', 'A', 'D'])
  const handle = wrapper.get('[aria-label="Reorder A; use arrow keys"]')
  await handle.trigger('keydown', { key: 'ArrowUp' })
  await nextTick()
  expect(tasks.tasks.map((t) => t.title)).toEqual(['B', 'A', 'C', 'D'])
  expect(document.activeElement).toBe(handle.element)
  expect(wrapper.get('[role="status"]').text()).toBe('A, position 2 of 4.')
})
