import { useWorkspaceAccessStore } from './workspaceAccess'
import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useTasksStore } from './tasks'
import { useFocusHistoryStore } from './focusHistory'
import { usePlannerStore } from './planner'
export const useTimerStore = defineStore('timer', () => {
  const access = useWorkspaceAccessStore()
  const tasks = useTasksStore()
  const history = useFocusHistoryStore()
  const planner = usePlannerStore()
  const selectedId = ref<string>()
  const remaining = ref(0)
  const budget = ref(0)
  const deadline = ref<number>()
  const state = ref<'ready' | 'running' | 'paused' | 'expired'>('ready')
  const task = computed(() => tasks.tasks.find((t) => t.id === selectedId.value))
  const isFocusing = computed(() =>
    history.sessions.some((s) => s.taskId === selectedId.value && s.since !== undefined),
  )
  const progress = computed(() =>
    budget.value ? Math.min(100, Math.max(0, 100 * (1 - remaining.value / budget.value))) : 0,
  )
  const saved = new Map<string, { remaining: number; budget: number }>()
  // React to explicit edits only; hydration restores its own timer snapshot.
  tasks.$onAction(({ name, args, after }) => {
    if (name !== 'save') return
    const [input, id] = args
    const previous = tasks.tasks.find((item) => item.id === id)
    if (!previous || previous.duration === input.duration) return
    after((success) => {
      if (!success || !access.canMutate || !id) return
      access.batch(() => {
        const nextBudget = input.duration * 60000
        if (selectedId.value === id) {
          sync()
          const elapsed = Math.max(0, budget.value - remaining.value)
          budget.value = nextBudget
          remaining.value = Math.max(0, nextBudget - elapsed)
          if (state.value === 'running' && remaining.value > 0)
            deadline.value = Date.now() + remaining.value
          else if (!remaining.value) {
            deadline.value = undefined
            state.value = 'expired'
          } else if (state.value === 'expired') state.value = 'paused'
        }
        const cached = saved.get(id)
        if (cached)
          saved.set(id, {
            budget: nextBudget,
            remaining: Math.max(0, nextBudget - (cached.budget - cached.remaining)),
          })
      })
    })
  })
  function sync() {
    if (!access.canMutate) return false
    const now = Date.now()
    const session = history.sessions.find((s) => s.taskId === selectedId.value)
    const rollback =
      (session?.since !== undefined && session.since > now) ||
      (state.value === 'running' &&
        deadline.value !== undefined &&
        deadline.value - now > remaining.value)
    if (rollback) {
      if (session) session.reliable = false
      history.pause(selectedId.value, now)
      deadline.value = undefined
      if (state.value === 'running') state.value = 'paused'
      return true
    }
    history.tick(selectedId.value, now)
    if (state.value !== 'running' || deadline.value === undefined) return
    remaining.value = Math.min(budget.value, Math.max(0, deadline.value - now))
    if (!remaining.value) {
      state.value = 'expired'
      deadline.value = undefined
    }
  }
  function pause() {
    if (!access.canMutate) return false
    sync()
    history.pause(selectedId.value)
    if (state.value === 'running') {
      state.value = 'paused'
      deadline.value = undefined
    }
  }
  function select(id: string) {
    if (!access.canMutate) return false
    const next = tasks.tasks.find((t) => t.id === id && !t.completed)
    if (!next || id === selectedId.value) return
    pause()
    if (selectedId.value)
      saved.set(selectedId.value, { remaining: remaining.value, budget: budget.value })
    selectedId.value = id
    const previous = saved.get(id)
    remaining.value = previous?.remaining ?? next.duration * 60000
    budget.value = previous?.budget ?? remaining.value
    state.value = remaining.value ? 'ready' : 'expired'
  }
  function start() {
    if (!access.canMutate) return false
    if (!task.value || task.value.completed || state.value === 'running' || remaining.value <= 0)
      return
    history.begin(task.value)
    planner.begin(task.value.id)
    deadline.value = Date.now() + remaining.value
    state.value = 'running'
  }
  function reset() {
    if (!access.canMutate) return false
    history.pause(selectedId.value)
    deadline.value = undefined
    remaining.value = (task.value?.duration ?? 0) * 60000
    budget.value = remaining.value
    state.value = 'ready'
  }
  function addTime() {
    if (!access.canMutate) return false
    if (!task.value) return
    sync()
    remaining.value += 300000
    budget.value += 300000
    if (state.value === 'running') deadline.value = Date.now() + remaining.value
    else if (state.value === 'expired') {
      history.pause(selectedId.value)
      state.value = 'paused'
    }
  }
  function continueFocus() {
    if (!access.canMutate) return false
    if (task.value && !task.value.completed && state.value === 'expired') history.begin(task.value)
    else start()
  }
  function advance(oldId: string) {
    if (!access.canMutate) return false
    const index = tasks.tasks.findIndex((t) => t.id === oldId)
    const ordered = [...tasks.tasks.slice(index + 1), ...tasks.tasks.slice(0, index + 1)]
    selectedId.value = undefined
    reset()
    saved.delete(oldId)
    const inPlan = planner.accepted?.activeId === oldId
    const next = inPlan
      ? tasks.tasks.find((t) => t.id === planner.nextId)
      : ordered.find((t) => !t.completed)
    if (next) select(next.id)
  }
  function complete() {
    if (!access.canMutate) return false
    if (task.value && !task.value.completed) tasks.toggle(task.value.id)
  }
  watch(
    () => tasks.tasks.map((t) => `${t.id}:${t.completed}`).join('|'),
    () => {
      if (!access.canEdit) return
      if (selectedId.value && (!task.value || task.value.completed)) advance(selectedId.value)
      for (const id of saved.keys())
        if (!tasks.tasks.some((t) => t.id === id && !t.completed)) saved.delete(id)
    },
    { flush: 'sync' },
  )
  function snapshot() {
    return {
      selectedId: selectedId.value,
      remaining: remaining.value,
      budget: budget.value,
      deadline: deadline.value,
      state: state.value,
      saved: [...saved.entries()],
    }
  }
  function restore(value: ReturnType<typeof snapshot>) {
    if (!access.canMutate) return false
    saved.clear()
    for (const [id, session] of value.saved)
      if (tasks.tasks.some((t) => t.id === id && !t.completed)) saved.set(id, session)
    const active = tasks.tasks.find((t) => t.id === value.selectedId && !t.completed)
    selectedId.value = active?.id
    remaining.value = active ? value.remaining : 0
    budget.value = active ? value.budget : 0
    state.value = active ? value.state : 'ready'
    deadline.value = active && value.state === 'running' ? value.deadline : undefined
    return sync()
  }
  return {
    snapshot,
    restore,
    selectedId,
    task,
    remaining,
    budget,
    progress,
    state,
    isFocusing,
    continueFocus,
    sync,
    pause,
    select,
    start,
    reset,
    addTime,
    complete,
  }
})
