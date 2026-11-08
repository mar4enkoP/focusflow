import { estimateDuration, type Observation } from './estimation'
import type { Task } from './stores/tasks'

export interface PlanSettings {
  minutes: number
  breakMinutes: number
  breakEvery: number
  selectedIds: string[]
}
export interface Slot {
  kind: 'task' | 'break'
  taskId?: string
  title: string
  start: number
  end: number
  learned: boolean
}
export interface Omitted {
  taskId: string
  title: string
  reason: string
}
export interface Schedule {
  slots: Slot[]
  omitted: Omitted[]
  total: number
  breaks: number
  free: number
}
export const validSettings = (s: PlanSettings) =>
  s &&
  Number.isInteger(s.minutes) &&
  s.minutes >= 1 &&
  s.minutes <= 1440 &&
  Number.isInteger(s.breakMinutes) &&
  s.breakMinutes >= 0 &&
  s.breakMinutes <= 60 &&
  Number.isInteger(s.breakEvery) &&
  s.breakEvery >= 1 &&
  s.breakEvery <= 20 &&
  Array.isArray(s.selectedIds) &&
  s.selectedIds.every((id) => typeof id === 'string') &&
  new Set(s.selectedIds).size === s.selectedIds.length

// Stable priority-first greedy packing. A skipped large task does not block smaller
// tasks. Breaks exist only between tasks, and only when both break + next task fit.
export function generateSchedule(
  tasks: Task[],
  settings: PlanSettings,
  history: Observation[],
  budget = settings.minutes,
  active?: { id: string; remaining: number },
  completedCount = 0,
): Schedule {
  if (!validSettings(settings) || !Number.isFinite(budget) || budget < 0 || budget > 1440)
    throw new Error('Invalid planning settings')
  const slots: Slot[] = [],
    omitted: Omitted[] = []
  let total = 0,
    breaks = 0,
    count = completedCount
  let activeBlocked = false
  const ranks = { High: 0, Medium: 1, Low: 2 }
  const selected = tasks
    .filter((t) => settings.selectedIds.includes(t.id) && !t.completed)
    .map((task, index) => ({ task, index }))
    .sort(
      (a, b) =>
        Number(b.task.id === active?.id) - Number(a.task.id === active?.id) ||
        ranks[a.task.priority] - ranks[b.task.priority] ||
        a.index - b.index,
    )
  for (const id of settings.selectedIds) {
    if (!tasks.some((t) => t.id === id))
      omitted.push({ taskId: id, title: 'Unavailable task', reason: 'Task was deleted' })
  }
  for (const { task } of selected) {
    const estimate = estimateDuration(task.title, task.duration, history)
    const minutes =
      task.id === active?.id ? Math.max(1, Math.ceil(active.remaining)) : estimate.minutes
    const rest =
      task.id !== active?.id && count > 0 && count % settings.breakEvery === 0
        ? settings.breakMinutes
        : 0
    if (activeBlocked || total + rest + minutes > budget) {
      omitted.push({
        taskId: task.id,
        title: task.title,
        reason:
          task.id === active?.id
            ? 'Active work exceeds remaining budget; timer continues'
            : 'Does not fit the available time',
      })
      if (task.id === active?.id) activeBlocked = true
      continue
    }
    if (rest) {
      slots.push({ kind: 'break', title: 'Break', start: total, end: total + rest, learned: false })
      total += rest
      breaks += rest
    }
    slots.push({
      kind: 'task',
      taskId: task.id,
      title: task.title,
      start: total,
      end: total + minutes,
      learned: estimate.learned,
    })
    total += minutes
    count++
  }
  return { slots, omitted, total, breaks, free: budget - total }
}
