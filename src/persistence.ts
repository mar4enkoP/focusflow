import { ref, watch } from 'vue'
import type { Pinia } from 'pinia'
import { useTasksStore, validateTask, type Task } from './stores/tasks'
import { useTimerStore } from './stores/timer'

export const STORAGE_KEY = 'focusflow'
export const persistenceNotice = ref('Saved on this device')
const installed = new WeakSet<Pinia>()
type Timer = ReturnType<ReturnType<typeof useTimerStore>['snapshot']>
interface Snapshot {
  version: 1
  tasks: Task[]
  timer: Timer
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
  let writable = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw !== null) {
      const data: Snapshot = JSON.parse(raw)
      if (
        data.version !== 1 ||
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
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          tasks: tasks.tasks,
          timer: timer.snapshot(),
        } satisfies Snapshot),
      )
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
}
