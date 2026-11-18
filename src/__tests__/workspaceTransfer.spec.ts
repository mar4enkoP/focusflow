import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { createOwnedPinia } from './workspaceTestUtils'
import { useTasksStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useWorkspaceAccessStore } from '@/stores/workspaceAccess'
import { createEmergencyExport } from '@/emergencyExport'
import { readBackup, replaceWorkspace } from '@/workspaceTransfer'
import { STORAGE_KEY } from '@/persistence'

beforeEach(() => setActivePinia(createOwnedPinia()))
describe('workspace backups', () => {
  function example() {
    const pinia = createOwnedPinia()
    setActivePinia(pinia)
    const tasks = useTasksStore(pinia)
    tasks.save({ title: 'Work', duration: 25, category: 'Work' })
    const timer = useTimerStore(pinia)
    timer.select(tasks.tasks[0]!.id)
    timer.start()
    return { pinia, archive: createEmergencyExport(pinia), tasks, timer }
  }
  it('validates a complete export without changing live data and imports timers paused', () => {
    const { archive, tasks, timer } = example()
    const before = timer.snapshot()
    const backup = readBackup(JSON.stringify(archive))
    const restored = JSON.parse(backup[STORAGE_KEY]!)
    expect(restored.tasks).toEqual(tasks.tasks)
    expect(restored.timer.state).toBe('paused')
    expect(restored.timer.deadline).toBeUndefined()
    expect(restored.focus.sessions.every((s: { since?: number }) => s.since === undefined)).toBe(
      true,
    )
    expect(timer.snapshot()).toEqual(before)
  })
  it('rejects damaged tasks, history, memory, planner and theme before any writes', () => {
    const { archive } = example()
    for (const key of Object.keys(archive.current)) {
      const damaged = structuredClone(archive)
      damaged.current[key] = null
      expect(() => readBackup(JSON.stringify(damaged))).toThrow(/Invalid/)
    }
    expect(() => readBackup('{')).toThrow(SyntaxError)
  })
  it('blocks reset and import in a non-owner tab', () => {
    const { pinia } = example()
    useWorkspaceAccessStore(pinia).transition('waiting')
    const remove = vi.spyOn(Storage.prototype, 'removeItem')
    expect(() => replaceWorkspace(pinia)).toThrow('Open the active workspace')
    expect(remove).not.toHaveBeenCalled()
    remove.mockRestore()
  })
})
