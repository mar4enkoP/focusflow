import { defineStore } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { useTasksStore, type Task } from './tasks'
import { useTimerStore } from './timer'
import { useFocusHistoryStore } from './focusHistory'
import { useWorkspaceAccessStore } from './workspaceAccess'

export const UNDO_WINDOW_MS = 10_000
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

export const useTaskDeletionStore = defineStore('taskDeletion', () => {
  const tasks = useTasksStore()
  const timer = useTimerStore()
  const history = useFocusHistoryStore()
  const access = useWorkspaceAccessStore()
  const title = ref('')
  const revision = ref(0)
  let timeout: ReturnType<typeof setTimeout> | undefined
  let pending:
    | {
        task: Task
        index: number
        nextId?: string
        expires: number
        session: (typeof history.sessions)[number] | undefined
        timer: ReturnType<typeof timer.snapshot>
        after: string
      }
    | undefined
  function clear() {
    clearTimeout(timeout)
    pending = undefined
    title.value = ''
  }
  function remove(id: string) {
    if (!access.canEdit) return false
    const index = tasks.tasks.findIndex((task) => task.id === id)
    const task = tasks.tasks[index]
    if (!task) return false
    clear()
    access.batch(() => {
      // Never resume work automatically through Undo. Preserve measured work and
      // pause the deleted task before capturing its independent recovery record.
      if (timer.selectedId === id) timer.pause()
      const session = history.sessions.find((item) => item.taskId === id)
      const record = {
        task: clone(task),
        index,
        nextId: tasks.tasks[index + 1]?.id,
        expires: Date.now() + UNDO_WINDOW_MS,
        session: session ? clone(session) : undefined,
        timer: clone(timer.snapshot()),
        after: '',
      }
      tasks.remove(id)
      record.after = JSON.stringify(timer.snapshot())
      pending = record
      revision.value++
      title.value = task.title
    })
    timeout = setTimeout(clear, UNDO_WINDOW_MS)
    return true
  }
  function undo() {
    const record = pending
    if (!access.canEdit || !record || Date.now() >= record.expires) {
      clear()
      return false
    }
    if (tasks.tasks.some((task) => task.id === record.task.id)) {
      clear()
      return false
    }
    access.batch(() => {
      const unchanged = JSON.stringify(timer.snapshot()) === record.after
      const order = [...tasks.tasks]
      const anchor = order.findIndex((task) => task.id === record.nextId)
      order.splice(anchor >= 0 ? anchor : Math.min(record.index, order.length), 0, record.task)
      tasks.tasks = order
      if (record.session) history.sessions.push(record.session)
      const current = timer.snapshot()
      if (unchanged && record.timer.selectedId === record.task.id) timer.restore(record.timer)
      else {
        const saved = record.timer.saved.find(([id]) => id === record.task.id)
        const selected =
          record.timer.selectedId === record.task.id
            ? ([
                record.task.id,
                { remaining: record.timer.remaining, budget: record.timer.budget },
              ] as const)
            : saved
        if (selected)
          timer.restore({
            ...current,
            saved: [
              ...current.saved.filter(([id]) => id !== record.task.id),
              [selected[0], selected[1]],
            ],
          })
      }
    })
    clear()
    return true
  }
  // Undo is deliberately visit-local: deletion is already persisted, and reload
  // or lock handoff must never replay recovery against another owner's workspace.
  watch(() => [access.canEdit, access.generation], clear, { flush: 'sync' })
  onScopeDispose(clear)
  return { title, revision, remove, undo }
})
