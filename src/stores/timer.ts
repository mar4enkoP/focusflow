import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useTasksStore } from './tasks'
export const useTimerStore = defineStore('timer', () => {
  const tasks = useTasksStore()
  const selectedId = ref<string>()
  const remaining = ref(0)
  const budget = ref(0)
  const deadline = ref<number>()
  const state = ref<'ready' | 'running' | 'paused' | 'expired'>('ready')
  const task = computed(() => tasks.tasks.find((t) => t.id === selectedId.value))
  const progress = computed(() =>
    budget.value ? Math.min(100, Math.max(0, 100 * (1 - remaining.value / budget.value))) : 0,
  )
  const saved = new Map<string, { remaining: number; budget: number }>()
  function sync() {
    if (state.value !== 'running' || deadline.value === undefined) return
    remaining.value = Math.max(0, deadline.value - Date.now())
    if (!remaining.value) {
      state.value = 'expired'
      deadline.value = undefined
    }
  }
  function pause() {
    sync()
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
    deadline.value = Date.now() + remaining.value
    state.value = 'running'
  }
  function reset() {
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
    else if (state.value === 'expired') state.value = 'paused'
  }
  function advance(oldId: string) {
    const index = tasks.tasks.findIndex((t) => t.id === oldId)
    const ordered = [...tasks.tasks.slice(index + 1), ...tasks.tasks.slice(0, index + 1)]
    selectedId.value = undefined
    reset()
    saved.delete(oldId)
    const next = ordered.find((t) => !t.completed)
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
  return {
    selectedId,
    task,
    remaining,
    budget,
    progress,
    state,
    sync,
    pause,
    select,
    start,
    reset,
    addTime,
    complete,
  }
})
