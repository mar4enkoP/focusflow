import type { Pinia } from 'pinia'
import { useTasksStore } from './stores/tasks'
import { useTimerStore } from './stores/timer'
import { useFocusHistoryStore } from './stores/focusHistory'
import { useTaskMemoryStore } from './stores/taskMemory'
import { usePlannerStore } from './stores/planner'
import { useAppearanceStore, APPEARANCE_KEY } from './stores/appearance'
import { STORAGE_KEY, MEMORY_STORAGE_KEY, PLAN_STORAGE_KEY } from './persistence'

// A recovery archive is NOT an importable/validated workspace snapshot. Include
// exact stored strings separately so damaged/legacy data is never misrepresented.
export function createEmergencyExport(pinia: Pinia) {
  const warnings = [
    'Recovery archive: contents may be incomplete or damaged. Review before restoring.',
  ]
  const current: Record<string, unknown> = {}
  const capture = (key: string, read: () => unknown) => {
    try {
      current[key] = JSON.parse(JSON.stringify(read()))
    } catch {
      warnings.push('Could not capture current ' + key)
    }
  }
  capture(STORAGE_KEY, () => ({
    version: 2,
    tasks: useTasksStore(pinia).tasks,
    timer: useTimerStore(pinia).snapshot(),
    focus: useFocusHistoryStore(pinia).snapshot(),
  }))
  capture(MEMORY_STORAGE_KEY, () => ({ version: 1, entries: useTaskMemoryStore(pinia).entries }))
  capture(PLAN_STORAGE_KEY, () => ({ version: 1, ...usePlannerStore(pinia).snapshot() }))
  capture(APPEARANCE_KEY, () => useAppearanceStore(pinia).theme)
  const stored: Record<string, string | null> = {}
  for (const key of [STORAGE_KEY, MEMORY_STORAGE_KEY, PLAN_STORAGE_KEY, APPEARANCE_KEY]) {
    try {
      stored[key] = localStorage.getItem(key)
    } catch {
      warnings.push('Could not read stored ' + key)
    }
  }
  return {
    format: 'focusflow-recovery',
    version: 1,
    exportedAt: new Date().toISOString(),
    validated: false,
    warnings,
    current,
    stored,
  }
}

export function downloadEmergencyExport(pinia: Pinia) {
  const blob = new Blob([JSON.stringify(createEmergencyExport(pinia), null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'focusflow-recovery.json'
  document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
    // Let the browser consume the Blob before revoking it, without a long-lived URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
