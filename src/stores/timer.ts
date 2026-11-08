import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useTasksStore } from './tasks'
import { useFocusHistoryStore } from './focusHistory'
import { usePlannerStore } from './planner'
export const useTimerStore = defineStore('timer', () => {
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
  function sync() {
    history.tick(selectedId.value)
    if (state.value !== 'running' || deadline.value === undefined) return
    remaining.value = Math.min(budget.value, Math.max(0, deadline.value - Date.now()))
    if (!remaining.value) {
      state.value = 'expired'
      deadline.value = undefined
    }
  }
  function pause() {
    sync()
    history.pause(selectedId.value)
    if (state.value === 'running') {
      state.value = 'paused'
      deadline.value = undefined
    }
  }
  function select(id: string) {
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
    if (!task.value || task.value.completed || state.value === 'running' || remaining.value <= 0)
      return
    history.begin(task.value)
    planner.begin(task.value.id)
    deadline.value = Date.now() + remaining.value
    state.value = 'running'
  }
  function reset() {
    history.pause(selectedId.value)
    deadline.value = undefined
    remaining.value = (task.value?.duration ?? 0) * 60000
    budget.value = remaining.value
    state.value = 'ready'
  }
  function addTime() {
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
    if (task.value && !task.value.completed && state.value === 'expired') history.begin(task.value)
    else start()
  }
  function advance(oldId: string) {
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
    if (task.value && !task.value.completed) tasks.toggle(task.value.id)
  }
  watch(
    () => tasks.tasks.map((t) => `${t.id}:${t.completed}`).join('|'),
    () => {
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
    saved.clear()
    for (const [id, session] of value.saved)
      if (tasks.tasks.some((t) => t.id === id && !t.completed)) saved.set(id, session)
    const active = tasks.tasks.find((t) => t.id === value.selectedId && !t.completed)
    selectedId.value = active?.id
    remaining.value = active ? value.remaining : 0
    budget.value = active ? value.budget : 0
    state.value = active ? value.state : 'ready'
    deadline.value = active && value.state === 'running' ? value.deadline : undefined
    sync()
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
