import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
export const categories = ['Work', 'Study', 'Personal', 'Health', 'Reading'] as const
export type Category = (typeof categories)[number]
export interface TaskInput {
  title: string
  duration: number
  category: Category
}
export interface Task extends TaskInput {
  id: string
  completed: boolean
}
export function validateTask(input: TaskInput) {
  return {
    title: input.title.trim() ? '' : 'Give your task a title.',
    duration:
      Number.isSafeInteger(input.duration) && input.duration > 0 && input.duration <= 1440
        ? ''
        : 'Choose a whole number from 1 to 1,440 minutes.',
    category: categories.includes(input.category) ? '' : 'Choose a category.',
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
    const values = { ...input, title: input.title.trim() }
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
    if (index < 0 || destination < 0 || destination >= tasks.value.length) return
    const [task] = tasks.value.splice(index, 1)
    if (task) tasks.value.splice(destination, 0, task)
  }
  return { tasks, remaining, totalMinutes, save, remove, toggle, move }
})
