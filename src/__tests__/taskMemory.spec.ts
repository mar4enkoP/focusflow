import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { createOwnedPinia as createPinia } from './workspaceTestUtils'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { useTaskMemoryStore, normalizeTitle } from '../stores/taskMemory'
import { useTasksStore, type TaskInput } from '../stores/tasks'
import { useTimerStore } from '../stores/timer'
import { installPersistence, MEMORY_STORAGE_KEY, STORAGE_KEY, memoryNotice } from '../persistence'
import TaskForm from '../components/TaskForm.vue'
import App from '../App.vue'

const input: TaskInput = { title: 'Programming', duration: 60, category: 'Study', priority: 'High' }
const wrappers: ReturnType<typeof mount>[] = []
let storage: Map<string, string>
function boot() {
  const pinia = createPinia()
  setActivePinia(pinia)
  installPersistence(pinia)
  return {
    pinia,
    tasks: useTasksStore(pinia),
    memory: useTaskMemoryStore(pinia),
    timer: useTimerStore(pinia),
  }
}
beforeEach(() => {
  storage = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: vi.fn<(key: string, value: string) => void>((key, value) => {
      storage.set(key, value)
    }),
  })
  vi.spyOn(Date, 'now').mockReturnValue(1000000)
})
afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount())
  wrappers.length = 0
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('learns only successful saves, deduplicates normalized titles, and retains latest explicit values', () => {
  const { tasks, memory } = boot()
  expect(normalizeTitle('  Programming   Practice  ')).toBe('programming practice')
  expect(tasks.save({ ...input, duration: 0 })).toBe(false)
  expect(tasks.save(input, 'missing')).toBe(false)
  expect(memory.entries).toEqual([])
  tasks.save(input)
  const id = tasks.tasks[0]!.id
  expect(memory.entries[0]).toMatchObject({ ...input, lastUsed: 1000000, uses: 1 })
  vi.mocked(Date.now).mockReturnValue(2000000)
  tasks.save({ title: '  PROGRAMMING ', duration: 45, category: 'Work', priority: 'Low' }, id)
  expect(memory.entries).toHaveLength(1)
  expect(memory.entries[0]).toMatchObject({
    title: 'PROGRAMMING',
    duration: 45,
    category: 'Work',
    priority: 'Low',
    uses: 2,
    lastUsed: 2000000,
  })
  tasks.toggle(id)
  tasks.remove(id)
  expect(memory.entries).toHaveLength(1)
  expect(boot().memory.entries).toEqual(memory.entries)
})

it('matches substrings case-insensitively and ranks exact, prefix, frequency, recency, then title', () => {
  const { memory } = boot()
  memory.remember({ ...input, title: 'Daily Programming' }, 900)
  memory.remember({ ...input, title: 'Daily Programming' }, 900)
  memory.remember({ ...input, title: 'Programming practice' }, 400)
  memory.remember({ ...input, title: 'Programming practice' }, 400)
  memory.remember({ ...input, title: 'Programming reading' }, 700)
  memory.remember(input, 100)
  expect(memory.matches(' PROGRAMMING ').map((e) => e.title)).toEqual([
    'Programming',
    'Programming practice',
    'Programming reading',
    'Daily Programming',
  ])
  expect(memory.matches('gram').map((e) => e.title)).toEqual([
    'Daily Programming',
    'Programming practice',
    'Programming reading',
    'Programming',
  ])
  memory.remember({ ...input, title: 'Programming alpha' }, 700)
  expect(memory.matches('Prog').map((e) => e.title)).toEqual([
    'Programming practice',
    'Programming alpha',
    'Programming reading',
    'Programming',
    'Daily Programming',
  ])
  expect(memory.matches('Prgramming')).toEqual([])
})

it('migrates existing tasks once without altering task/session snapshots or resurrecting forgotten entries', () => {
  const { tasks, timer } = boot()
  tasks.save(input)
  tasks.save({ ...input, title: 'Reading' })
  timer.select(tasks.tasks[0]!.id)
  timer.start()
  storage.delete(MEMORY_STORAGE_KEY) // A pre-M5 installation has no memory key.
  const original = storage.get(STORAGE_KEY)
  const restored = boot()
  expect(restored.memory.entries).toHaveLength(2)
  expect(restored.memory.entries.every((e) => e.lastUsed === 0)).toBe(true)
  expect(storage.get(STORAGE_KEY)).toBe(original)
  expect(restored.timer.snapshot()).toEqual(timer.snapshot())
  restored.tasks.remove(restored.tasks.tasks[0]!.id)
  expect(boot().memory.entries).toHaveLength(2)
  restored.memory.entries.forEach((entry) => restored.memory.forget(entry.title))
  expect(boot().memory.entries).toEqual([])
  expect(restored.tasks.tasks).toHaveLength(1)
})

it.each(['{', '{"version":99,"entries":[]}', '{"version":1,"entries":null}'])(
  'preserves unreadable memory %s while restoring tasks',
  (raw) => {
    const { tasks } = boot()
    tasks.save(input)
    storage.set(MEMORY_STORAGE_KEY, raw)
    const restored = boot()
    expect(restored.tasks.tasks).toEqual(tasks.tasks)
    expect(restored.memory.entries).toEqual([])
    restored.tasks.save({ ...input, title: 'New task' })
    expect(storage.get(MEMORY_STORAGE_KEY)).toBe(raw)
    expect(memoryNotice.value).toContain('preserved')
  },
)

it('recovers valid entries from partially corrupted memory without overwriting its raw data', () => {
  const { memory } = boot()
  memory.remember(input)
  const valid = memory.entries[0]!
  const raw = JSON.stringify({
    version: 1,
    entries: [
      null,
      {},
      { ...valid, duration: -1 },
      { ...valid, uses: '2' },
      valid,
      { ...valid, title: ' programming ', duration: 30, lastUsed: 2000000 },
    ],
  })
  storage.set(MEMORY_STORAGE_KEY, raw)
  const restored = boot()
  expect(restored.memory.entries).toHaveLength(1)
  expect(restored.memory.entries[0]!.duration).toBe(30)
  restored.memory.forget('Programming')
  expect(storage.get(MEMORY_STORAGE_KEY)).toBe(raw)
})

it('writes memory once per save and not for typing, matching, completion, reordering, or timer ticks', async () => {
  const { tasks, memory, timer, pinia } = boot()
  const setItem = vi.mocked(localStorage.setItem)
  tasks.save(input)
  expect(setItem.mock.calls.filter(([key]) => key === MEMORY_STORAGE_KEY)).toHaveLength(1)
  tasks.save({ ...input, title: 'Other' })
  setItem.mockClear()
  const wrapper = mount(TaskForm, { global: { plugins: [pinia] } })
  wrappers.push(wrapper)
  await wrapper.get('#task-title').setValue('Prog')
  memory.matches('prog')
  memory.forget('missing')
  tasks.move(tasks.tasks[0]!.id, 1)
  timer.select(tasks.tasks[0]!.id)
  timer.start()
  timer.sync()
  tasks.toggle(tasks.tasks[1]!.id)
  expect(setItem.mock.calls.filter(([key]) => key === MEMORY_STORAGE_KEY)).toHaveLength(0)
})

it('keeps memory usable if storage writes fail', () => {
  const { tasks, memory } = boot()
  vi.mocked(localStorage.setItem).mockImplementation(() => {
    throw new Error('Quota')
  })
  tasks.save(input)
  expect(memory.matches('Prog')).toHaveLength(1)
  expect(memoryNotice.value).toContain('Could not save')
})

it('only applies a suggestion explicitly, allows overrides, and never creates a task on selection', async () => {
  const { pinia, tasks, memory } = boot()
  tasks.save(input)
  const wrapper = mount(TaskForm, { global: { plugins: [pinia] }, attachTo: document.body })
  wrappers.push(wrapper)
  await wrapper.get('#task-duration').setValue('17')
  await wrapper.get('input[value="Low"]').setValue(true)
  await wrapper.get('#task-title').setValue('Prog')
  expect((wrapper.get('#task-duration').element as HTMLInputElement).value).toBe('17')
  expect((wrapper.get('input[value="Low"]').element as HTMLInputElement).checked).toBe(true)
  expect(wrapper.find('.ghost-title').exists()).toBe(true)
  await wrapper.get('#task-title').trigger('keydown', { key: 'Tab' })
  expect(wrapper.emitted('save')).toBeUndefined()
  expect(tasks.tasks).toHaveLength(1)
  expect(memory.entries[0]!.uses).toBe(1)
  expect((wrapper.get('#task-title').element as HTMLInputElement).value).toBe('Programming')
  expect((wrapper.get('#task-duration').element as HTMLInputElement).value).toBe('17')
  expect(wrapper.get('#task-category').text()).toContain('Study')
  expect((wrapper.get('input[value="High"]').element as HTMLInputElement).checked).toBe(true)
  expect(wrapper.find('[aria-label="Remembered task suggestions"]').exists()).toBe(false)
  await wrapper.get('#task-duration').setValue('35')
  await wrapper.get('form').trigger('submit')
  expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({ ...input, duration: 35 })
})

it('keeps inline completion quiet during composition, caret editing and welcome expansion', async () => {
  const { pinia, tasks } = boot()
  tasks.save(input)
  const wrapper = mount(TaskForm, {
    props: { welcome: true },
    global: { plugins: [pinia] },
    attachTo: document.body,
  })
  wrappers.push(wrapper)
  const field = wrapper.get<HTMLInputElement>('#task-title')
  await field.setValue('Prog')
  expect(wrapper.find('.ghost-title').exists()).toBe(true)
  await field.trigger('compositionstart')
  expect(wrapper.find('.ghost-title').exists()).toBe(false)
  await field.trigger('keydown', { key: 'Tab', isComposing: true })
  expect(field.element.value).toBe('Prog')
  await field.trigger('compositionend')
  field.element.setSelectionRange(1, 1)
  await field.trigger('select')
  expect(wrapper.find('.ghost-title').exists()).toBe(false)
  field.element.setSelectionRange(4, 4)
  await field.trigger('select')
  await field.trigger('keydown', { key: 'Tab', shiftKey: true })
  expect(field.element.value).toBe('Prog')
  await field.setValue('Pro')
  await field.trigger('keydown', { key: 'Enter' })
  expect(wrapper.find('.ghost-title').exists()).toBe(false)
  expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
  expect(wrapper.get('form').classes()).not.toContain('is-compact')
})

it('keeps all remembered tasks available through the explicit memory button', async () => {
  const { pinia, tasks } = boot()
  for (let index = 0; index < 10; index++) {
    tasks.save({ ...input, title: `Programming ${index}` })
  }
  const wrapper = mount(TaskForm, { global: { plugins: [pinia] }, attachTo: document.body })
  wrappers.push(wrapper)
  const field = wrapper.get('#task-title')
  await field.setValue('Programming')
  await wrapper.get('.memory-toggle').trigger('click')
  const options = wrapper.findAll('.memory-choice')
  expect(options).toHaveLength(10)
  const chosenTitle = options[5]!.text()
  await options[5]!.trigger('click')
  expect((field.element as HTMLInputElement).value).toBe(chosenTitle)
  expect(wrapper.emitted('save')).toBeUndefined()
})

it('supports mouse selection, Escape dismissal, manual new tasks and forgetting through the UI', async () => {
  const { pinia, tasks, memory } = boot()
  tasks.save(input)
  const wrapper = mount(TaskForm, { global: { plugins: [pinia] }, attachTo: document.body })
  wrappers.push(wrapper)
  await wrapper.get('#task-title').setValue('prog')
  await wrapper.get('#task-title').trigger('keydown', { key: 'Escape' })
  expect(wrapper.emitted('cancel')).toBeUndefined()
  expect(wrapper.find('[aria-label="Remembered task suggestions"]').exists()).toBe(false)
  await wrapper.get('#task-title').setValue('pro')
  await wrapper.get('.memory-toggle').trigger('click')
  await wrapper.get('.memory-choice').trigger('click')
  expect((wrapper.get('#task-duration').element as HTMLInputElement).value).toBe('60')
  await wrapper.get('.memory-toggle').trigger('click')
  await wrapper.get('[aria-label="Forget Programming"]').trigger('click')
  await nextTick()
  expect(memory.entries).toEqual([])
  expect(tasks.tasks).toHaveLength(1)
  expect(boot().memory.entries).toEqual([])
  expect(wrapper.text()).toContain('No remembered tasks.')
  await wrapper.get('#task-title').setValue('Brand new')
  await wrapper.get('form').trigger('submit')
  expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({ title: 'Brand new', duration: 60 })
})

it('creates a recurring task through the app and learns overridden values only after saving', async () => {
  const { pinia, tasks, memory } = boot()
  tasks.save(input)
  const wrapper = mount(App, { global: { plugins: [pinia] }, attachTo: document.body })
  wrappers.push(wrapper)
  await wrapper.get('[aria-label="Add a task"]').trigger('click')
  await wrapper.get('#task-title').setValue('prog')
  await wrapper.get('#task-title').trigger('keydown', { key: 'Tab' })
  await wrapper.get('#task-duration').setValue('40')
  await wrapper.get('input[value="Low"]').setValue(true)
  expect(memory.entries[0]!.duration).toBe(60)
  await wrapper.get('form').trigger('submit')
  expect(tasks.tasks).toHaveLength(2)
  expect(tasks.tasks[0]!.duration).toBe(60)
  expect(tasks.tasks[1]).toMatchObject({
    title: 'Programming',
    duration: 40,
    category: 'Study',
    priority: 'Low',
  })
  expect(memory.entries).toHaveLength(1)
  expect(memory.entries[0]).toMatchObject({ duration: 40, priority: 'Low', uses: 2 })
  expect(boot().memory.entries).toEqual(memory.entries)
})

it('does not replace edited task values on mount or as its title matches memory', async () => {
  const { pinia, tasks } = boot()
  tasks.save(input)
  const wrapper = mount(TaskForm, {
    props: { task: { ...tasks.tasks[0]!, duration: 15, category: 'Health', priority: 'Low' } },
    global: { plugins: [pinia] },
  })
  wrappers.push(wrapper)
  await wrapper.get('#task-title').setValue('Programming practice')
  await wrapper.get('#task-title').setValue('Programming')
  await wrapper.get('form').trigger('submit')
  expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
    duration: 15,
    category: 'Health',
    priority: 'Low',
  })
})
