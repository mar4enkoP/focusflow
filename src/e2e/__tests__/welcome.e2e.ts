import { expect, test } from '@playwright/test'

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
  { width: 900, height: 500 },
]) {
  test(`first task at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    const title = page.getByLabel('Task title', { exact: true })
    await expect(title).toBeEditable()
    const header = page.locator('header')
    const storageNotice = page.getByText('Saved on this device', { exact: true })
    const initialHeader = await header.boundingBox()
    const initialNotice = await storageNotice.boundingBox()
    await expect(page.locator('form')).toHaveClass(/is-compact/)
    await expect(page.getByLabel('Estimated minutes')).toBeHidden()
    await title.fill('Write the first page')
    const before = await title.boundingBox()
    await title.press('Enter')
    await expect(page.getByLabel('Estimated minutes')).toBeFocused()
    const after = await title.boundingBox()
    expect(after!.y).toBeLessThanOrEqual(before!.y - 50)
    await expect(title).toHaveValue('Write the first page')
    await expect(page.getByRole('button', { name: 'Add task', exact: true })).toBeInViewport()
    await page.getByLabel('Estimated minutes').fill('15')
    await page.getByRole('button', { name: 'Add task', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your tasks' })).toBeVisible()
    expect(await header.boundingBox()).toEqual(initialHeader)
    expect(await storageNotice.boundingBox()).toEqual(initialNotice)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Your tasks' })).toBeVisible()
    await expect(page.locator('.welcome-intro')).toHaveCount(0)
    expect(await header.boundingBox()).toEqual(initialHeader)
    expect(await storageNotice.boundingBox()).toEqual(initialNotice)
  })
}

test('reduced motion still reveals and focuses the form', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const title = page.getByLabel('Task title', { exact: true })
  await expect(title).toBeEditable()
  const light = page.locator('.focus-backdrop[data-mode="form"] .light-field')
  await expect(light).toBeVisible()
  const originalLight = await light.elementHandle()
  const compactShape = await light.locator(':scope > g').getAttribute('transform')
  await expect(page.locator('.welcome-intro .line-mask > span').first()).toHaveCSS(
    'animation-name',
    'none',
  )
  await title.fill('A calm start')
  await title.press('Enter')
  await expect(page.getByLabel('Estimated minutes')).toBeFocused()
  await expect(title).toHaveValue('A calm start')
  await expect(page.locator('.welcome-intro h1')).toHaveCount(0)
  const heading = page.locator('.screen-heading .heading-line-text')
  await expect(heading).toHaveText('Set up your first task.')
  await expect(heading).toHaveCSS('animation-name', 'none')
  await expect(heading).toHaveCSS('transition-duration', '0s')
  await expect(heading).toHaveCSS('transform', 'none')
  expect(await light.evaluate((element, original) => element === original, originalLight)).toBe(
    true,
  )
  await expect(light.locator(':scope > g')).not.toHaveAttribute('transform', compactShape!)
  // The SVG light is driven by requestAnimationFrame, not CSS animation-name.
  // Observe its actual rendered state across the transition's layout rechecks.
  const frames = await light.evaluate(async (element) => {
    const states = [element.innerHTML]
    for (let i = 0; i < 32; i++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      states.push(element.innerHTML)
    }
    return new Set(states).size
  })
  expect(frames).toBe(1)
  await expect(light.locator(':scope > g')).toHaveAttribute('opacity', '1')
})

test('only task rows scroll when the list exceeds the available height', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 500 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  for (let index = 0; index < 6; index++) {
    if (index) await page.getByRole('button', { name: 'Add a task', exact: true }).click()
    const title = page.getByLabel('Task title', { exact: true })
    await title.fill(`Task ${index + 1}`)
    if (!index) await title.press('Enter')
    await page.getByRole('button', { name: 'Add task', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your tasks' })).toBeVisible()
  }
  const rows = page.locator('.tasks')
  expect(await rows.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  await rows.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  expect(await rows.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  expect(
    await page.locator('main').evaluate((element) => element.scrollHeight <= element.clientHeight),
  ).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
  await expect(page.getByRole('button', { name: 'Start Focus', exact: true })).toBeInViewport()
})

test('inline completion accepts Tab and memory opens only from the field icon', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const title = page.getByLabel('Task title', { exact: true })
  await title.fill('Programming session')
  await title.press('Enter')
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  await page.getByRole('button', { name: 'Add a task', exact: true }).click()
  await title.fill('Prog')
  await expect(page.locator('.ghost-title')).toHaveText('Programming session')
  await expect(page.getByRole('region', { name: 'Remembered tasks' })).toHaveCount(0)
  await title.press('Tab')
  await expect(title).toHaveValue('Programming session')
  await expect(title).toBeFocused()
  await expect(page.locator('.ghost-title')).toHaveCount(0)
  const memory = page.locator('.title-field').getByRole('button', { name: 'Remembered tasks' })
  await memory.click()
  await expect(page.getByRole('region', { name: 'Remembered tasks' })).toBeVisible()
  await page.getByRole('button', { name: 'Programming session', exact: true }).click()
  await expect(title).toBeFocused()
  await expect(page.getByRole('region', { name: 'Remembered tasks' })).toHaveCount(0)
})

test('remembered tasks stay open while deleting several entries', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  for (const name of ['First remembered', 'Second remembered']) {
    const title = page.getByLabel('Task title', { exact: true })
    await title.fill(name)
    if (name === 'First remembered') await title.press('Enter')
    await page.getByRole('button', { name: 'Add task', exact: true }).click()
    await page.getByRole('button', { name: 'Add a task', exact: true }).click()
  }
  await page.getByRole('button', { name: 'Remembered tasks', exact: true }).click()
  const menu = page.getByRole('region', { name: 'Remembered tasks' })
  await menu.getByRole('button', { name: 'Forget First remembered', exact: true }).click()
  await expect(menu).toBeVisible()
  await menu.getByRole('button', { name: 'Forget Second remembered', exact: true }).click()
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('No remembered tasks.')
})
