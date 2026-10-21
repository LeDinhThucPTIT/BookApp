// Stable pagination independent of screen size. Preserve paragraphs and split
// long PDF lines on word boundaries so a single line cannot become a huge page.
export function paginateText(text, limit = 1800) {
  const normalized = text.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return []
  const pages = []
  let page = ''
  for (const paragraph of normalized.split(/\n+/).filter((part) => part.trim())) {
    for (const word of paragraph.trim().split(/\s+/)) {
      // Handle very long unbroken strings too.
      for (let start = 0; start < word.length; start += limit) {
        const chunk = word.slice(start, start + limit)
        const separator = page && !page.endsWith('\n\n') ? ' ' : ''
        if (page.length + separator.length + chunk.length > limit) {
          pages.push(page.trim())
          page = ''
        }
        page += (page && !page.endsWith('\n\n') ? ' ' : '') + chunk
      }
    }
    if (page) page += '\n\n'
  }
  if (page.trim()) pages.push(page.trim())
  return pages
}

export function restorePage(progress, total) {
  if (!Number.isInteger(progress?.page) || progress.page < 0 || total < 1) return 0
  const page = progress.total_pages > 1 && progress.total_pages !== total
    ? Math.round((progress.page / (progress.total_pages - 1)) * (total - 1))
    : progress.page
  return Math.max(0, Math.min(total - 1, page))
}

export function validProgress(value) {
  return Number.isInteger(value?.page) && value.page >= 0 &&
    Number.isInteger(value?.total_pages) && value.total_pages > value.page &&
    Number.isSafeInteger(value?.updated_at_ms) && value.updated_at_ms > 0
}

export function restoreReadingPage(progress, pages, requestedChapter = null) {
  const requested = requestedChapter ? pages.findIndex((item) => item.chapter_id === Number(requestedChapter)) : -1
  if (requested >= 0) return requested
  if (progress?.chapter_id) {
    const start = pages.findIndex((item) => item.chapter_id === progress.chapter_id)
    if (start >= 0) {
      const count = pages.filter((item) => item.chapter_id === progress.chapter_id).length
      const offset = Number.isInteger(progress.chapter_page) && progress.chapter_page >= 0 ? progress.chapter_page : 0
      return start + Math.min(offset, count - 1)
    }
  }
  return restorePage(progress, pages.length)
}

export function expandReaderBook(response, previous = null) {
  if (!response.is_story) return response
  const chapterPages = { ...(previous?.chapterPages || {}) }
  const loadedId = response.pages[0]?.chapter_id
  if (loadedId) chapterPages[loadedId] = response.pages
  const cachedIds = [...(previous?.cachedIds || []).filter((id) => id !== loadedId), ...(loadedId ? [loadedId] : [])].slice(-3)
  for (const id of Object.keys(chapterPages)) {
    if (!cachedIds.includes(Number(id))) delete chapterPages[id]
  }
  const pages = response.chapters.flatMap((chapter) => Array.from({ length: chapter.page_count }, (_, index) => ({
    chapter_id: chapter.id, chapter_title: chapter.title, chapter_number: chapter.number,
    text: chapterPages[chapter.id]?.[index]?.text || '',
  })))
  return { ...response, pages, chapterPages, cachedIds }
}

export function chooseReadingProgress(local, remote) {
  if (!validProgress(local)) return validProgress(remote) ? remote : null
  if (!validProgress(remote)) return local
  if (local.pending && local.mutation_id !== remote.mutation_id) return local
  return remote
}
