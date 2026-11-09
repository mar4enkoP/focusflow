import { expect, type BrowserContext, type Page } from '@playwright/test'
import type { useTasksStore } from '../../stores/tasks'
import type { useTimerStore } from '../../stores/timer'
import type { useTaskMemoryStore } from '../../stores/taskMemory'
import type { usePlannerStore } from '../../stores/planner'

export const keys = ['focusflow', 'focusflow-memory', 'focusflow-plan']
export const lockName = 'focusflow-workspace-writer'
type Audit = {
  held: boolean
  reads: Record<string, string | null>
  writes: string[]
  firstEditable?: { reads: Record<string, string | null>; titles: string[] }
}
declare global {
  interface Window {
    workspaceAudit: Audit
    reportWorkspaceViolation: (message: string) => Promise<void>
  }
}

// Observe the real browser APIs before application startup. No application test hook.
export async function instrument(context: BrowserContext, violations: string[]) {
  await context.exposeBinding('reportWorkspaceViolation', (_source, message: string) => {
    violations.push(message)
  })
  await context.addInitScript(
    ({ keys, lockName, breakLocks }) => {
      const audit: Audit = { held: false, reads: {}, writes: [] }
      window.workspaceAudit = audit
      const report = (message: string) => void window.reportWorkspaceViolation(message)
      const get = Storage.prototype.getItem
      const set = Storage.prototype.setItem
      Storage.prototype.getItem = function (key) {
        const raw = get.call(this, key)
        if (this === localStorage && keys.includes(key) && audit.held) audit.reads[key] = raw
        return raw
      }
      Storage.prototype.setItem = function (key, value) {
        if (this === localStorage && keys.includes(key)) {
          audit.writes.push(key)
          if (!audit.held) report('Workspace write without a held Web Lock: ' + key)
          if (!keys.every((key) => key in audit.reads)) report('Write before three-key hydration')
        }
        return set.call(this, key, value)
      }
      if (navigator.locks) {
        const request = navigator.locks.request.bind(navigator.locks)
        Object.defineProperty(navigator.locks, 'request', {
          value: (name: string, options: LockOptions, callback: LockGrantedCallback<unknown>) => {
            // Deliberate test-only mutation: per-tab names destroy shared exclusion.
            const actualName = breakLocks ? name + crypto.randomUUID() : name
            return request(actualName, options, async (lock) => {
              if (name !== lockName || !lock) return callback(lock)
              audit.held = true
              audit.reads = {}
              audit.firstEditable = undefined
              try {
                return await callback(lock)
              } finally {
                audit.held = false
              }
            })
          },
        })
      }
      new MutationObserver(() => {
        const editable = document.querySelector(
          'button.primary:not([disabled]), .drag-handle:not([disabled])',
        )
        if (!editable) return
        if (!audit.held) report('Editing enabled without a held Web Lock')
        if (!keys.every((key) => key in audit.reads))
          report('Editing enabled before three-key hydration')
        audit.firstEditable ??= {
          reads: { ...audit.reads },
          titles: [...document.querySelectorAll('.select-task')].map((node) =>
            node.textContent!.trim(),
          ),
        }
      }).observe(document, { subtree: true, childList: true, attributes: true })
    },
    { keys, lockName, breakLocks: process.env.FOCUSFLOW_E2E_BREAK_LOCKS === '1' },
  )
}

export async function writable(page: Page) {
  return page
    .locator('button.primary:enabled, .drag-handle:enabled')
    .count()
    .then((count) => count > 0)
}

export async function oneOwner(pages: Page[]) {
  await expect
    .poll(async () => (await Promise.all(pages.map(writable))).filter(Boolean).length, {
      message: 'Exactly one tab must expose writable workspace controls',
    })
    .toBe(1)
  const states = await Promise.all(pages.map(writable))
  const owner = pages[states.indexOf(true)]!
  for (const secondary of pages.filter((page) => page !== owner)) {
    await expect(secondary.locator('.access-notice')).toContainText('Read-only')
  }
  return owner
}

export async function addTask(page: Page, title: string) {
  await expect.poll(() => writable(page)).toBe(true)
  await page.getByRole('link', { name: 'FocusFlow home' }).click()
  await expect(
    page
      .getByRole('combobox', { name: 'Task title' })
      .or(page.getByRole('button', { name: 'Add a task', exact: true }))
      .first(),
  ).toBeVisible()
  if (!(await page.getByRole('combobox', { name: 'Task title' }).isVisible())) {
    await page.getByRole('button', { name: 'Add a task', exact: true }).click()
  }
  await page.getByRole('combobox', { name: 'Task title' }).fill(title)
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  await expect(page.getByRole('button', { name: `Focus on ${title}`, exact: true })).toBeVisible()
}

export async function stored(page: Page) {
  return page.evaluate(
    (keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
    keys,
  )
}

// Test-only inspection of Vue's existing mounted-app/Pinia registry. This does not
// add a global hook to the production bundle or bypass any action guard.
export async function attackActions(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('#app') as Element & {
      __vue_app__: {
        config: {
          globalProperties: {
            $pinia: {
              _s: Map<string, unknown>
              state: { value: unknown }
            }
          }
        }
      }
    }
    const pinia = root.__vue_app__.config.globalProperties.$pinia
    const tasks = pinia._s.get('tasks') as ReturnType<typeof useTasksStore>
    const timer = pinia._s.get('timer') as ReturnType<typeof useTimerStore>
    const memory = pinia._s.get('taskMemory') as ReturnType<typeof useTaskMemoryStore>
    const planner = pinia._s.get('planner') as ReturnType<typeof usePlannerStore>
    const before = JSON.stringify(pinia.state.value)
    const task = tasks.tasks[0]
    const id = task?.id ?? 'missing'
    tasks.save({ title: 'Forbidden', duration: 5, category: 'Work' })
    tasks.remove(id)
    tasks.toggle(id)
    tasks.move(id, 1)
    tasks.reorder(id, tasks.tasks[1]?.id ?? 'missing', 'after')
    timer.select(id)
    timer.start()
    timer.pause()
    timer.addTime()
    timer.complete()
    timer.reset()
    timer.continueFocus()
    timer.sync()
    memory.remember({ title: 'Forbidden', duration: 5, category: 'Work' })
    memory.forget(task?.title ?? 'missing')
    planner.updateSettings({ minutes: 99, breakMinutes: 0, breakEvery: 1, selectedIds: [id] })
    planner.generate()
    planner.accept()
    planner.begin(id)
    planner.reject()
    document.dispatchEvent(new Event('visibilitychange'))
    return { before, after: JSON.stringify(pinia.state.value) }
  })
}
