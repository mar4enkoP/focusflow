import { vi } from 'vitest'
import type { WorkspaceLockManager } from '../workspaceOwnership'
import { createPinia } from 'pinia'
import { useWorkspaceAccessStore } from '../stores/workspaceAccess'

// Domain tests model an already acquired workspace (or a fresh owner after reload).
// Concurrency tests use real coordinators and separate, initially read-only Pinia instances.
export function createOwnedPinia() {
  const pinia = createPinia()
  const access = useWorkspaceAccessStore(pinia)
  access.transition('owner')
  access.hydrated = true
  return pinia
}

// A shared, queued exclusive lock service; each client below has its own Pinia.
export function lockService() {
  const queue: Array<() => void> = []
  let held = false
  const pump = () => {
    if (!held) queue.shift()?.()
  }
  const request = vi.fn<WorkspaceLockManager['request']>((name, options, callback) => {
    return new Promise<void>((resolve, reject) => {
      const abort = () => {
        const index = queue.indexOf(grant)
        if (index >= 0) queue.splice(index, 1)
        reject(new DOMException('Cancelled', 'AbortError'))
      }
      const grant = () => {
        options.signal.removeEventListener('abort', abort)
        held = true
        void Promise.resolve()
          .then(() => callback({ name, mode: options.mode }))
          .then(resolve, reject)
          .finally(() => {
            held = false
            pump()
          })
      }
      if (options.signal.aborted) {
        abort()
        return
      }
      options.signal.addEventListener('abort', abort, { once: true })
      queue.push(grant)
      queueMicrotask(pump)
    })
  })
  return { request }
}
