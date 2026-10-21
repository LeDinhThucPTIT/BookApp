import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chapterDraftKey, readChapterDraft } from './drafts.js'

test('draft keys isolate accounts, books and chapters', () => {
  const keys = [chapterDraftKey(1, 1, 1), chapterDraftKey(2, 1, 1), chapterDraftKey(1, 2, 1), chapterDraftKey(1, 1, 2), chapterDraftKey(1, 1, null)]
  assert.equal(new Set(keys).size, 5)
})
test('valid drafts restore and invalid storage is ignored', () => {
  const draft = { number: 2, title: 'Chapter', content: 'Unpublished text' }
  assert.deepEqual(readChapterDraft({ getItem: () => JSON.stringify(draft) }, 'key'), draft)
  for (const value of ['{bad', 'null', '{"number":-1}', JSON.stringify({ ...draft, content: 123 })]) {
    assert.equal(readChapterDraft({ getItem: () => value }, 'key'), null)
  }
  assert.equal(readChapterDraft({ getItem() { throw Error('blocked') } }, 'key'), null)
})
