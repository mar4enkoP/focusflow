import { watch } from 'vue'
import type { Pinia } from 'pinia'
import { installPersistence } from './persistence'
import { useWorkspaceAccessStore } from './stores/workspaceAccess'
import { createWorkspaceOwnership, type WorkspaceLockManager } from './workspaceOwnership'

// All writes remain disabled until installPersistence hydrates under ownership.
export function startWorkspace(
  pinia: Pinia,
  getLocks?: () => WorkspaceLockManager | undefined,
  lifecycle: EventTarget = window,
) {
  const access = useWorkspaceAccessStore(pinia)
  const stopPersistence = installPersistence(pinia)
  let coordinator = createWorkspaceOwnership(access, getLocks)
  let hidden = false
  let disposed = false
  let epoch = 0
  const stopErrors = watch(
    () => access.status,
    (status) => {
      if (status === 'error') void coordinator.cancel()
    },
    { flush: 'post' },
  )
  function hide() {
    epoch += 1
    hidden = true
    void coordinator.dispose()
  }
  async function show() {
    if (!hidden || disposed) return
    hidden = false
    const current = ++epoch
    await coordinator.dispose()
    if (disposed || hidden || current !== epoch) return
    coordinator = createWorkspaceOwnership(access, getLocks)
    void coordinator.start()
  }
  lifecycle.addEventListener('pagehide', hide)
  lifecycle.addEventListener('pageshow', show)
  void coordinator.start()
  return async () => {
    disposed = true
    lifecycle.removeEventListener('pagehide', hide)
    lifecycle.removeEventListener('pageshow', show)
    stopErrors()
    const released = coordinator.dispose()
    stopPersistence()
    await released
  }
}
