import { useCallback, useEffect, useRef, useState } from 'react'
import { saveProgress } from '../api/library'
import { restoreReadingPage } from '../utils/reader'

// Owns the save queue, stale-write conflicts and pagehide/online synchronization.
export function useReaderProgress({ book, bookId, page, setPage, pages, total, loading, progressKey, contentContainerRef }) {
  const [syncStatus, setSyncStatus] = useState('')
  const [syncRetry, setSyncRetry] = useState(0)
  const [syncConflict, setSyncConflict] = useState(null)
  const saveQueue = useRef(Promise.resolve())
  const latestProgress = useRef(null)
  const initializeProgress = useCallback((progress, status) => {
    latestProgress.current = progress
    setSyncStatus(status)
  }, [])

  useEffect(() => {
    if (!book || loading || !pages.length || !pages[page]) return
    const previous = latestProgress.current
    const chapter = book.pages?.[page]
    const chapterStart = chapter?.chapter_id ? book.pages.findIndex((item) => item.chapter_id === chapter.chapter_id) : 0
    const changed = !previous || previous.page !== page || previous.total_pages !== total || previous.chapter_id !== (chapter?.chapter_id ?? null)
    const progress = changed
      ? { page, total_pages: total, chapter_id: chapter?.chapter_id ?? null, chapter_page: chapter?.chapter_id ? page - chapterStart : null, updated_at_ms: Date.now(), base_revision: previous?.base_revision ?? previous?.revision ?? 0, mutation_id: crypto.randomUUID(), pending: true }
      : previous
    latestProgress.current = progress
    let locallySaved = false
    try {
      localStorage.setItem(progressKey, JSON.stringify(progress))
      locallySaved = true
    } catch { /* Report persistence failure below if the server also fails. */ }
    if (syncConflict) return
    if (!changed && !progress.pending) return
    let active = true
    let submittedRevision = progress.base_revision ?? 0
    const task = saveQueue.current.catch(() => {}).then(() => {
      if (latestProgress.current?.mutation_id !== progress.mutation_id) return null
      if (!latestProgress.current.pending) return null
      if (active) setSyncStatus('saving')
      submittedRevision = latestProgress.current.base_revision ?? 0
      return saveProgress(bookId, { ...progress, base_revision: submittedRevision })
    })
    saveQueue.current = task
    task
      .then((saved) => {
        if (!saved) { if (active && !latestProgress.current?.pending) setSyncStatus('saved'); return }
        const normalized = { ...saved, base_revision: saved.revision, pending: false }
        if (latestProgress.current?.mutation_id === progress.mutation_id) {
          latestProgress.current = normalized
          try { localStorage.setItem(progressKey, JSON.stringify(normalized)) } catch { /* server saved */ }
        } else if (latestProgress.current?.base_revision === submittedRevision) {
          // A local page change queued while this request was in flight.
          latestProgress.current = { ...latestProgress.current, base_revision: saved.revision }
          try { localStorage.setItem(progressKey, JSON.stringify(latestProgress.current)) } catch { /* retry remains in memory */ }
        }
        if (active) setSyncStatus('saved')
      })
      .catch((err) => {
        if (!active) return
        if (err?.response?.data?.error_code === 'PROGRESS_CONFLICT') {
          setSyncConflict(err.response.data.details)
          setSyncStatus('conflict')
        } else setSyncStatus(locallySaved ? 'offline' : 'failed')
      })

    // Cuộn lên đầu trang đọc mỗi khi đổi trang
    if (contentContainerRef.current) {
      contentContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
    return () => { active = false }
  }, [page, total, book, bookId, progressKey, loading, pages, syncRetry, syncConflict, contentContainerRef, latestProgress])

  useEffect(() => {
    const retry = () => setSyncRetry((value) => value + 1)
    const flush = () => {
      const progress = latestProgress.current
      if (!progress?.pending || syncConflict) return
      fetch(`/api/v1/books/${bookId}/progress`, {
        method: 'PUT', credentials: 'include', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progress),
      }).catch(() => {})
    }
    window.addEventListener('online', retry)
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('online', retry)
      window.removeEventListener('pagehide', flush)
    }
  }, [bookId, syncConflict, latestProgress])

  // Điều hướng bằng phím mũi tên & phím tắt
  const useServerPosition = () => {
    latestProgress.current = { ...syncConflict, base_revision: syncConflict.revision, pending: false }
    try { localStorage.setItem(progressKey, JSON.stringify(latestProgress.current)) } catch { /* server saved */ }
    setPage(restoreReadingPage(syncConflict, book.pages))
    setSyncConflict(null)
    setSyncStatus('saved')
  }
  const keepLocalPosition = () => {
    latestProgress.current = { ...latestProgress.current, base_revision: syncConflict.revision, mutation_id: crypto.randomUUID(), pending: true }
    setSyncConflict(null)
    setSyncRetry((value) => value + 1)
  }
  return { syncStatus, syncConflict, setSyncRetry, initializeProgress, useServerPosition, keepLocalPosition }
}
