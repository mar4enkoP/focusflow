import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { STORAGE_KEY } from '../../persistence'
import { addTask } from './browserHelpers'

test('themes unlock only after the first task is saved', async ({ page }) => {
  await page.goto('/')
  const settings = page.getByRole('button', { name: 'Settings', exact: true })
  const ember = page.getByRole('radio', { name: 'Ember', exact: true })
  await settings.click()
  await expect(ember).toBeDisabled()
  await expect(page.getByText('Finish creating your first task to unlock themes.')).toBeVisible()
  await page.keyboard.press('Escape')
  const title = page.getByRole('textbox', { name: 'Task title', exact: true })
  await title.fill('Unlock appearance')
  await title.press('Enter')
  await expect(page.getByRole('spinbutton', { name: 'Estimated minutes' })).toBeFocused()
  await settings.click()
  await expect(ember).toBeDisabled()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Focus on Unlock appearance' })).toBeVisible()
  await settings.click()
  await expect(ember).toBeEnabled()
  await ember.check()
  await page.reload()
  await settings.click()
  await expect(ember).toBeEnabled()
  await expect(ember).toBeChecked()
})

test('backup import validates files and destructive actions require confirmation', async ({
  page,
}) => {
  await page.goto('/')
  await addTask(page, 'Original workspace')
  async function openData() {
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('button', { name: 'Data & recovery', exact: true }).click()
  }
  await openData()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export recovery JSON' }).click()
  const archive = await readFile((await (await download).path())!)
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{}') })
  await expect(
    page.getByRole('status').filter({ hasText: 'not a valid FocusFlow backup' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Reset workspace' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: archive })
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: 'Import backup', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Focus on Original workspace', exact: true }),
  ).toBeVisible()
  await openData()
  await page.getByRole('button', { name: 'Reset workspace' }).click()
  await page.getByRole('button', { name: 'Reset everything', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Task title' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('focusflow'))).toBeNull()
})

test('language switches the interface and persists without translating task titles', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await addTask(page, 'Work')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Language', exact: true }).click()
  await page.getByRole('button', { name: 'Русский', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Настройки', exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await page.screenshot({ path: testInfo.outputPath('russian-settings.png') })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Ваши задачи', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Изменить: Work', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Название задачи' })).toHaveValue('Work')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await expect(page.getByRole('button', { name: 'Настройки', exact: true })).toBeVisible()
})

for (const width of [1440, 390]) {
  test(`settings preserve themes, export data and return to tasks at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await addTask(page, 'Keep my workspace')
    await expect(page.getByRole('button', { name: 'Export recovery JSON' })).toHaveCount(0)
    const opener = page.getByRole('button', { name: 'Settings', exact: true })
    await opener.click()
    const dialog = page.getByRole('dialog', { name: 'Settings', exact: true })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('radio', { name: 'Ember' }).check()
    await expect(dialog.getByRole('radio', { name: 'Ember' })).toBeChecked()
    await dialog.getByRole('radio', { name: 'Classic' }).check()
    await page.screenshot({ path: testInfo.outputPath('appearance.png') })
    await dialog.getByRole('button', { name: 'Data & recovery' }).click()
    const exportButton = dialog.getByRole('button', { name: 'Export recovery JSON' })
    await expect(exportButton).toBeVisible()
    const download = page.waitForEvent('download')
    await exportButton.click()
    const file = await (await download).path()
    const archive = JSON.parse(await readFile(file!, 'utf8'))
    expect(archive.format).toBe('focusflow-recovery')
    expect(archive.current[STORAGE_KEY].tasks).toEqual([
      expect.objectContaining({ title: 'Keep my workspace' }),
    ])
    await page.screenshot({ path: testInfo.outputPath('recovery.png') })
    const bounds = await dialog.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    await expect(
      page.getByRole('button', { name: 'Focus on Keep my workspace', exact: true }),
    ).toBeVisible()
    await page.reload()
    await opener.click()
    await expect(page.getByRole('radio', { name: 'Classic' })).toBeChecked()
  })
}
