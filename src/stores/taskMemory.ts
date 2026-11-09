import { useWorkspaceAccessStore } from './workspaceAccess'
import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { TaskInput, Priority } from './tasks'

export interface TaskMemoryEntry extends TaskInput {
  priority: Priority
  lastUsed: number
  uses: number
}

export const normalizeTitle = (title: string) => title.trim().replace(/\s+/g, ' ').toLowerCase()

export const useTaskMemoryStore = defineStore('taskMemory', () => {
  const access = useWorkspaceAccessStore()
  const entries = ref<TaskMemoryEntry[]>([])
  function remember(input: TaskInput, timestamp = Date.now()) {
    if (!access.canMutate) return false
    const key = normalizeTitle(input.title)
    if (!key) return
    const previous = entries.value.find((entry) => normalizeTitle(entry.title) === key)
    const entry: TaskMemoryEntry = {
      title: input.title.trim(),
      duration: input.duration,
      category: input.category, // Icons are derived from category throughout FocusFlow.
      priority: input.priority ?? 'Medium',
      lastUsed: timestamp,
      uses: Math.min((previous?.uses ?? 0) + 1, Number.MAX_SAFE_INTEGER),
    }
    entries.value = [...entries.value.filter((item) => normalizeTitle(item.title) !== key), entry]
  }
  function forget(title: string) {
    if (!access.canMutate) return false
    if (!entries.value.some((entry) => normalizeTitle(entry.title) === normalizeTitle(title)))
      return
    entries.value = entries.value.filter(
      (entry) => normalizeTitle(entry.title) !== normalizeTitle(title),
    )
  }
  function matches(title: string) {
    const query = normalizeTitle(title)
    const relevance = (entry: TaskMemoryEntry) => {
      const key = normalizeTitle(entry.title)
      return key === query ? 0 : key.startsWith(query) ? 1 : 2
    }
    return entries.value
      .filter((entry) => normalizeTitle(entry.title).includes(query))
      .sort(
        (a, b) =>
          relevance(a) - relevance(b) ||
          b.uses - a.uses ||
          b.lastUsed - a.lastUsed ||
          (normalizeTitle(a.title) < normalizeTitle(b.title) ? -1 : 1),
      )
  }
  return { entries, remember, forget, matches }
})
