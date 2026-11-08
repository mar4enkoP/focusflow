import { ref, watch } from 'vue'
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
const installed = new WeakSet<Pinia>()
type Timer = ReturnType<ReturnType<typeof useTimerStore>['snapshot']>
interface Snapshot {
  version: 1 | 2
  tasks: Task[]
  timer: Timer
  focus?: ReturnType<ReturnType<typeof useFocusHistoryStore>['snapshot']>
}
const number = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
function validTimer(value: Timer) {
  return (
    value &&
    ['ready', 'running', 'paused', 'expired'].includes(value.state) &&
    number(value.remaining) &&
    number(value.budget) &&
    value.remaining <= value.budget &&
    (value.selectedId === undefined || typeof value.selectedId === 'string') &&
    (value.state !== 'running' ||
      (number(value.deadline) && value.deadline <= Date.now() + value.budget)) &&
    Array.isArray(value.saved) &&
    value.saved.every(
      ([id, session]) =>
        typeof id === 'string' &&
        number(session.remaining) &&
        number(session.budget) &&
        session.remaining <= session.budget,
    )
  )
}
export function installPersistence(pinia: Pinia) {
  if (installed.has(pinia)) return
  installed.add(pinia)
  const tasks = useTasksStore(pinia)
  const timer = useTimerStore(pinia)
  const history = useFocusHistoryStore(pinia)
  let writable = true
  let lastWritten: string | null = null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
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
        new Set(data.tasks.map((t) => t.id)).size !== data.tasks.length ||
        !validTimer(data.timer)
      )
        throw new Error('Invalid saved data')
      tasks.tasks = data.tasks.map((task) => ({ ...task, priority: task.priority ?? 'Medium' }))
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
      timer.restore(data.timer)
    }
  } catch {
    writable = false
    persistenceNotice.value =
      'Saved data unavailable. Changes stay in this visit; existing data is preserved.'
  }
  const save = () => {
    if (!writable) return
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
      persistenceNotice.value = 'Saved on this device'
    } catch {
      persistenceNotice.value = 'Could not save on this device. Changes stay in this visit.'
    }
  }
  tasks.$subscribe(save, { detached: true, flush: 'sync' })
  timer.$onAction(({ name, after }) => {
    if (name !== 'sync' && name !== 'snapshot') after(save)
  }, true)
  watch(
    () => timer.state,
    (state) => {
      if (state === 'expired') save()
    },
    { flush: 'sync' },
  )
  installMemoryPersistence(pinia, tasks.tasks)
  installPlanPersistence(pinia)
}

function installPlanPersistence(pinia: Pinia) {
  const planner = usePlannerStore(pinia)
  let writable = true
  let last: string | null = null
  planNotice.value = ''
  try {
    last = localStorage.getItem(PLAN_STORAGE_KEY)
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
    () => planner.snapshot(),
    () => {
      if (!writable) return
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
function installMemoryPersistence(pinia: Pinia, existingTasks: Task[]) {
  const memory = useTaskMemoryStore(pinia)
  let writable = true
  let seeded = false
  memoryNotice.value = ''
  try {
    const raw = localStorage.getItem(MEMORY_STORAGE_KEY)
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
    if (!writable) return
    try {
      localStorage.setItem(
        MEMORY_STORAGE_KEY,
        JSON.stringify({ version: 1, entries: memory.entries }),
      )
      memoryNotice.value = ''
    } catch {
      memoryNotice.value = 'Could not save task memory. Suggestions stay in this visit.'
    }
  }
  memory.$subscribe(saveMemory, { detached: true, flush: 'sync' })
  if (seeded) saveMemory()
}
