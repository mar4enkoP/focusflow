import type { useWorkspaceAccessStore } from './stores/workspaceAccess'

// Keep this name stable across application versions and all workspace keys.
export const WORKSPACE_LOCK_NAME = 'focusflow-workspace-writer'

export interface WorkspaceLockManager {
  request(
    name: string,
    options: { mode: 'exclusive'; signal: AbortSignal },
    callback: (lock: Lock | null) => Promise<void>,
  ): Promise<void>
}

function browserLocks(): WorkspaceLockManager | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.locks
}

// Create one coordinator per access store/application instance. It is single-use:
// cancel/dispose are terminal; a later lifecycle needs a fresh coordinator.
export function createWorkspaceOwnership(
  access: ReturnType<typeof useWorkspaceAccessStore>,
  getLocks: () => WorkspaceLockManager | undefined = browserLocks,
) {
  const controller = new AbortController()
  let stopped = false
  let lifetime: Promise<void> | undefined
  let release: (() => void) | undefined

  async function acquire() {
    try {
      if (stopped) return
      const locks = getLocks()
      if (!locks) {
        access.transition('unsupported')
        return
      }
      await locks.request(
        WORKSPACE_LOCK_NAME,
        { mode: 'exclusive', signal: controller.signal },
        async (lock) => {
          // Cancellation may race with a callback already scheduled by the browser.
          if (stopped) return
          if (!lock) throw new Error('Workspace lock was not granted.')
          const held = new Promise<void>((resolve) => {
            release = resolve
          })
          access.transition('owner')
          await held
        },
      )
      if (!stopped) access.transition('error', 'Workspace ownership ended unexpectedly.')
    } catch {
      if (!stopped) access.transition('error', 'Could not acquire or retain workspace ownership.')
    } finally {
      release?.()
      release = undefined
    }
  }

  // Resolves when the request/ownership lifetime ends, not when ownership begins.
  function start(): Promise<void> {
    if (lifetime) return lifetime
    if (stopped) return Promise.resolve()
    // Assign before notifying reactive consumers so repeated starts are idempotent.
    lifetime = Promise.resolve().then(acquire)
    access.transition('waiting')
    return lifetime
  }

  function stop(status: 'cancelled' | 'disposed'): Promise<void> {
    if (!stopped) {
      stopped = true
      // Revoke local ownership before allowing another tab to acquire the lock.
      if (status === 'disposed' || access.status !== 'error') access.transition(status)
      controller.abort()
      // Aborting only cancels pending requests; a held lock needs its callback resolved.
      release?.()
    } else if (status === 'disposed') access.transition('disposed')
    return lifetime ?? Promise.resolve()
  }

  return { start, cancel: () => stop('cancelled'), dispose: () => stop('disposed') }
}
