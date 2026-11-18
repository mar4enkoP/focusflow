import { createPinia, disposePinia, getActivePinia, setActivePinia, type Pinia } from 'pinia'
import { createEmergencyExport } from './emergencyExport'
import { STORAGE_KEY, MEMORY_STORAGE_KEY, PLAN_STORAGE_KEY, validTimer } from './persistence'
import { APPEARANCE_KEY } from './stores/appearance'
import { useWorkspaceAccessStore } from './stores/workspaceAccess'
import { validateTask, type Task } from './stores/tasks'
import { useFocusHistoryStore } from './stores/focusHistory'
import { usePlannerStore } from './stores/planner'
import type { TaskMemoryEntry } from './stores/taskMemory'

export const workspaceKeys = [
  STORAGE_KEY,
  MEMORY_STORAGE_KEY,
  PLAN_STORAGE_KEY,
  APPEARANCE_KEY,
  'focusflow.language',
]
export function readBackup(text: string): Record<string, string> {
  const data = JSON.parse(text)
  if (data?.format !== 'focusflow-recovery' || data.version !== 1 || !data.current)
    throw new Error('Invalid backup')
  const current = data.current
  const workspace = current[STORAGE_KEY]
  if (
    workspace?.version !== 2 ||
    !Array.isArray(workspace.tasks) ||
    !workspace.tasks.every(
      (t: Task) =>
        t &&
        typeof t.id === 'string' &&
        t.id.trim() &&
        typeof t.title === 'string' &&
        typeof t.completed === 'boolean' &&
        !Object.values(validateTask(t)).some(Boolean),
    ) ||
    new Set(workspace.tasks.map((t: Task) => t.id)).size !== workspace.tasks.length ||
    !validTimer(workspace.timer)
  )
    throw new Error('Invalid tasks or timer')
  const memory = current[MEMORY_STORAGE_KEY]
  if (
    memory?.version !== 1 ||
    !Array.isArray(memory.entries) ||
    !memory.entries.every(
      (e: TaskMemoryEntry) =>
        e &&
        typeof e.title === 'string' &&
        !Object.values(validateTask(e)).some(Boolean) &&
        Number.isSafeInteger(e.lastUsed) &&
        e.lastUsed >= 0 &&
        Number.isSafeInteger(e.uses) &&
        e.uses > 0,
    )
  )
    throw new Error('Invalid remembered tasks')
  if ('focusflow.language' in current && !['en', 'ru'].includes(current['focusflow.language']))
    throw new Error('Invalid language')
  const active = getActivePinia()
  const sandbox = createPinia()
  try {
    const access = useWorkspaceAccessStore(sandbox)
    access.status = 'owner'
    access.hydrating = true
    if (
      !useFocusHistoryStore(sandbox).restore(
        workspace.focus,
        workspace.tasks,
        workspace.timer.selectedId,
      ) ||
      current[PLAN_STORAGE_KEY]?.version !== 1 ||
      !usePlannerStore(sandbox).restore(current[PLAN_STORAGE_KEY])
    )
      throw new Error('Invalid history or planner')
  } finally {
    disposePinia(sandbox)
    setActivePinia(active)
  }
  if (!['1', '2'].includes(current[APPEARANCE_KEY])) throw new Error('Invalid theme')
  // Imported timers never start themselves or count time spent outside this app.
  if (workspace.timer.state === 'running') workspace.timer.state = 'paused'
  delete workspace.timer.deadline
  for (const session of workspace.focus.sessions) delete session.since
  return Object.fromEntries(
    workspaceKeys
      .filter((key) => key in current)
      .map((key) => [
        key,
        key === APPEARANCE_KEY || key === 'focusflow.language'
          ? current[key]
          : JSON.stringify(current[key]),
      ]),
  )
}
export function exportBackup(pinia: Pinia) {
  const archive = createEmergencyExport(pinia)
  archive.current['focusflow.language'] = localStorage.getItem('focusflow.language') ?? 'en'
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'focusflow-backup.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function replaceWorkspace(pinia: Pinia, replacement: Record<string, string> = {}) {
  const access = useWorkspaceAccessStore(pinia)
  if (!access.canEdit) throw new Error('Open the active workspace to change data')
  const original = workspaceKeys.map((key) => [key, localStorage.getItem(key)] as const)
  // Stop persistence before changing storage; the Web Lock stays held until reload.
  access.transition('cancelled')
  try {
    for (const key of workspaceKeys) {
      const value = replacement[key]
      if (value === undefined) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    }
  } catch (error) {
    for (const [key, value] of original) {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    }
    access.transition('owner')
    throw error
  }
  window.location.reload()
}
