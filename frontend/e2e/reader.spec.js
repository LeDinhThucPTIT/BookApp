import { test as base, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const test = base.extend({
  reader: async ({ page }, provide) => {
    const suffix = randomUUID().slice(0, 8)
    const email = `e2e-${suffix}@example.com`
    const password = 'Reader-test-12345'
    const registered = await page.request.post('/api/v1/auth/register', { data: { username: `Reader ${suffix}`, email, password } })
    expect(registered.status()).toBe(201)
    await page.goto('/')
    await page.locator('#login-email').fill(email)
    await page.locator('#login-password').fill(password)
    const login = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/login') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    const token = (await (await login).json()).data.access_token
    await expect(page).toHaveURL(/\/home$/)
    const story = await page.request.post('/api/v1/stories', { data: { title: `Browser story ${suffix}`, author: 'E2E Author' } })
    expect(story.status()).toBe(201)
    const bookId = (await story.json()).data.id
    const content = 'A reader follows the river and discovers a quiet village. '.repeat(100)
    const chapter = await page.request.post(`/api/v1/stories/${bookId}/chapters`, { data: { number: 1, title: 'The river', content } })
    expect(chapter.status()).toBe(201)
    await provide({ bookId, token })
    // These tests are intended for the isolated database runner. Also clean up if run manually.
    await page.request.delete(`/api/v1/books/${bookId}`)
  },
})

async function openReader(page, bookId) {
  await page.goto(`/read/${bookId}`)
  await expect(page.locator('.reading-selectable')).toContainText('A reader follows')
  await expect(page.locator('.reader-sync')).toContainText('Đã đồng bộ vị trí đọc')
}

test('cookie session survives reload, blocks admin and revokes the bearer token on logout', async ({ page, context, reader }) => {
  expect(await page.evaluate(() => localStorage.getItem('bookapp_token'))).toBeNull()
  expect((await context.cookies()).find((cookie) => cookie.name === 'access_token')?.httpOnly).toBe(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'MỚI NHẤT' })).toBeVisible()
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/home$/)
  await page.goto('/setting')
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  const response = await page.request.get('/api/v1/auth/me', { headers: { Authorization: `Bearer ${reader.token}` } })
  expect(response.status()).toBe(401)
})

test('reading progress resumes after a full reload', async ({ page, reader }) => {
  await openReader(page, reader.bookId)
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.locator('.current-page')).toHaveText('Trang 2')
  await expect.poll(async () => (await (await page.request.get(`/api/v1/books/${reader.bookId}/progress`)).json()).data?.page).toBe(1)
  await page.reload()
  await expect(page.locator('.current-page')).toHaveText('Trang 2')
})

test('a selected quote and note persist after reload', async ({ page, reader }) => {
  await openReader(page, reader.bookId)
  await page.locator('.reading-selectable').evaluate((element) => {
    const node = element.querySelector('span').firstChild
    const range = document.createRange()
    range.setStart(node, 0)
    range.setEnd(node, 8)
    window.getSelection().removeAllRanges()
    window.getSelection().addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
  await page.getByLabel('Ghi chú của bạn').fill('A note saved from the browser')
  await page.getByRole('button', { name: 'Lưu tô sáng / ghi chú', exact: true }).click()
  await expect(page.locator('.reading-mark')).toHaveText('A reader')
  await page.reload()
  await expect(page.locator('.reading-mark')).toHaveText('A reader')
  await page.locator('summary').filter({ hasText: 'Ghi chú' }).click()
  await expect(page.getByText('A note saved from the browser', { exact: true })).toBeVisible()
})

test('two reading sessions require an explicit choice before replacing a newer position', async ({ page, browser, context, reader }) => {
  await openReader(page, reader.bookId)
  const otherContext = await browser.newContext()
  try {
    await otherContext.addCookies(await context.cookies())
    const otherPage = await otherContext.newPage()
    await openReader(otherPage, reader.bookId)
    const initial = (await (await page.request.get(`/api/v1/books/${reader.bookId}/progress`)).json()).data
    await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
    await expect.poll(async () => (await (await page.request.get(`/api/v1/books/${reader.bookId}/progress`)).json()).data?.revision).toBe(initial.revision + 1)
    await otherPage.getByRole('button', { name: 'Trang sau', exact: true }).click()
    await expect(otherPage.getByRole('button', { name: 'Giữ vị trí đang đọc', exact: true })).toBeVisible()
    expect((await (await page.request.get(`/api/v1/books/${reader.bookId}/progress`)).json()).data.revision).toBe(initial.revision + 1)
    await otherPage.getByRole('button', { name: 'Giữ vị trí đang đọc', exact: true }).click()
    await expect(otherPage.locator('.reader-sync')).toContainText('Đã đồng bộ vị trí đọc')
    await expect.poll(async () => (await (await page.request.get(`/api/v1/books/${reader.bookId}/progress`)).json()).data?.revision).toBe(initial.revision + 2)
  } finally {
    await otherContext.close()
  }
})

test('catalog searches on the server and exposes the created story', async ({ page, reader }) => {
  const detail = (await (await page.request.get(`/api/v1/books/${reader.bookId}`)).json()).data
  await page.goto('/home')
  await page.getByRole('textbox', { name: 'Tìm sách theo tên hoặc tác giả' }).fill(detail.title)
  await expect(page.getByRole('heading', { name: `Kết quả tìm kiếm: ${detail.title}` })).toBeVisible()
  await expect(page.locator('.search-results')).toContainText(detail.title)
  await expect(page.locator('.search-results a').first()).toHaveAttribute('href', `/book/${reader.bookId}`)
})

test('library removal and comment pagination work through the UI', async ({ page, reader }) => {
  const saved = await page.request.post(`/api/v1/books/${reader.bookId}/save`)
  expect(saved.ok()).toBe(true)
  await page.goto('/save')
  await expect(page.locator('.book-save')).toHaveCount(1)
  await page.getByRole('button', { name: /^Bỏ lưu:/ }).click()
  await expect(page.getByText('Bạn chưa lưu hoặc yêu thích quyển sách nào.', { exact: true })).toBeVisible()
  for (let i = 1; i <= 22; i++) {
    const response = await page.request.post(`/api/v1/books/${reader.bookId}/comments`, { data: { content: `Reader comment ${i}` } })
    expect(response.status()).toBe(201)
  }
  await page.goto(`/book/${reader.bookId}`)
  await expect(page.locator('.comment-item')).toHaveCount(20)
  await page.getByRole('button', { name: 'Xem thêm bình luận', exact: true }).click()
  await expect(page.locator('.comment-item')).toHaveCount(22)
  await expect(page.getByRole('button', { name: 'Xem thêm bình luận', exact: true })).toHaveCount(0)
})
