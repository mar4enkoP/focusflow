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
    await expect(page.locator('form')).toHaveClass(/is-compact/)
    await expect(page.getByLabel('Estimated minutes')).toBeHidden()
    await title.fill('Write the first page')
    const before = await title.boundingBox()
    await title.press('Enter')
    await expect(page.getByLabel('Estimated minutes')).toBeFocused()
    const after = await title.boundingBox()
    expect(after!.y).toBeLessThan(before!.y - 50)
    await expect(title).toHaveValue('Write the first page')
    await expect(page.getByRole('button', { name: 'Add task', exact: true })).toBeInViewport()
    await page.getByLabel('Estimated minutes').fill('15')
    await page.getByRole('button', { name: 'Add task', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your tasks' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Your tasks' })).toBeVisible()
    await expect(page.locator('.welcome-intro')).toHaveCount(0)
  })
}

test('reduced motion still reveals and focuses the form', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const title = page.getByLabel('Task title', { exact: true })
  await expect(title).toBeEditable()
  await title.fill('A calm start')
  await title.press('Enter')
  await expect(page.getByLabel('Estimated minutes')).toBeFocused()
  await expect(page.locator('.welcome-light')).toHaveCSS('animation-name', 'none')
  await expect(page.locator('.line-mask > span').first()).toHaveCSS('animation-name', 'none')
})
