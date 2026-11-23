import { test, expect, type BrowserContext } from '@playwright/test'
import {
  addTask,
  attackActions,
  instrument,
  lockName,
  oneOwner,
  stored,
  writable,
} from './browserHelpers'

const violations = new WeakMap<BrowserContext, string[]>()
test.beforeEach(async ({ context }) => {
  const errors: string[] = []
  violations.set(context, errors)
  for (const page of context.pages()) page.on('pageerror', (error) => errors.push(error.message))
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)))
  await instrument(context, errors)
})
test.afterEach(async ({ context }) => {
  expect(violations.get(context), 'No browser errors or ownership/hydration violations').toEqual([])
})

test('simultaneous tabs elect exactly one writer and block secondary mutations', async ({
  context,
}) => {
  const pages = await Promise.all([context.newPage(), context.newPage()])
  await Promise.all(pages.map((page) => page.goto('/')))
  const owner = await oneOwner(pages)
  const secondary = pages.find((page) => page !== owner)!
  await addTask(owner, 'Owner task')
  const before = await stored(owner)
  const blocked = await attackActions(secondary)
  expect(blocked.after).toBe(blocked.before)
  await expect(secondary.getByRole('button', { name: 'Create a task' })).toBeDisabled()
  await secondary.getByRole('button', { name: 'Planner', exact: true }).click()
  await expect(secondary.getByLabel('Time (min)')).toBeDisabled()
  await secondary.getByLabel('Time (min)').evaluate((input: HTMLInputElement) => {
    input.value = '99'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect(secondary.getByRole('button', { name: 'Plan session' })).toBeDisabled()
  expect(await stored(secondary)).toEqual(before)
  expect(await secondary.evaluate(() => window.workspaceAudit.writes)).toEqual([])
  expect(
    await owner.evaluate(
      async (name) =>
        (await navigator.locks.query()).held?.filter((lock) => lock.name === name).length,
      lockName,
    ),
  ).toBe(1)
})

test('owner close reloads all latest keys before the waiting tab enables editing', async ({
  context,
}) => {
  const owner = await context.newPage()
  await owner.goto('/')
  await addTask(owner, 'Initial task')
  const waiting = await context.newPage()
  await waiting.goto('/')
  await oneOwner([owner, waiting])
  await addTask(owner, 'Latest task')
  await owner.getByRole('button', { name: 'Planner', exact: true }).click()
  await owner.getByLabel('Time (min)').fill('45')
  await owner.getByRole('checkbox').first().check()
  await owner.getByRole('button', { name: 'Plan session' }).click()
  await owner.getByRole('button', { name: 'Accept plan' }).click()
  await expect(owner.getByRole('heading', { name: 'Accepted session' })).toBeVisible()
  const latest = await stored(owner)
  await owner.close()
  await expect.poll(() => writable(waiting)).toBe(true)
  await expect(
    waiting.getByRole('button', { name: 'Focus on Latest task', exact: true }),
  ).toBeEnabled()
  const first = await waiting.evaluate(() => window.workspaceAudit.firstEditable)
  expect(first?.reads).toEqual(latest)
  expect(first?.titles).toEqual(['Initial task', 'Latest task'])
  expect(await stored(waiting)).toEqual(latest)
  await waiting.getByRole('button', { name: 'Planner', exact: true }).click()
  await expect(waiting.getByRole('heading', { name: 'Accepted session' })).toBeVisible()
  await waiting.getByRole('button', { name: 'Close Planner' }).click()
  await addTask(waiting, 'After takeover')
  expect(JSON.parse((await stored(waiting)).focusflow!).tasks).toHaveLength(3)
  expect(
    JSON.parse((await stored(waiting))['focusflow-memory']!).entries.map(
      (entry: { title: string }) => entry.title,
    ),
  ).toEqual(['Initial task', 'Latest task', 'After takeover'])
})

test('owner reload transfers safely and preserves edits from both owners', async ({ context }) => {
  const a = await context.newPage()
  await a.goto('/')
  await addTask(a, 'Before reload')
  const b = await context.newPage()
  await b.goto('/')
  await oneOwner([a, b])
  await a.reload()
  const next = await oneOwner([a, b])
  await expect(
    next.getByRole('button', { name: 'Focus on Before reload', exact: true }),
  ).toBeEnabled()
  await addTask(next, 'After reload')
  const other = next === a ? b : a
  await next.close()
  await expect.poll(() => writable(other)).toBe(true)
  await expect(
    other.getByRole('button', { name: 'Focus on After reload', exact: true }),
  ).toBeEnabled()
  expect(
    JSON.parse((await stored(other)).focusflow!).tasks.map((task: { title: string }) => task.title),
  ).toEqual(['Before reload', 'After reload'])
})

test('rapid navigation and repeated tab creation retain one writer', async ({ context }) => {
  const owner = await context.newPage()
  await owner.goto('/')
  await addTask(owner, 'Keep me')
  for (let round = 0; round < 3; round++) {
    const peers = await Promise.all([context.newPage(), context.newPage(), context.newPage()])
    await Promise.all(peers.map((page) => page.goto('/')))
    expect(await oneOwner([owner, ...peers])).toBe(owner)
    await Promise.all(
      peers.map(async (page) => {
        await page.goto('about:blank')
        await page.goBack()
        await expect(page.locator('.access-notice')).toContainText('Read-only')
      }),
    )
    expect(await oneOwner([owner, ...peers])).toBe(owner)
    await Promise.all(peers.map((page) => page.close()))
  }
  expect(JSON.parse((await stored(owner)).focusflow!).tasks[0].title).toBe('Keep me')
})

test('missing Web Locks fails closed without uncoordinated writes', async ({ context }) => {
  await context.addInitScript(() =>
    Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true }),
  )
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.locator('.access-notice')).toContainText('Web Locks support')
  await expect(page.getByRole('button', { name: 'Create a task' })).toBeDisabled()
  const blocked = await attackActions(page)
  expect(blocked.after).toBe(blocked.before)
  expect(await stored(page)).toEqual({
    focusflow: null,
    'focusflow-memory': null,
    'focusflow-plan': null,
  })
  expect(await page.evaluate(() => window.workspaceAudit.writes)).toEqual([])
})

test('task editing, reordering, timer pause/reload, completion and memory still work', async ({
  page,
}) => {
  // This long workflow checks persisted behavior, not transition timing. Exercise
  // the supported reduced-motion path so animation waits do not consume its budget.
  // Normal-motion onboarding and transitions remain covered by welcome.e2e.ts.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await addTask(page, 'First')
  await addTask(page, 'Second')
  await page.getByRole('button', { name: 'Edit First', exact: true }).click()
  await page.getByRole('textbox', { name: 'Task title', exact: true }).fill('Renamed')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await page
    .getByRole('button', { name: 'Reorder Second; use arrow keys', exact: true })
    .press('ArrowUp')
  await expect(page.locator('.select-task')).toHaveText(['Second', 'Renamed'])
  await page.getByRole('button', { name: 'Focus on Renamed', exact: true }).click()
  await page.getByRole('button', { name: 'Start or resume timer', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause timer', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Pause timer', exact: true }).click()
  const paused = JSON.parse((await stored(page)).focusflow!).timer
  expect(paused.state).toBe('paused')
  await page.reload()
  await page.getByRole('button', { name: 'Focus on Renamed', exact: true }).click()
  expect(JSON.parse((await stored(page)).focusflow!).timer).toEqual(paused)
  await page.getByRole('button', { name: '+5 min', exact: true }).click()
  expect(JSON.parse((await stored(page)).focusflow!).timer.remaining).toBe(
    paused.remaining + 300_000,
  )
  await page.getByRole('button', { name: 'Complete task and select next' }).click()
  await page.getByRole('button', { name: 'Open task panel' }).click()
  await expect(page.getByRole('checkbox', { name: 'Complete Renamed' })).toBeChecked()
  await page.getByRole('button', { name: 'Delete Second', exact: true }).click()
  await page.getByRole('button', { name: 'Add a task', exact: true }).click()
  await page.getByRole('button', { name: 'Remembered tasks', exact: true }).click()
  await page.getByRole('button', { name: 'Forget Second', exact: true }).click()
  expect(
    JSON.parse((await stored(page))['focusflow-memory']!).entries.map(
      (entry: { title: string }) => entry.title,
    ),
  ).not.toContain('Second')
})

test('secondary waiting UX and navigation handoff preserve saved data', async ({
  context,
}, testInfo) => {
  const a = await context.newPage()
  await a.goto('/')
  await addTask(a, 'Snapshot task')
  const b = await context.newPage()
  await b.goto('/')
  await expect(b.locator('.access-notice')).toBeVisible()
  // Phase B deliberately does not hydrate a new secondary without ownership.
  await expect(b.locator('.select-task')).toHaveCount(0)
  await b.screenshot({ path: testInfo.outputPath('secondary-ux.png') })
  // A real navigation releases ownership, then back navigation restores or reloads A.
  await a.goto('about:blank')
  await expect.poll(() => writable(b)).toBe(true)
  await a.goBack()
  await expect(a.locator('.access-notice')).toContainText('Read-only')
  const before = await stored(b)
  const blocked = await attackActions(a)
  expect(blocked.after).toBe(blocked.before)
  expect(await stored(a)).toEqual(before)
  await b.close()
  await expect.poll(() => writable(a)).toBe(true)
  await expect(a.getByRole('button', { name: 'Focus on Snapshot task', exact: true })).toBeEnabled()
})

test('a populated former owner cannot mutate or expire a timer after lifecycle release', async ({
  context,
}) => {
  const a = await context.newPage()
  await a.clock.install()
  await a.goto('/')
  await addTask(a, 'Active task')
  await addTask(a, 'Next task')
  await a.getByRole('button', { name: 'Focus on Active task', exact: true }).click()
  await a.getByRole('button', { name: 'Start or resume timer', exact: true }).click()
  await expect(a.getByRole('button', { name: 'Pause timer', exact: true })).toBeEnabled()
  const b = await context.newPage()
  await b.goto('/')
  await expect(b.locator('.access-notice')).toContainText('Read-only')
  // Exercise the real lifecycle handler without destroying the document's populated
  // stores. This supplements actual navigation tests; it is not a BFCache claim.
  await a.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
  )
  await expect.poll(() => writable(b)).toBe(true)
  await expect(a.locator('.access-notice')).toContainText('Read-only')
  await expect(a.locator('.drag-handle')).toHaveCount(2)
  for (const control of await a.locator('.tasks button, .tasks input').all()) {
    await expect(control).toBeDisabled()
  }
  // Playwright's clock is shared by the context. Pause the real owner so advancing
  // time only challenges the stale running session retained by the read-only tab.
  await b.getByRole('button', { name: 'Focus on Active task', exact: true }).click()
  await b.getByRole('button', { name: 'Pause timer', exact: true }).click()
  await b.getByRole('button', { name: 'Open task panel' }).click()
  const storedBefore = await stored(b)
  const writesBefore = await a.evaluate(() => [...window.workspaceAudit.writes])
  const first = await attackActions(a)
  expect(first.after).toBe(first.before)
  await a.clock.fastForward(30 * 60_000)
  const afterExpiry = await attackActions(a)
  expect(afterExpiry.before).toBe(first.before)
  expect(afterExpiry.after).toBe(first.before)
  expect(await stored(a)).toEqual(storedBefore)
  expect(await a.evaluate(() => window.workspaceAudit.writes)).toEqual(writesBefore)
  await b.getByRole('button', { name: 'Edit Next task', exact: true }).click()
  await b.getByRole('textbox', { name: 'Task title', exact: true }).fill('Latest task')
  await b.getByRole('button', { name: 'Save changes', exact: true }).click()
  await b.close()
  await a.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  )
  await expect.poll(() => writable(a)).toBe(true)
  await expect(a.getByRole('button', { name: 'Focus on Latest task', exact: true })).toBeEnabled()
})
