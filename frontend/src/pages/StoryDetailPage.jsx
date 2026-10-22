import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { addChapter, deleteChapter, editChapter, getStory, listChapters, updateStory, getChapter } from '../api/reading-tools'
import { useChapterDraft } from '../components/useChapterDraft'
import { errorMessage } from '../api/client'
import { useAuth } from '../context/auth-context'
import '../styles/stories.css'

export default function StoryDetailPage() {
  const { bookId } = useParams()
  return <StoryDetail key={bookId} bookId={bookId} />
}

function StoryDetail({ bookId }) {
  const { user } = useAuth()
  const [story, setStory] = useState(null)
  const [chapters, setChapters] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const { draft, setDraft, editing, draftStatus, openDraft, finishDraft, discardDraft, dirty } = useChapterDraft(user.id, bookId)
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    Promise.all([getStory(bookId), listChapters(bookId)]).then(([detail, list]) => {
      if (!active) return
      setStory(detail); setChapters(list); openDraft({ number: (list.at(-1)?.number || 0) + 1, title: '', content: '' }); setError('')
    }).catch((err) => { if (active) setError(errorMessage(err, 'Không tải được truyện.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [bookId, retry, openDraft])
  const owner = story && (user.role === 'admin' || story.uploaded_by === user.id)
  const perform = async (action) => {
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try { await action() } catch (err) { setError(errorMessage(err, 'Không thể lưu thay đổi.')) } finally { setBusy(false) }
  }
  const submit = (event) => {
    event.preventDefault()
    perform(async () => {
      const chapter = editing ? await editChapter(bookId, editing, draft) : await addChapter(bookId, draft)
      const list = [...chapters.filter((item) => item.id !== chapter.id), chapter].sort((a, b) => a.number - b.number)
      setChapters(list); finishDraft({ number: (list.at(-1)?.number || 0) + 1, title: '', content: '' }); setMessage('Đã lưu chương truyện.')
    })
  }
  return <main className="Main stories-main">
    <Link className="story-back-link" to="/stories">← Tất cả truyện</Link>
    {error && <p className="stories-error" role="alert">{error} {!story && <button type="button" onClick={() => { setLoading(true); setRetry((value) => value + 1) }}>Thử lại</button>}</p>}
    {message && <p className="stories-success" role="status">{message}</p>}
    {loading ? <p role="status">Đang tải mục lục…</p> : story && <>
      <header className="stories-heading"><div><span className="stories-eyebrow">{story.genre} · {story.status === 'completed' ? 'Hoàn thành' : 'Đang ra'}</span><h1>{story.title}</h1><p>{story.author} · {chapters.length} chương</p><p className="story-intro">{story.summary}</p></div>{chapters.length > 0 && <Link className="story-primary" to={`/read/${bookId}`}>Đọc / Tiếp tục đọc</Link>}</header>
      <section className="story-chapters"><div className="story-section-heading"><h2>Danh sách chương</h2><span className="story-count">{chapters.length} chương</span></div>{!chapters.length && <div className="story-empty"><span aria-hidden="true">📖</span><h3>Câu chuyện đang chờ chương đầu tiên</h3><p>{owner ? 'Viết chương đầu tiên trong phần soạn thảo bên dưới.' : 'Hãy quay lại khi tác giả cập nhật chương mới.'}</p></div>}
        {chapters.map((chapter) => <div className="story-chapter-row" key={chapter.id}><Link to={`/read/${bookId}?chapter=${chapter.id}`}>Chương {chapter.number}: {chapter.title}</Link>{owner && <div><button type="button" disabled={busy} onClick={() => { perform(async () => { const content = await getChapter(bookId, chapter.id); openDraft({ number: content.number, title: content.title, content: content.content }, content.id); document.getElementById('chapter-editor')?.scrollIntoView({ behavior: 'smooth' }) }) }}>Sửa</button><button type="button" disabled={busy} onClick={() => {
          if (window.confirm(`Xóa chương ${chapter.number}? Ghi chú gắn với chương cũng sẽ bị xóa.`)) perform(async () => { await deleteChapter(bookId, chapter.id); setChapters((items) => items.filter((item) => item.id !== chapter.id)); if (editing === chapter.id) { finishDraft({ number: chapter.number, title: '', content: '' }) } })
        }} className="story-danger">Xóa</button></div>}</div>)}
      </section>
      {owner && <>
        <section className="story-create story-editor" id="chapter-editor"><div className="story-section-heading"><div><h2>{editing ? 'Chỉnh sửa chương' : 'Soạn chương mới'}</h2><p>Viết tiếp câu chuyện của bạn. Chương sẽ xuất hiện trong mục lục sau khi lưu.</p></div><span className="story-step">{editing ? 'Đang chỉnh sửa' : 'Bước 2 / 2'}</span></div><form className="story-form" onSubmit={submit}>
          <fieldset className="story-form-fields" disabled={busy}>
          <label>Số chương<input type="number" min={1} max={100000} required value={draft.number} onChange={(event) => setDraft({ ...draft, number: Number(event.target.value) })} /></label>
          <label>Tiêu đề chương<input required maxLength={255} placeholder="Đặt tên cho chương này" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label className="full-width">Nội dung chương<textarea className="story-manuscript" required rows={16} maxLength={60000} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="Câu chuyện bắt đầu từ đây…" /></label>
          </fieldset>
          <div className="story-draft-status full-width" role="status">{draftStatus}{dirty && <button type="button" disabled={busy} onClick={() => {
            if (window.confirm('Bỏ bản nháp chưa đăng?')) perform(async () => {
              const original = editing ? await getChapter(bookId, editing) : { number: (chapters.at(-1)?.number || 0) + 1, title: '', content: '' }
              discardDraft({ number: original.number, title: original.title, content: original.content })
            })
          }}>Bỏ bản nháp</button>}</div>
          <div className="story-form-footer"><span className="story-editor-count">{draft.content.length.toLocaleString('vi-VN')} / 60.000 ký tự</span><div className="story-heading-actions">{editing && <button type="button" disabled={busy} onClick={() => { openDraft({ number: (chapters.at(-1)?.number || 0) + 1, title: '', content: '' }) }}>Hủy chỉnh sửa</button>}<button type="submit" className="story-primary" disabled={busy}>{busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Đăng chương mới'}</button></div></div>
        </form></section>
        <div className="story-create"><label>Trạng thái truyện <select value={story.status} disabled={busy} onChange={(event) => {
          const status = event.target.value
          perform(async () => { const saved = await updateStory(bookId, { title: story.title, author: story.author, genre: story.genre || 'Truyện', summary: story.summary || '', status }); setStory(saved); setMessage('Đã cập nhật trạng thái truyện.') })
        }}><option value="ongoing">Đang ra</option><option value="completed">Hoàn thành</option></select></label></div>
      </>}
    </>}
  </main>
}
