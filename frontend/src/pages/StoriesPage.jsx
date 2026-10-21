import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { createStory, listStories } from '../api/reading-tools'
import { errorMessage } from '../api/client'
import '../styles/stories.css'

export default function StoriesPage() {
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ title: '', author: '', genre: 'Truyện', summary: '', status: 'ongoing' })
  const { search = '' } = useOutletContext() || {}
  const navigate = useNavigate()
  const createRef = useRef(null)
  useEffect(() => {
    let active = true
    listStories().then((data) => { if (active) { setStories(data); setError('') } })
      .catch((err) => { if (active) setError(errorMessage(err, 'Không tải được truyện.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retry])
  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try { const story = await createStory(form); navigate(`/stories/${story.id}`) }
    catch (err) { setError(errorMessage(err, 'Không tạo được truyện.')) }
    finally { setBusy(false) }
  }
  const matched = stories.filter((story) => `${story.title} ${story.author} ${story.genre}`.toLowerCase().includes(search.trim().toLowerCase()) && (filter === 'all' || story.status === filter))
  return <main className="Main stories-main">
    <header className="stories-heading"><div><span className="stories-eyebrow">THƯ VIỆN CỦA BẠN</span><h1>Truyện theo chương</h1><p>Khám phá câu chuyện mới hoặc chia sẻ tác phẩm của bạn.</p></div><div className="story-heading-actions"><Link className="story-secondary" to="/home">Thư viện sách</Link><button className="story-primary" type="button" onClick={() => { createRef.current.open = true; createRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); document.getElementById('story-title')?.focus({ preventScroll: true }) }}>＋ Đăng truyện</button></div></header>
    <div className="stories-filter"><label>Trạng thái <select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Tất cả truyện</option><option value="ongoing">Đang ra</option><option value="completed">Hoàn thành</option></select></label></div>
    {error && <p className="stories-error" role="alert">{error} <button type="button" onClick={() => { setLoading(true); setRetry((value) => value + 1) }}>Thử tải lại</button></p>}
    {loading ? <p role="status">Đang tải truyện…</p> : <div className="stories-grid">
      {matched.map((story) => <article className="story-card" key={story.id}>
        <div className="story-cover" aria-hidden="true">{story.title.slice(0, 1)}</div>
        <div><span className="story-status">{story.status === 'completed' ? 'Hoàn thành' : 'Đang ra'} · {story.chapter_count} chương</span><h2><Link to={`/stories/${story.id}`}>{story.title}</Link></h2><p>{story.author} · {story.genre}</p><p className="story-description">{story.summary || 'Một câu chuyện đang chờ bạn khám phá.'}</p><Link className="story-primary" to={`/stories/${story.id}`}>Xem mục lục →</Link></div>
      </article>)}
      {!matched.length && <p>Chưa có truyện phù hợp. Bạn có thể đăng truyện đầu tiên bên dưới.</p>}
    </div>}
    <details ref={createRef} className="story-create"><summary>Đăng truyện mới <span className="story-step">Bước 1 / 2</span></summary><p>Điền thông tin giới thiệu. Bạn sẽ thêm từng chương ở bước tiếp theo.</p>
      <form className="story-form" onSubmit={submit}>
        <fieldset className="story-form-fields" disabled={busy}>
        <label>Tên truyện *<input id="story-title" required maxLength={255} placeholder="Nhập tên truyện của bạn" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>Tác giả *<input required maxLength={255} placeholder="Tên tác giả hoặc bút danh" value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} /></label>
        <label>Thể loại<input maxLength={100} value={form.genre} onChange={(event) => setForm({ ...form, genre: event.target.value })} /></label>
        <label>Trạng thái<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="ongoing">Đang ra</option><option value="completed">Hoàn thành</option></select></label>
        <label className="full-width">Giới thiệu<textarea rows={4} maxLength={10000} placeholder="Một vài dòng về thế giới, nhân vật và câu chuyện của bạn…" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
        </fieldset>
        <div className="story-form-footer"><p>Chia sẻ tác phẩm của bạn hoặc nội dung bạn có quyền đăng.</p><button className="story-primary" disabled={busy} type="submit">{busy ? 'Đang tạo…' : 'Tiếp tục: Thêm chương →'}</button></div>
      </form>
    </details>
  </main>
}
