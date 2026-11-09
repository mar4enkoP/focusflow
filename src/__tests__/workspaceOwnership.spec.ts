import { expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { useWorkspaceAccessStore } from '../stores/workspaceAccess'
import {
  createWorkspaceOwnership,
  WORKSPACE_LOCK_NAME,
  type WorkspaceLockManager,
} from '../workspaceOwnership'

// A shared, queued exclusive lock service; each client below has its own Pinia.
function lockService() {
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

function client(locks: WorkspaceLockManager | undefined) {
  const access = useWorkspaceAccessStore(createPinia())
  return { access, ...createWorkspaceOwnership(access, () => locks) }
}

it('starts without ownership and makes repeated starts share one exclusive request', async () => {
  const locks = lockService()
  const tab = client(locks)
  expect(tab.access.status).toBe('idle')
  expect(tab.access.ownsLock).toBe(false)
  const lifetime = tab.start()
  expect(tab.start()).toBe(lifetime)
  expect(tab.access.status).toBe('waiting')
  await flushPromises()
  expect(tab.access.ownsLock).toBe(true)
  expect(locks.request).toHaveBeenCalledExactlyOnceWith(
    WORKSPACE_LOCK_NAME,
    { mode: 'exclusive', signal: expect.any(AbortSignal) },
    expect.any(Function),
  )
  await tab.dispose()
  expect(tab.access.ownsLock).toBe(false)
})

it('grants one concurrent client ownership and transfers it only after release', async () => {
  const locks = lockService()
  const a = client(locks)
  const b = client(locks)
  const c = client(locks)
  void a.start()
  void b.start()
  void c.start()
  await flushPromises()
  expect([a, b, c].map((tab) => tab.access.status)).toEqual(['owner', 'waiting', 'waiting'])
  const disposed = a.dispose()
  expect(a.access.ownsLock).toBe(false)
  await disposed
  await flushPromises()
  expect([a, b, c].map((tab) => tab.access.status)).toEqual(['disposed', 'owner', 'waiting'])
  await b.dispose()
  await flushPromises()
  expect(c.access.ownsLock).toBe(true)
  await c.dispose()
})

it('cancels a queued request without disturbing the owner or blocking later clients', async () => {
  const locks = lockService()
  const a = client(locks)
  const b = client(locks)
  const c = client(locks)
  void a.start()
  void b.start()
  void c.start()
  await flushPromises()
  await b.cancel()
  expect(b.access.status).toBe('cancelled')
  expect(b.access.error).toBe('')
  expect(a.access.ownsLock).toBe(true)
  await a.dispose()
  await flushPromises()
  expect(c.access.ownsLock).toBe(true)
  await b.start()
  expect(b.access.status).toBe('cancelled')
  await b.dispose()
  await c.dispose()
})

it('cancellation also releases an already held lock', async () => {
  const locks = lockService()
  const a = client(locks)
  const b = client(locks)
  void a.start()
  void b.start()
  await flushPromises()
  const cancelled = a.cancel()
  expect(a.access.ownsLock).toBe(false)
  await cancelled
  await flushPromises()
  expect(a.access.status).toBe('cancelled')
  expect(b.access.ownsLock).toBe(true)
  await a.dispose()
  await b.dispose()
})

it('disposal before startup is terminal and idempotent', async () => {
  const locks = lockService()
  const tab = client(locks)
  await tab.dispose()
  await tab.dispose()
  await tab.start()
  expect(tab.access.status).toBe('disposed')
  expect(locks.request).not.toHaveBeenCalled()
})

it('disposal immediately after start prevents requesting a lock', async () => {
  const locks = lockService()
  const tab = client(locks)
  void tab.start()
  await tab.dispose()
  expect(tab.access.status).toBe('disposed')
  expect(locks.request).not.toHaveBeenCalled()
})

it('ignores a late grant after a pending request has been disposed', async () => {
  let grant!: () => Promise<void>
  const tab = client({
    request: (name, options, callback) =>
      new Promise<void>((resolve, reject) => {
        grant = () => callback({ name, mode: options.mode }).then(resolve, reject)
      }),
  })
  void tab.start()
  await flushPromises()
  const disposed = tab.dispose()
  await grant()
  await disposed
  expect(tab.access.status).toBe('disposed')
  expect(tab.access.ownsLock).toBe(false)
})

it('fails closed when Web Locks is unsupported', async () => {
  const tab = client(undefined)
  await tab.start()
  expect(tab.access.status).toBe('unsupported')
  expect(tab.access.ownsLock).toBe(false)
  await tab.dispose()
})

it.each(['lookup', 'request', 'rejection'] as const)(
  'fails closed on a %s error without rejecting the lifecycle promise',
  async (failure) => {
    const access = useWorkspaceAccessStore(createPinia())
    const tab = createWorkspaceOwnership(access, () => {
      if (failure === 'lookup') throw new Error('Denied')
      return {
        request: () => {
          if (failure === 'request') throw new Error('Denied')
          return Promise.reject(new Error('Denied'))
        },
      }
    })
    await tab.start()
    expect(access.status).toBe('error')
    expect(access.ownsLock).toBe(false)
    expect(access.error).not.toBe('')
    await tab.dispose()
  },
)

it('revokes ownership if the lock request unexpectedly fails while held', async () => {
  let fail!: (reason: Error) => void
  let callbackDone!: Promise<void>
  const tab = client({
    request: (name, options, callback) => {
      callbackDone = callback({ name, mode: options.mode })
      return new Promise<void>((_resolve, reject) => {
        fail = reject
      })
    },
  })
  const lifetime = tab.start()
  await flushPromises()
  expect(tab.access.ownsLock).toBe(true)
  fail(new Error('Lock lost'))
  await lifetime
  await callbackDone
  expect(tab.access.status).toBe('error')
  expect(tab.access.ownsLock).toBe(false)
  await tab.dispose()
})
