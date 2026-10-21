import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminAddBook } from '../../api/admin'
import { errorMessage } from '../../api/client'

export default function AdminAddBook() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', author: '', genre: '', summary: '' })
  const [cover, setCover] = useState(null)
  const [bookFile, setBookFile] = useState(null)
  const [preview, setPreview] = useState('')
  const previewUrl = useRef('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current) }, [])
  const changeCover = e => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    const file = e.target.files?.[0] || null
    previewUrl.current = file ? URL.createObjectURL(file) : ''
    setCover(file)
    setPreview(previewUrl.current)
  }
  const onSubmit = async e => {
    e.preventDefault()
    if (busy) return
    if (!form.title.trim() || !form.author.trim()) { setError('Vui lòng nhập tên sách và tác giả.'); return }
    if (!bookFile || bookFile.size > 50 * 1024 * 1024) { setError('Chọn tệp PDF không quá 50 MB.'); return }
    if (cover && cover.size > 5 * 1024 * 1024) { setError('Ảnh bìa không được vượt quá 5 MB.'); return }
    const data = new FormData()
    Object.entries(form).forEach(([key, value]) => data.append(key, value.trim()))
    if (cover) data.append('cover', cover)
    data.append('book_file', bookFile)
    setBusy(true); setError('')
    try { await adminAddBook(data); navigate('/admin/books') } catch (err) { setError(errorMessage(err, 'Không thể thêm sách')) } finally { setBusy(false) }
  }
  return <>
    <div className="admin-page-heading"><div><p className="admin-eyebrow">MỞ RỘNG THƯ VIỆN</p><h1>Thêm một cuốn sách mới.</h1><p>Điền thông tin để đưa tác phẩm đến với người đọc.</p></div><Link className="admin-button" to="/admin/books">← Danh sách sách</Link></div>
    <form className="admin-add-form" onSubmit={onSubmit}>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <fieldset disabled={busy}><section className="admin-panel"><div className="admin-panel-heading"><div><h2>Thông tin tác phẩm</h2><p>Dấu * là thông tin bắt buộc.</p></div></div><div className="admin-form-grid">
        <label>Tên sách *<input required maxLength={255} placeholder="Tên tác phẩm của bạn" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
        <label>Tác giả *<input required maxLength={255} placeholder="Tên tác giả" value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} /></label>
        <label className="admin-full-width">Thể loại<input maxLength={100} placeholder="Ví dụ: Kỹ năng, Công nghệ, Văn học…" value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value })} /></label>
        <label className="admin-full-width">Giới thiệu tác phẩm<textarea rows={6} placeholder="Một vài dòng để người đọc khám phá cuốn sách…" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} /></label>
      </div></section>
      <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Bìa & nội dung</h2><p>Chọn tệp từ thiết bị của bạn.</p></div></div><div className="admin-upload-grid"><div className="admin-upload-box">{cover && preview ? <img src={preview} alt="Xem trước bìa sách" /> : <div className="admin-upload-placeholder">Bìa sách</div>}<label>Ảnh bìa<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={changeCover} /></label><small>PNG, JPG, WEBP hoặc GIF · tối đa 5 MB</small></div><div className="admin-upload-box"><label>Tệp sách PDF *<input type="file" accept=".pdf,application/pdf" required onChange={e => setBookFile(e.target.files?.[0] || null)} /></label><small>Tối đa 50 MB. Nội dung sẽ được xử lý để đọc trên BookApp.</small>{bookFile && <p className="admin-file-name">{bookFile.name} · {(bookFile.size / 1024 / 1024).toFixed(1)} MB</p>}</div></div></section>
      <div className="admin-form-actions"><Link className="admin-button" to="/admin/books">Quay lại</Link><button className="admin-button admin-primary" type="submit">{busy ? 'Đang xử lý sách…' : 'Thêm vào thư viện'}</button></div></fieldset>
    </form>
  </>
}
