export const chapterDraftKey = (userId, bookId, chapterId) => `bookapp_draft_${userId}_${bookId}_${chapterId || 'new'}`

export function readChapterDraft(storage, key) {
  try {
    const saved = JSON.parse(storage.getItem(key))
    if (saved && Number.isInteger(saved.number) && saved.number > 0 && saved.number <= 100000 &&
      typeof saved.title === 'string' && saved.title.length <= 255 &&
      typeof saved.content === 'string' && saved.content.length <= 60000) return saved
  } catch { /* Ignore corrupt/unavailable storage. */ }
  return null
}
