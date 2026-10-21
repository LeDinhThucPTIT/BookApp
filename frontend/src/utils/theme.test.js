import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyTheme, readTheme, THEME_KEY } from './theme.js'

function storage(seed = {}) {
  const values = new Map(Object.entries(seed))
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}

test('theme survives a fresh application load', () => {
  const saved = storage()
  const root = { dataset: {}, style: {} }
  applyTheme('dark', root, saved)
  assert.equal(root.dataset.theme, 'dark')
  assert.equal(root.style.colorScheme, 'dark')
  assert.equal(readTheme(saved), 'dark')
  applyTheme('light', root, saved)
  assert.equal(readTheme(saved), 'light')
  assert.equal(root.style.colorScheme, 'light')
})

test('existing reader preference migrates, while app preference takes priority', () => {
  assert.equal(readTheme(storage({ bookapp_reader_settings: '{"theme":"dark"}' })), 'dark')
  assert.equal(readTheme(storage({ [THEME_KEY]: 'light', bookapp_reader_settings: '{"theme":"dark"}' })), 'light')
})

test('invalid preferences and blocked storage have a safe fallback', () => {
  assert.equal(readTheme(storage({ [THEME_KEY]: 'invalid', bookapp_reader_settings: '{bad' })), 'light')
  const blocked = { getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') } }
  assert.equal(readTheme(blocked), 'light')
  const root = { dataset: {}, style: {} }
  applyTheme('dark', root, blocked)
  assert.equal(root.dataset.theme, 'dark')
  applyTheme('invalid', root, blocked)
  assert.equal(root.dataset.theme, 'dark')
})
