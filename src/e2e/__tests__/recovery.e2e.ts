import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { addTask } from './browserHelpers'

test('production CSP blocks injected script and preserves menus, themes and task text', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { cspViolations: [] })
    document.addEventListener('securitypolicyviolation', (event) => {
      ;(window as unknown as { cspViolations: string[] }).cspViolations.push(
        event.effectiveDirective,
      )
    })
  })
  await page.goto('/')
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
    'content',
    /script-src 'self'/,
  )
  await addTask(page, '<img src=x onerror=alert(1)>')
  await page.getByRole('button', { name: 'Add a task', exact: true }).click()
  await page.locator('#task-category').click()
  await expect(page.locator('#category-options')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.locator('input[name="light-theme"][value="1"]').check()
  await expect(page.locator('input[name="light-theme"][value="1"]')).toBeChecked()
  expect(await page.evaluate(() => localStorage.getItem('focusflow.appearance.v1'))).toBe('1')
  expect(
    await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations),
  ).toEqual([])
  await page.evaluate(() => {
    const script = document.createElement('script')
    script.textContent = 'window.injected = true'
    document.head.append(script)
  })
  expect(
    await page.evaluate(() => (window as unknown as { injected?: boolean }).injected),
  ).toBeUndefined()
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations),
    )
    .toContain('script-src-elem')
})

test('undo preserves task identity and order; reload commits deletion without stale undo', async ({
  page,
}) => {
  await page.goto('/')
  await addTask(page, 'First')
  await addTask(page, 'Second')
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('focusflow')!).tasks)
  await page.getByRole('button', { name: 'Delete First', exact: true }).click()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('focusflow')!).tasks)).toEqual(
    before,
  )
  await page.getByRole('button', { name: 'Delete First', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Focus on Second', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Focus on First', exact: true })).toHaveCount(0)
})

test('quota failure and unhandled rejection leave recovery export available and stored data intact', async ({
  page,
}) => {
  await page.goto('/')
  await addTask(page, 'Saved')
  const stored = await page.evaluate(() => localStorage.getItem('focusflow'))
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError')
    }
  })
  await addTask(page, 'Unsaved')
  await expect(
    page.getByText('Could not save on this device. Changes stay in this visit.', { exact: true }),
  ).toBeVisible()
  await page.evaluate(() => {
    void Promise.reject(new Error('regression rejection'))
  })
  await expect(
    page.getByRole('heading', { name: 'FocusFlow could not display this workspace' }),
  ).toBeVisible()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export recovery JSON' }).click()
  const path = await (await downloaded).path()
  expect(path).not.toBeNull()
  const archive = JSON.parse(await readFile(path!, 'utf8'))
  expect(archive.validated).toBe(false)
  expect(archive.current.focusflow.tasks.map((task: { title: string }) => task.title)).toEqual([
    'Saved',
    'Unsaved',
  ])
  expect(archive.stored.focusflow).toBe(stored)
  await page.getByRole('button', { name: 'Reopen interface' }).click()
  await expect(page.getByRole('button', { name: 'Focus on Unsaved', exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('focusflow'))).toBe(stored)
})
