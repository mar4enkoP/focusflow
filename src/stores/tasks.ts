import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
export const categories = ['Work', 'Study', 'Personal', 'Health', 'Reading'] as const
export type Category = (typeof categories)[number]
export const priorities = ['High', 'Medium', 'Low'] as const
export type Priority = (typeof priorities)[number]
export interface TaskInput {
  title: string
  duration: number
  category: Category
  priority?: Priority
}
export interface Task extends TaskInput {
  id: string
  completed: boolean
  priority: Priority
}
export function validateTask(input: TaskInput) {
  return {
    title: input.title.trim() ? '' : 'Give your task a title.',
    duration:
      Number.isSafeInteger(input.duration) && input.duration > 0 && input.duration <= 1440
        ? ''
        : 'Choose a whole number from 1 to 1,440 minutes.',
    category: categories.includes(input.category) ? '' : 'Choose a category.',
    priority:
      input.priority === undefined || priorities.includes(input.priority)
        ? ''
        : 'Choose a priority.',
  }
}
export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const remaining = computed(() => tasks.value.filter((t) => !t.completed).length)
  const totalMinutes = computed(() =>
    tasks.value.filter((t) => !t.completed).reduce((sum, t) => sum + t.duration, 0),
  )
  function save(input: TaskInput, id?: string) {
    if (Object.values(validateTask(input)).some(Boolean)) return false
    const values = { ...input, title: input.title.trim(), priority: input.priority ?? 'Medium' }
    if (id) {
      const task = tasks.value.find((t) => t.id === id)
      if (!task) return false
      Object.assign(task, values)
    } else tasks.value.push({ ...values, id: crypto.randomUUID(), completed: false })
    return true
  }
  function remove(id: string) {
    tasks.value = tasks.value.filter((t) => t.id !== id)
  }
  function toggle(id: string) {
    const task = tasks.value.find((t) => t.id === id)
    if (task) task.completed = !task.completed
  }
  function move(id: string, direction: -1 | 1) {
    const index = tasks.value.findIndex((t) => t.id === id)
    const destination = index + direction
    return moveTo(id, destination)
  }
  // Publish a complete order once: synchronous timer/persistence watchers must never
  // observe the selected task temporarily missing during a reorder.
  function moveTo(id: string, destination: number) {
    const index = tasks.value.findIndex((t) => t.id === id)
    if (
      index < 0 ||
      !Number.isInteger(destination) ||
      destination < 0 ||
      destination >= tasks.value.length ||
      index === destination
    )
      return false
    const reordered = [...tasks.value]
    const [task] = reordered.splice(index, 1)
    reordered.splice(destination, 0, task!)
    tasks.value = reordered
    return true
  }
  function reorder(id: string, targetId: string, position: 'before' | 'after') {
    const from = tasks.value.findIndex((t) => t.id === id)
    const target = tasks.value.findIndex((t) => t.id === targetId)
    if (from < 0 || target < 0 || id === targetId) return false
    const boundary = target + (position === 'after' ? 1 : 0)
    return moveTo(id, boundary - (from < boundary ? 1 : 0))
  }
  return { tasks, remaining, totalMinutes, save, remove, toggle, move, reorder }
})
