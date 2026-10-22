import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

test('portfolio screenshots from original demo data', async ({ page }) => {
  test.skip(process.env.BOOKAPP_CAPTURE_SCREENSHOTS !== '1', 'Explicit screenshot generation only')
  await page.setViewportSize({ width: 1440, height: 1000 })
  const directory = path.resolve(import.meta.dirname, '../../docs/images')
  await mkdir(directory, { recursive: true })
  await page.goto('/')
  await page.locator('#login-email').fill('reader@bookapp.vn')
  await page.locator('#login-password').fill('Reader@12345')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.locator('.book-card').first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(directory, 'home.png') })
  const catalog = (await (await page.request.get('/api/v1/books/catalog', { params: { search: 'Học một điều mới mỗi ngày' } })).json()).data
  await page.goto(`/read/${catalog.items[0].id}`)
  await expect(page.locator('.reading-selectable')).toBeVisible()
  await expect(page.locator('.reader-sync')).toContainText('Đã đồng bộ vị trí đọc')
  await page.screenshot({ path: path.join(directory, 'reader.png') })
  await page.goto('/stories')
  await expect(page.locator('.story-card').first()).toBeVisible()
  await page.screenshot({ path: path.join(directory, 'stories.png') })
  await page.request.post('/api/v1/auth/logout')
  await page.goto('/')
  await page.locator('#login-email').fill('admin@bookapp.vn')
  await page.locator('#login-password').fill('Admin@12345')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.locator('.admin-stat')).toHaveCount(4)
  await page.screenshot({ path: path.join(directory, 'admin.png') })
})
