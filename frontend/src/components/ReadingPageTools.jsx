import { useEffect, useMemo, useRef, useState } from 'react'
import { createAnnotation, deleteAnnotation, listAnnotations, updateAnnotation } from '../api/reading-tools'
import { errorMessage } from '../api/client'

export default function ReadingPageTools({ bookId, page, text, chapterId, chapterPage, onAsk, onJump }) {
  const [annotations, setAnnotations] = useState([])
  const [selection, setSelection] = useState(null)
  const [draft, setDraft] = useState('')
  const [color, setColor] = useState('yellow')
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const contentRef = useRef(null)

  useEffect(() => {
    const refresh = (event) => { if (String(event.detail?.bookId) === String(bookId)) setRetry((value) => value + 1) }
    window.addEventListener('bookapp:annotations-changed', refresh)
    return () => window.removeEventListener('bookapp:annotations-changed', refresh)
  }, [bookId])

  useEffect(() => {
    let active = true
    listAnnotations(bookId).then((data) => { if (active) { setAnnotations(data); setError('') } })
      .catch((err) => { if (active) setError(errorMessage(err, 'Không tải được ghi chú.')) })
    return () => { active = false }
  }, [bookId, retry])

  useEffect(() => {
    const capture = () => {
      const selected = window.getSelection()
      if (!selected?.rangeCount || selected.isCollapsed) return
      const range = selected.getRangeAt(0)
      const container = contentRef.current
      if (!container?.contains(range.startContainer) || !container.contains(range.endContainer)) return
      const before = range.cloneRange()
      before.selectNodeContents(container)
      before.setEnd(range.startContainer, range.startOffset)
      const raw = range.toString()
      const quote = raw.trim()
      if (!quote || quote.length > 1800) return
      const start = before.toString().length + raw.length - raw.trimStart().length
      setSelection({ page, quote, start_offset: start, end_offset: start + quote.length })
    }
    document.addEventListener('selectionchange', capture)
    return () => document.removeEventListener('selectionchange', capture)
  }, [page, text])

  const current = selection?.page === page && text.slice(selection.start_offset, selection.end_offset) === selection.quote ? selection : null
  const segments = useMemo(() => {
    const marks = annotations.filter((note) => !note.source_missing && note.page === page && (!chapterId || note.chapter_id === chapterId) && text.slice(note.start_offset, note.end_offset) === note.quote)
    const boundaries = [...new Set([0, text.length, ...marks.flatMap((note) => [note.start_offset, note.end_offset])])].sort((a, b) => a - b)
    return boundaries.slice(0, -1).map((start, index) => ({ start, text: text.slice(start, boundaries[index + 1]), note: marks.find((note) => note.start_offset <= start && note.end_offset >= boundaries[index + 1]) }))
  }, [annotations, page, text, chapterId])

  const perform = async (action) => {
    if (busy) return
    setBusy(true)
    setError('')
    try { await action() } catch (err) { setError(errorMessage(err, 'Không thể lưu thay đổi.')) } finally { setBusy(false) }
  }
  const save = () => perform(async () => {
    const item = await createAnnotation(bookId, { ...current, chapter_id: chapterId || undefined, chapter_page: chapterId ? chapterPage : undefined, note: draft, color })
    setAnnotations((items) => [...items, item])
    setSelection(null)
    setDraft('')
    window.getSelection()?.removeAllRanges()
  })

  return <>
    <div ref={contentRef} className="page active reading-selectable" key={page}>
      {segments.map((segment) => segment.note
        ? <mark key={segment.start} className={`reading-mark ${segment.note.color}`} title={segment.note.note || 'Đoạn đã tô sáng'}>{segment.text}</mark>
        : <span key={segment.start}>{segment.text}</span>)}
    </div>
    <div className="reading-tools-hint">Chọn một đoạn văn để tô sáng, ghi chú hoặc hỏi AI.</div>
    {current && <section className="selection-tools" aria-label="Công cụ đoạn được chọn">
      <blockquote>{current.quote}</blockquote>
      <label>Ghi chú của bạn<textarea rows={2} maxLength={10000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Bạn nghĩ gì về đoạn này?" /></label>
      <label>Màu tô sáng<select value={color} onChange={(event) => setColor(event.target.value)}><option value="yellow">Vàng</option><option value="green">Xanh</option><option value="pink">Hồng</option></select></label>
      <div className="reading-tool-actions">
        <button type="button" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu tô sáng / ghi chú'}</button>
        <button type="button" onClick={() => onAsk(current.quote, 'chat')}>Hỏi AI về đoạn</button>
        <button type="button" onClick={() => onAsk(current.quote, 'summary')}>Tóm tắt đoạn</button>
        <button type="button" onClick={() => { setSelection(null); window.getSelection()?.removeAllRanges() }}>Bỏ chọn</button>
      </div>
    </section>}
    {error && <div className="reader-notice" role="alert">{error} <button type="button" onClick={() => setRetry((value) => value + 1)}>Tải lại ghi chú</button></div>}
    <details className="reading-notes">
      <summary>Ghi chú và tô sáng của tôi ({annotations.length})</summary>
      {!annotations.length && <p>Chưa có ghi chú. Hãy chọn một đoạn văn trong trang đang đọc.</p>}
      {annotations.map((note) => <article key={note.id}>
        {note.source_missing ? <p>Nội dung đã thay đổi; chưa xác định được vị trí đoạn trích.</p> : <button type="button" className="note-location" onClick={() => onJump(note.page)}>Đến trang {note.page + 1}</button>}
        <blockquote>{note.quote}</blockquote>
        {editing?.id === note.id ? <>
          <textarea aria-label="Chỉnh sửa ghi chú" maxLength={10000} rows={3} value={editing.note} onChange={(event) => setEditing({ ...editing, note: event.target.value })} />
          <button type="button" disabled={busy} onClick={() => perform(async () => {
            const updated = await updateAnnotation(note.id, { note: editing.note, color: note.color })
            setAnnotations((items) => items.map((item) => item.id === note.id ? { ...item, note: updated.note, color: updated.color } : item))
            setEditing(null)
          })}>Lưu ghi chú</button>
          <button type="button" onClick={() => setEditing(null)}>Hủy</button>
        </> : <><p className="note-text">{note.note || 'Đoạn đã tô sáng'}</p><button type="button" onClick={() => setEditing(note)}>Sửa ghi chú</button></>}
        <button type="button" disabled={busy} onClick={() => perform(async () => {
          await deleteAnnotation(note.id)
          setAnnotations((items) => items.filter((item) => item.id !== note.id))
        })}>Xóa</button>
      </article>)}
    </details>
  </>
}
