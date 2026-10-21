import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paginateText, restorePage, restoreReadingPage, validProgress, chooseReadingProgress, expandReaderBook } from './reader.js'

test('empty content and short books', () => {
  assert.deepEqual(paginateText('  \n '), [])
  assert.deepEqual(paginateText('A short book.'), ['A short book.'])
})

test('long single-line PDF content is bounded without losing words', () => {
  const text = Array.from({ length: 2000 }, (_, i) => `word${i}`).join(' ')
  const pages = paginateText(text)
  assert.ok(pages.length > 1)
  assert.ok(pages.every((page) => page.length <= 1800))
  assert.equal(pages.join(' '), text)
})

test('paragraph boundaries and unbroken strings survive pagination', () => {
  assert.deepEqual(paginateText('first\nsecond'), ['first\n\nsecond'])
  const text = 'x'.repeat(4000)
  const pages = paginateText(text)
  assert.equal(pages.join(''), text)
  assert.ok(pages.every((page) => page.length <= 1800))
})

test('restore scales when pagination changes and clamps corrupt positions', () => {
  assert.equal(restorePage({ page: 5, total_pages: 11 }, 21), 10)
  assert.equal(restorePage({ page: 999 }, 10), 9)
  assert.equal(restorePage({ page: -1 }, 10), 0)
  assert.equal(restorePage({ page: 2.5 }, 10), 0)
  assert.equal(restorePage(null, 0), 0)
})

test('local progress must have a valid range and timestamp', () => {
  assert.equal(validProgress({ page: 0, total_pages: 1, updated_at_ms: 10 }), true)
  for (const value of [null, {}, { page: 2, total_pages: 2, updated_at_ms: 1 }, { page: 0, total_pages: 1, updated_at_ms: '10' }]) {
    assert.equal(validProgress(value), false)
  }
})

test('chapter anchors survive inserted chapters and direct links override resume', () => {
  const pages = [{ chapter_id: 10 }, { chapter_id: 10 }, { chapter_id: 20 }, { chapter_id: 20 }]
  assert.equal(restoreReadingPage({ page: 0, total_pages: 2, chapter_id: 20, chapter_page: 1 }, pages), 3)
  assert.equal(restoreReadingPage({ page: 3, total_pages: 4 }, pages, '10'), 0)
  assert.equal(restoreReadingPage({ chapter_id: 20, chapter_page: 99 }, pages), 3)
})

test('pending progress requires conflict resolution instead of comparing device clocks', () => {
  const remote = { page: 1, total_pages: 10, updated_at_ms: 100, revision: 5, mutation_id: 'server' }
  const local = { page: 8, total_pages: 10, updated_at_ms: 9007199254740000, base_revision: 2, pending: true, mutation_id: 'offline' }
  assert.equal(chooseReadingProgress(local, remote), local)
  assert.equal(chooseReadingProgress({ ...local, pending: false }, remote), remote)
  assert.equal(chooseReadingProgress({ ...local, mutation_id: 'server' }, remote), remote)
})

test('lazy chapters retain global positions without downloading every text', () => {
  const metadata = [{ id: 1, title: 'First', number: 1, page_count: 2, start_page: 0 }, { id: 2, title: 'Second', number: 2, page_count: 1, start_page: 2 }]
  const first = expandReaderBook({ is_story: true, chapters: metadata, pages: [{ text: 'A', chapter_id: 1 }, { text: 'B', chapter_id: 1 }] })
  assert.equal(first.pages.length, 3)
  assert.equal(first.pages[2].text, '')
  assert.equal(restoreReadingPage({ chapter_id: 2, chapter_page: 0 }, first.pages), 2)
  const next = expandReaderBook({ is_story: true, chapters: metadata, pages: [{ text: 'C', chapter_id: 2 }] }, first)
  assert.deepEqual(next.pages.map((page) => page.text), ['A', 'B', 'C'])
})
