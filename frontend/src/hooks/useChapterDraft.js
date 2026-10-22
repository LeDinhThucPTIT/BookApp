import { useCallback, useEffect, useState } from 'react'
import { chapterDraftKey, readChapterDraft } from '../utils/drafts'

export function useChapterDraft(userId, bookId) {
  const [draft, updateDraft] = useState({ number: 1, title: '', content: '' })
  const [editing, setEditing] = useState(null)
  const [draftStatus, setStatus] = useState('')
  const [baseline, setBaseline] = useState(JSON.stringify(draft))
  const [ready, setReady] = useState(false)
  const key = chapterDraftKey(userId, bookId, editing)
  const dirty = ready && JSON.stringify(draft) !== baseline

  useEffect(() => {
    if (!dirty) return
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const setDraft = (next) => {
    updateDraft(next)
    try {
      if (JSON.stringify(next) === baseline) {
        localStorage.removeItem(key)
        setStatus('')
      } else {
        localStorage.setItem(key, JSON.stringify(next))
        setStatus('Đã lưu bản nháp trên thiết bị này.')
      }
    } catch { setStatus('Không lưu được bản nháp. Hãy lưu chương trước khi rời trang.') }
  }

  const openDraft = useCallback((value, chapterId = null) => {
    const saved = readChapterDraft({ getItem: (name) => localStorage.getItem(name) }, chapterDraftKey(userId, bookId, chapterId))
    setBaseline(JSON.stringify(value))
    setEditing(chapterId)
    updateDraft(saved || value)
    setStatus(saved ? 'Đã khôi phục bản nháp chưa đăng trên thiết bị này.' : '')
    setReady(true)
  }, [userId, bookId])
  const finishDraft = (next) => {
    try { localStorage.removeItem(key) } catch { /* Server already saved the chapter. */ }
    setBaseline(JSON.stringify(next))
    setEditing(null)
    updateDraft(next)
    setStatus('')
  }
  const discardDraft = (next) => {
    try { localStorage.removeItem(key) } catch { /* In-memory draft can still reset. */ }
    setBaseline(JSON.stringify(next))
    updateDraft(next)
    setStatus('Đã bỏ bản nháp trên thiết bị.')
  }
  return { draft, setDraft, editing, draftStatus, openDraft, finishDraft, discardDraft, dirty }
}
