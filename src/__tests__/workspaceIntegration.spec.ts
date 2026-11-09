import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, disposePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { watch } from 'vue'
import { startWorkspace } from '../workspace'
import { useWorkspaceAccessStore } from '../stores/workspaceAccess'
import { useTasksStore } from '../stores/tasks'
import { useTimerStore } from '../stores/timer'
import { useTaskMemoryStore } from '../stores/taskMemory'
import { useFocusHistoryStore } from '../stores/focusHistory'
import { usePlannerStore } from '../stores/planner'
import {
  STORAGE_KEY,
  MEMORY_STORAGE_KEY,
  PLAN_STORAGE_KEY,
  persistenceNotice,
} from '../persistence'
import type { WorkspaceLockManager } from '../workspaceOwnership'
import { lockService } from './workspaceTestUtils'
import App from '../App.vue'
import TaskList from '../components/TaskList.vue'
import FocusTimer from '../components/FocusTimer.vue'
import SessionPlanner from '../components/SessionPlanner.vue'

let data: Map<string, string>
const cleanup: Array<() => void | Promise<void>> = []
const input = { title: 'First', duration: 10, category: 'Work' as const }
beforeEach(() => {
  data = new Map()
  vi.stubGlobal('localStorage', {
    getItem: vi.fn<(key: string) => string | null>((key) => data.get(key) ?? null),
    setItem: vi.fn<(key: string, value: string) => void>((key, value) => {
      data.set(key, value)
    }),
  })
})
afterEach(async () => {
  for (const dispose of cleanup.reverse()) await dispose()
  cleanup.length = 0
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function tab(locks: WorkspaceLockManager | undefined) {
  const pinia = createPinia()
  const lifecycle = new EventTarget()
  const access = useWorkspaceAccessStore(pinia)
  const tasks = useTasksStore(pinia)
  const timer = useTimerStore(pinia)
  const history = useFocusHistoryStore(pinia)
  const memory = useTaskMemoryStore(pinia)
  const planner = usePlannerStore(pinia)
  const stop = startWorkspace(pinia, () => locks, lifecycle)
  cleanup.push(() => disposePinia(pinia), stop)
  return { pinia, lifecycle, access, tasks, timer, history, memory, planner, stop }
}
function workspace(t: ReturnType<typeof tab>) {
  return JSON.stringify({
    tasks: t.tasks.tasks,
    timer: t.timer.snapshot(),
    history: t.history.snapshot(),
    memory: t.memory.entries,
    plan: t.planner.snapshot(),
    proposal: t.planner.proposal,
  })
}
function tryMutations(t: ReturnType<typeof tab>) {
  const id = t.tasks.tasks[0]?.id ?? 'missing'
  t.tasks.save(input)
  t.tasks.remove(id)
  t.tasks.toggle(id)
  t.tasks.move(id, 1)
  t.tasks.reorder(id, 'missing', 'after')
  t.timer.select(id)
  t.timer.start()
  t.timer.pause()
  t.timer.reset()
  t.timer.addTime()
  t.timer.continueFocus()
  t.timer.complete()
  t.timer.sync()
  t.timer.restore({
    state: 'ready',
    remaining: 0,
    budget: 0,
    saved: [],
    selectedId: undefined,
    deadline: undefined,
  })
  t.memory.remember(input)
  t.memory.forget(input.title)
  t.history.begin({ ...input, id, completed: false, priority: 'Medium' })
  t.history.tick(id)
  t.history.pause(id)
  t.history.finish({ ...input, id, completed: false, priority: 'Medium' })
  t.history.discard(id)
  t.history.restore({ sessions: [], observations: [] }, [])
  t.planner.updateSettings({ minutes: 99, breakMinutes: 0, breakEvery: 1, selectedIds: [id] })
  t.planner.generate()
  t.planner.accept()
  t.planner.reject()
  t.planner.begin(id)
  t.planner.restore({ settings: { minutes: 1, breakMinutes: 0, breakEvery: 1, selectedIds: [] } })
}

it('blocks all action paths and storage access until ownership, then reads every key before editing', async () => {
  const locks = lockService()
  const a = tab(locks)
  const b = tab(locks)
  const before = workspace(a)
  tryMutations(a)
  tryMutations(b)
  expect(workspace(a)).toBe(before)
  expect(localStorage.getItem).not.toHaveBeenCalled()
  expect(localStorage.setItem).not.toHaveBeenCalled()
  const readsAtReady: string[][] = []
  cleanup.push(
    watch(
      () => a.access.canEdit,
      (ready) => {
        if (ready) readsAtReady.push(vi.mocked(localStorage.getItem).mock.calls.map(([key]) => key))
      },
      { flush: 'sync' },
    ),
  )
  await flushPromises()
  expect(a.access.canEdit).toBe(true)
  expect(readsAtReady).toEqual([[STORAGE_KEY, MEMORY_STORAGE_KEY, PLAN_STORAGE_KEY]])
  expect(b.access.status).toBe('waiting')
  const secondary = workspace(b)
  tryMutations(b)
  expect(workspace(b)).toBe(secondary)
  expect(localStorage.setItem).not.toHaveBeenCalled()
  a.tasks.save(input)
  expect(data.has(STORAGE_KEY)).toBe(true)
  expect(data.has(MEMORY_STORAGE_KEY)).toBe(true)
})

it('takes over all three fresh keys and preserves running timer recovery without hydration writes', async () => {
  let now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const locks = lockService()
  const a = tab(locks)
  const b = tab(locks)
  await flushPromises()
  a.tasks.save(input)
  const id = a.tasks.tasks[0]!.id
  a.planner.updateSettings({ minutes: 30, breakMinutes: 0, breakEvery: 1, selectedIds: [id] })
  a.planner.generate()
  a.planner.accept()
  a.timer.select(id)
  a.timer.start()
  const persisted = new Map(data)
  vi.mocked(localStorage.setItem).mockClear()
  now += 60_000
  await a.stop()
  await flushPromises()
  expect(b.access.canEdit).toBe(true)
  expect(b.tasks.tasks).toEqual(a.tasks.tasks)
  expect(b.memory.entries).toEqual(a.memory.entries)
  expect(b.planner.accepted).toEqual(a.planner.accepted)
  expect(b.timer.remaining).toBe(9 * 60_000)
  expect(b.timer.state).toBe('running')
  expect(b.history.sessions[0]).toMatchObject({ actualMs: 60_000, reliable: false })
  expect(data).toEqual(persisted)
  expect(localStorage.setItem).not.toHaveBeenCalled()
  b.timer.complete()
  expect(b.history.observations).toHaveLength(1)
  expect(JSON.parse(data.get(STORAGE_KEY)!).tasks[0].completed).toBe(true)
  tryMutations(a)
  expect(a.access.canEdit).toBe(false)
})

it('reacquires after pagehide/pageshow, discarding stale tasks, proposals and missing-key state', async () => {
  const locks = lockService()
  const a = tab(locks)
  const b = tab(locks)
  await flushPromises()
  a.tasks.save(input)
  a.timer.select(a.tasks.tasks[0]!.id)
  a.timer.start()
  a.planner.updateSettings({
    minutes: 30,
    breakMinutes: 0,
    breakEvery: 1,
    selectedIds: [a.tasks.tasks[0]!.id],
  })
  a.planner.generate()
  a.lifecycle.dispatchEvent(new Event('pagehide'))
  expect(a.access.canEdit).toBe(false)
  await flushPromises()
  expect(b.access.canEdit).toBe(true)
  const stale = workspace(a)
  const saved = new Map(data)
  tryMutations(a)
  expect(workspace(a)).toBe(stale)
  expect(data).toEqual(saved)
  b.tasks.remove(b.tasks.tasks[0]!.id)
  b.tasks.save({ ...input, title: 'Latest' })
  // Simulate externally removed optional keys while A has old state in memory.
  data.delete(MEMORY_STORAGE_KEY)
  data.delete(PLAN_STORAGE_KEY)
  a.lifecycle.dispatchEvent(new Event('pageshow'))
  await flushPromises()
  expect(a.access.status).toBe('waiting')
  await b.stop()
  await flushPromises()
  expect(a.access.canEdit).toBe(true)
  expect(a.tasks.tasks.map((task) => task.title)).toEqual(['Latest'])
  expect(a.memory.entries.map((entry) => entry.title)).toEqual(['Latest'])
  expect(a.planner.settings.minutes).toBe(60)
  expect(a.planner.accepted).toBeUndefined()
  expect(a.planner.proposal).toBeUndefined()
  expect(a.timer.selectedId).toBeUndefined()
  expect(a.history.sessions).toEqual([])
  vi.mocked(localStorage.setItem).mockClear()
  a.tasks.save({ ...input, title: 'Once' })
  expect(vi.mocked(localStorage.setItem).mock.calls.map(([key]) => key)).toEqual([
    STORAGE_KEY,
    MEMORY_STORAGE_KEY,
  ])
})

it('resets all state when every key is removed before reacquisition', async () => {
  const a = tab(lockService())
  await flushPromises()
  a.tasks.save(input)
  a.timer.select(a.tasks.tasks[0]!.id)
  a.timer.start()
  a.lifecycle.dispatchEvent(new Event('pagehide'))
  await flushPromises()
  data.clear()
  vi.mocked(localStorage.setItem).mockClear()
  a.lifecycle.dispatchEvent(new Event('pageshow'))
  await flushPromises()
  expect(a.tasks.tasks).toEqual([])
  expect(a.memory.entries).toEqual([])
  expect(a.history.sessions).toEqual([])
  expect(a.timer.state).toBe('ready')
  expect(a.timer.snapshot().saved).toEqual([])
  expect(localStorage.setItem).not.toHaveBeenCalled()
})

it('stays read-only when locking is unsupported', async () => {
  const a = tab(undefined)
  await flushPromises()
  tryMutations(a)
  expect(a.access.status).toBe('unsupported')
  expect(a.tasks.tasks).toEqual([])
  expect(localStorage.getItem).not.toHaveBeenCalled()
  expect(localStorage.setItem).not.toHaveBeenCalled()
})

it('fails closed and releases ownership if any storage key cannot be read', async () => {
  const locks = lockService()
  vi.mocked(localStorage.getItem).mockImplementation((key) => {
    if (key === PLAN_STORAGE_KEY) throw new Error('Denied')
    return null
  })
  const a = tab(locks)
  await flushPromises()
  expect(a.access.status).toBe('error')
  expect(a.access.canEdit).toBe(false)
  tryMutations(a)
  expect(localStorage.setItem).not.toHaveBeenCalled()
  vi.mocked(localStorage.getItem).mockReturnValue(null)
  const b = tab(locks)
  await flushPromises()
  expect(b.access.canEdit).toBe(true)
})

it('preserves damaged raw data and keeps quota errors explicit in the owner', async () => {
  data.set(STORAGE_KEY, '{broken')
  const a = tab(lockService())
  await flushPromises()
  a.tasks.save(input)
  expect(data.get(STORAGE_KEY)).toBe('{broken')
  expect(persistenceNotice.value).toContain('preserved')
  a.lifecycle.dispatchEvent(new Event('pagehide'))
  await flushPromises()
  data.clear()
  a.lifecycle.dispatchEvent(new Event('pageshow'))
  await flushPromises()
  vi.mocked(localStorage.setItem).mockImplementation(() => {
    throw new Error('Quota')
  })
  a.tasks.save(input)
  expect(a.tasks.tasks).toHaveLength(1)
  expect(persistenceNotice.value).toContain('Could not save')
})

it('does not create competing coordinators on rapid page lifecycle transitions', async () => {
  const locks = lockService()
  const a = tab(locks)
  await flushPromises()
  a.lifecycle.dispatchEvent(new Event('pagehide'))
  a.lifecycle.dispatchEvent(new Event('pageshow'))
  a.lifecycle.dispatchEvent(new Event('pagehide'))
  a.lifecycle.dispatchEvent(new Event('pageshow'))
  await flushPromises()
  expect(a.access.canEdit).toBe(true)
  expect(locks.request).toHaveBeenCalledTimes(2)
  await a.stop()
  a.lifecycle.dispatchEvent(new Event('pageshow'))
  await flushPromises()
  expect(locks.request).toHaveBeenCalledTimes(2)
})

it('shows read-only status, disables controls and blocks planner bindings even on synthetic input', async () => {
  const locks = lockService()
  const a = tab(locks)
  await flushPromises()
  a.tasks.save(input)
  a.timer.select(a.tasks.tasks[0]!.id)
  a.lifecycle.dispatchEvent(new Event('pagehide'))
  await flushPromises()
  const wrapper = mount(App, { global: { plugins: [a.pinia] } })
  cleanup.push(() => wrapper.unmount())
  expect(wrapper.get('.access-notice').text()).toContain('Read-only')
  const list = wrapper.getComponent(TaskList)
  expect(
    list.findAll('button, input').every((control) => control.attributes('disabled') !== undefined),
  ).toBe(true)
  expect(list.get('.drag-handle').attributes('draggable')).toBe('false')
  await wrapper.get('button[aria-label="Planner"]').trigger('click')
  const planner = wrapper.getComponent(SessionPlanner)
  const before = JSON.stringify(a.planner.settings)
  const minutes = planner.get('input[type="number"]')
  ;(minutes.element as HTMLInputElement).value = '99'
  await minutes.trigger('input')
  expect(JSON.stringify(a.planner.settings)).toBe(before)
  expect(wrapper.find('.access-notice').exists()).toBe(true)
  const timer = mount(FocusTimer, { global: { plugins: [a.pinia] } })
  cleanup.push(() => timer.unmount())
  expect(
    timer.findAll('button').every((button) => button.attributes('disabled') !== undefined),
  ).toBe(true)
  expect(timer.text()).toContain('Timer snapshot')
  a.lifecycle.dispatchEvent(new Event('pageshow'))
  await flushPromises()
  expect(a.access.canEdit).toBe(true)
  expect(wrapper.find('.access-notice').exists()).toBe(false)
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  expect(wrapper.get('main').classes()).not.toContain('workspace-hidden')
})
