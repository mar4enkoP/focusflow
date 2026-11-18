import { effectScope, onScopeDispose, ref, watch } from 'vue'
import { useWorkspaceAccessStore } from './stores/workspaceAccess'
import type { Pinia } from 'pinia'
import { useTasksStore, validateTask, type Task } from './stores/tasks'
import { useTimerStore } from './stores/timer'
import { normalizeTitle, useTaskMemoryStore, type TaskMemoryEntry } from './stores/taskMemory'
import { useFocusHistoryStore } from './stores/focusHistory'
import { usePlannerStore } from './stores/planner'
import { validSettings } from './planning'
export const PLAN_STORAGE_KEY = 'focusflow-plan'
export const planNotice = ref('')

export const STORAGE_KEY = 'focusflow'
export const MEMORY_STORAGE_KEY = 'focusflow-memory'
export const memoryNotice = ref('')
export const persistenceNotice = ref('Saved on this device')
const installed = new WeakMap<Pinia, () => void>()
type Timer = ReturnType<ReturnType<typeof useTimerStore>['snapshot']>
interface Snapshot {
  version: 1 | 2
  tasks: Task[]
  timer: Timer
  focus?: ReturnType<ReturnType<typeof useFocusHistoryStore>['snapshot']>
}
const number = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
export function validTimer(input: unknown): input is Timer {
  if (!input || typeof input !== 'object') return false
  const value = input as Record<string, unknown>
  return (
    value &&
    typeof value.state === 'string' &&
    ['ready', 'running', 'paused', 'expired'].includes(value.state) &&
    number(value.remaining) &&
    number(value.budget) &&
    value.remaining <= value.budget &&
    (value.selectedId === undefined || typeof value.selectedId === 'string') &&
    (value.state !== 'running' || number(value.deadline)) &&
    Array.isArray(value.saved) &&
    value.saved.every((entry: unknown) => {
      if (!Array.isArray(entry) || entry.length !== 2) return false
      const [id, session] = entry
      return (
        typeof id === 'string' &&
        id.trim().length > 0 &&
        session !== null &&
        typeof session === 'object' &&
        number(session.remaining) &&
        number(session.budget) &&
        session.remaining <= session.budget
      )
    }) &&
    new Set(value.saved.map(([id]) => id)).size === value.saved.length
  )
}
export function installPersistence(pinia: Pinia) {
  const existing = installed.get(pinia)
  if (existing) return existing
  const access = useWorkspaceAccessStore(pinia)
  let subscriptions: ReturnType<typeof effectScope> | undefined
  const stop = watch(
    () => access.ownsLock,
    (owned) => {
      subscriptions?.stop()
      subscriptions = undefined
      access.hydrated = false
      if (!owned) return
      access.hydrating = true
      try {
        // Read every key before touching stores. Each key retains its own damage policy.
        const reads = new Map<string, { raw: string | null; failed: boolean }>()
        for (const key of [STORAGE_KEY, MEMORY_STORAGE_KEY, PLAN_STORAGE_KEY]) {
          try {
            reads.set(key, { raw: localStorage.getItem(key), failed: false })
          } catch {
            reads.set(key, { raw: null, failed: true })
          }
        }
        if ([...reads.values()].some((result) => result.failed)) {
          throw new Error('Cannot safely reload the complete workspace')
        }
        const read = (key: string) => {
          const result = reads.get(key)!
          if (result.failed) throw new Error('Storage unavailable')
          return result.raw
        }
        const tasks = useTasksStore(pinia)
        const history = useFocusHistoryStore(pinia)
        const timer = useTimerStore(pinia)
        const planner = usePlannerStore(pinia)
        tasks.tasks = []
        history.sessions = []
        history.observations = []
        useTaskMemoryStore(pinia).entries = []
        timer.restore({
          state: 'ready',
          selectedId: undefined,
          remaining: 0,
          budget: 0,
          deadline: undefined,
          saved: [],
        })
        planner.proposal = undefined
        planner.error = ''
        planner.restore({
          settings: { minutes: 60, breakMinutes: 5, breakEvery: 2, selectedIds: [] },
        })
        persistenceNotice.value = 'Saved on this device'
        subscriptions = effectScope(true)
        const seedMemory = subscriptions.run(() => installSnapshot(pinia, read))
        access.hydrating = false
        access.hydrated = true
        access.generation += 1
        seedMemory?.()
      } catch {
        subscriptions?.stop()
        access.transition('error', 'Could not restore the workspace. Saved data is preserved.')
      } finally {
        access.hydrating = false
      }
    },
    { immediate: true, flush: 'sync' },
  )
  const dispose = () => {
    stop()
    subscriptions?.stop()
    access.hydrated = false
    installed.delete(pinia)
  }
  installed.set(pinia, dispose)
  return dispose
}

function installSnapshot(pinia: Pinia, read: (key: string) => string | null) {
  const access = useWorkspaceAccessStore(pinia)
  const tasks = useTasksStore(pinia)
  const timer = useTimerStore(pinia)
  const history = useFocusHistoryStore(pinia)
  let writable = true
  let recoveredClock = false
  let lastWritten: string | null = null
  try {
    const raw = read(STORAGE_KEY)
    lastWritten = raw
    if (raw !== null) {
      const data: Snapshot = JSON.parse(raw)
      if (
        ![1, 2].includes(data.version) ||
        !Array.isArray(data.tasks) ||
        !data.tasks.every(
          (t) =>
            t &&
            typeof t.id === 'string' &&
            t.id.trim() &&
            typeof t.title === 'string' &&
            typeof t.completed === 'boolean' &&
            !Object.values(validateTask(t)).some(Boolean),
        ) ||
        new Set(data.tasks.map((t) => t.id)).size !== data.tasks.length
      )
        throw new Error('Invalid saved data')
      tasks.tasks = data.tasks.map((task) => ({ ...task, priority: task.priority ?? 'Medium' }))
      // Recover valid tasks, but never overwrite malformed timer data with a fallback.
      if (!validTimer(data.timer)) throw new Error('Invalid saved timer')
      if (data.version === 2 && !history.restore(data.focus, tasks.tasks, data.timer.selectedId)) {
        writable = false
        persistenceNotice.value =
          'Some focus history is damaged. Valid data is restored; saved data is preserved.'
      }
      if (data.version === 1) {
        // Never infer actual work from a legacy countdown. Preserve it, but exclude
        // the partially measured task from learning, including saved/paused sessions.
        for (const task of tasks.tasks.filter(
          (t) =>
            !t.completed &&
            (t.id === data.timer.selectedId || data.timer.saved.some(([id]) => id === t.id)),
        )) {
          history.begin(task, false)
          if (task.id !== data.timer.selectedId || data.timer.state !== 'running')
            history.pause(task.id)
        }
      }
      const active = tasks.tasks.find((t) => t.id === data.timer.selectedId && !t.completed)
      if (
        active &&
        data.timer.state === 'running' &&
        !history.sessions.some((s) => s.taskId === active.id)
      )
        history.begin(active, false)
      if (active && !['running', 'expired'].includes(data.timer.state)) history.pause(active.id)
      recoveredClock = timer.restore(data.timer) === true
    }
  } catch {
    writable = false
    persistenceNotice.value =
      'Saved data unavailable. Changes stay in this visit; existing data is preserved.'
  }
  const save = () => {
    if (!writable || !access.canEdit || access.mutationDepth) return
    try {
      const serialized = JSON.stringify({
        version: 2,
        tasks: tasks.tasks,
        timer: timer.snapshot(),
        focus: history.snapshot(),
      } satisfies Snapshot)
      if (serialized === lastWritten) return
      localStorage.setItem(STORAGE_KEY, serialized)
      lastWritten = serialized
      persistenceNotice.value = recoveredClock
        ? 'Clock change detected. Timer paused; resume when ready. Saved on this device.'
        : 'Saved on this device'
    } catch {
      persistenceNotice.value = 'Could not save on this device. Changes stay in this visit.'
    }
  }
  onScopeDispose(tasks.$subscribe(save, { detached: true, flush: 'sync' }))
  watch(() => access.revision, save, { flush: 'sync' })
  onScopeDispose(
    timer.$onAction(({ name, after }) => {
      if (name === 'sync')
        after((recovered) => {
          if (recovered === true) {
            recoveredClock = true
            save()
          }
        })
      else if (name !== 'snapshot')
        after(() => {
          if (name === 'start' || name === 'continueFocus') recoveredClock = false
          save()
        })
    }, true),
  )
  watch(
    () => timer.state,
    (state) => {
      if (state === 'expired') save()
    },
    { flush: 'sync' },
  )
  const seedMemory = installMemoryPersistence(pinia, tasks.tasks, read)
  installPlanPersistence(pinia, read)
  return () => {
    seedMemory()
    // Called only after all keys are hydrated and editing is authorized under the lock.
    if (recoveredClock) save()
  }
}

function installPlanPersistence(pinia: Pinia, read: (key: string) => string | null) {
  const access = useWorkspaceAccessStore(pinia)
  const planner = usePlannerStore(pinia)
  let writable = true
  let last: string | null = null
  planNotice.value = ''
  try {
    last = read(PLAN_STORAGE_KEY)
    if (last !== null) {
      const data = JSON.parse(last)
      if (data?.version !== 1 || !planner.restore(data)) throw new Error('Invalid plan')
    }
  } catch {
    writable = false
    planNotice.value =
      'Saved plan unavailable. Changes stay in this visit; saved data is preserved.'
  }
  let validPreferences = JSON.parse(JSON.stringify(planner.settings))
  watch(
    () => [planner.snapshot(), access.revision],
    () => {
      if (!writable || !access.canEdit || access.mutationDepth) return
      try {
        if (validSettings(planner.settings))
          validPreferences = JSON.parse(JSON.stringify(planner.settings))
        const serialized = JSON.stringify({
          version: 1,
          ...planner.snapshot(),
          settings: validPreferences,
        })
        if (serialized === last) return
        localStorage.setItem(PLAN_STORAGE_KEY, serialized)
        last = serialized
        planNotice.value = ''
      } catch {
        planNotice.value = 'Could not save the plan. Changes stay in this visit.'
      }
    },
    { deep: true, flush: 'sync' },
  )
}

// A separate versioned key keeps damaged/unsupported memory independent of tasks
// and timers, and avoids rewriting the task snapshot while managing suggestions.
function installMemoryPersistence(
  pinia: Pinia,
  existingTasks: Task[],
  read: (key: string) => string | null,
) {
  const access = useWorkspaceAccessStore(pinia)
  const memory = useTaskMemoryStore(pinia)
  let writable = true
  let seeded = false
  let lastWritten: string | null = null
  memoryNotice.value = ''
  try {
    const raw = read(MEMORY_STORAGE_KEY)
    lastWritten = raw
    if (raw === null) {
      // Existing tasks seed memory once; an explicitly saved empty memory stays empty.
      for (const task of existingTasks) memory.remember(task, 0)
      seeded = existingTasks.length > 0
    } else {
      const data = JSON.parse(raw)
      if (data?.version !== 1 || !Array.isArray(data.entries)) throw new Error('Invalid memory')
      const valid = new Map<string, TaskMemoryEntry>()
      for (const entry of data.entries) {
        if (
          !entry ||
          typeof entry.title !== 'string' ||
          Object.values(validateTask(entry)).some(Boolean) ||
          !number(entry.lastUsed) ||
          !number(entry.uses) ||
          entry.uses < 1
        ) {
          writable = false
          continue
        }
        const key = normalizeTitle(entry.title)
        const previous = valid.get(key)
        if (!previous || entry.lastUsed > previous.lastUsed) {
          valid.set(key, {
            title: entry.title.trim(),
            duration: entry.duration,
            category: entry.category,
            priority: entry.priority ?? 'Medium',
            lastUsed: entry.lastUsed,
            uses: entry.uses,
          })
        }
      }
      memory.entries = [...valid.values()]
    }
  } catch {
    writable = false
  }
  if (!writable)
    memoryNotice.value =
      'Saved memory is damaged or unavailable. Changes to suggestions stay in this visit; saved data is preserved.'
  const saveMemory = () => {
    if (!writable || !access.canEdit || access.mutationDepth) return
    try {
      const serialized = JSON.stringify({ version: 1, entries: memory.entries })
      if (serialized === lastWritten) return
      localStorage.setItem(MEMORY_STORAGE_KEY, serialized)
      lastWritten = serialized
      memoryNotice.value = ''
    } catch {
      memoryNotice.value = 'Could not save task memory. Suggestions stay in this visit.'
    }
  }
  onScopeDispose(memory.$subscribe(saveMemory, { detached: true, flush: 'sync' }))
  watch(() => access.revision, saveMemory, { flush: 'sync' })
  return () => {
    if (seeded) saveMemory()
  }
}
