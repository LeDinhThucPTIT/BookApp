import { useState } from 'react'
import { deleteBook, myUploads, uploadBook } from '../api/books'
import { errorMessage } from '../api/client'
import { mediaUrl } from '../utils/media'

export default function UploadPage() {
  const [tab, setTab] = useState('upload')
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [form, setForm] = useState({
    title: '',
    author: '',
    genre: 'Tiểu thuyết',
    summary: '',
    language: 'Tiếng Việt',
    rights: false,
    terms: false,
  })
  const [bookFile, setBookFile] = useState(null)
  const [coverFile, setCoverFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadMessage, setUploadMessage] = useState('')

  const loadHistory = async () => {
    setTab('history')
    setLoadingHistory(true)
    try {
      const data = await myUploads()
      setHistory(Array.isArray(data) ? data : [])
    } catch (err) {
      alert(errorMessage(err, 'Không thể tải lịch sử'))
    } finally {
      setLoadingHistory(false)
    }
  }

  const onUpload = async () => {
    if (uploading) return
    setUploadError('')
    setUploadMessage('')
    if (!form.title.trim() || !form.author.trim()) {
      alert('⚠️ Vui lòng nhập Tiêu đề và Tác giả!')
      return
    }
    if (!form.rights || !form.terms) {
      alert('⚠️ Bạn cần đồng ý với điều khoản!')
      return
    }
    if (!bookFile) {
      setUploadError('Vui lòng chọn file PDF.')
      return
    }
    if (!bookFile.name.toLowerCase().endsWith('.pdf') || bookFile.size > 50 * 1024 * 1024) {
      setUploadError('Chỉ hỗ trợ PDF có dung lượng tối đa 50 MB.')
      return
    }
    if (coverFile && (!/\.(png|jpe?g|webp)$/i.test(coverFile.name) || coverFile.size > 5 * 1024 * 1024)) {
      setUploadError('Ảnh bìa phải là JPG, PNG hoặc WebP, tối đa 5 MB.')
      return
    }
    const data = new FormData()
    data.append('title', form.title)
    data.append('author', form.author)
    data.append('genre', form.genre)
    data.append('summary', form.summary)
    data.append('language', form.language)
    data.append('book_file', bookFile)
    if (coverFile) data.append('cover_file', coverFile)
    try {
      setUploading(true)
      await uploadBook(data)
      setUploadMessage('Đã tải sách lên thành công.')
      setForm({ ...form, title: '', author: '', summary: '', rights: false, terms: false })
      setBookFile(null)
      setCoverFile(null)
      document.getElementById('book-upload-file').value = ''
      document.getElementById('book-upload-cover').value = ''
    } catch (err) {
      setUploadError(errorMessage(err, 'Không thể tải sách lên. Vui lòng thử lại.'))
    } finally { setUploading(false) }
  }

  return (
    <div className="upload-page">
      <header>
        <div className="logo">📚 BookUploader</div>
        <nav>
          <button id="btn-upload" className={tab === 'upload' ? 'active' : ''} onClick={() => setTab('upload')}>
            Trang Upload
          </button>
          <button id="btn-history" className={tab === 'history' ? 'active' : ''} onClick={loadHistory}>
            Lịch Sử Upload
          </button>
        </nav>
      </header>

      {tab === 'upload' && (
        <div className="container" id="upload-section">
          {uploadError && <p role="alert">{uploadError}</p>}
          {uploadMessage && <p role="status">{uploadMessage}</p>}
          <fieldset disabled={uploading} className="upload-fields">
          <div className="part 1">
            <h2>1. Thông Tin Sách</h2>
            <label>Tiêu đề sách:</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nhà Giả Kim" />
            <label>Tác giả:</label>
            <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Paulo Coelho" />
            <label>Thể loại:</label>
            <select value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })}>
              <option>Tiểu thuyết</option>
              <option>Khoa học</option>
              <option>Lịch sử</option>
              <option>Kinh doanh</option>
              <option>Khác</option>
            </select>
            <label>Mô tả ngắn / Tóm tắt:</label>
            <textarea maxLength={500} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
            <label>Ngôn ngữ:</label>
            <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
              <option>Tiếng Việt</option>
              <option>Tiếng Anh</option>
              <option>Khác</option>
            </select>
          </div>
          <div className="part 2">
            <h2>2. Tệp Tin & Hình Ảnh</h2>
            <label>Tệp sách PDF (tối đa 50 MB):</label>
            <input id="book-upload-file" type="file" accept=".pdf" onChange={(e) => setBookFile(e.target.files?.[0] || null)} />
            <label>Ảnh bìa JPG, PNG hoặc WebP (tối đa 5 MB):</label>
            <input id="book-upload-cover" type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
          </div>
          <div className="part 3">
            <h2>3. Điều Khoản & Gửi</h2>
            <div className="checkbox-group">
              <input type="checkbox" id="rights" checked={form.rights} onChange={(e) => setForm({ ...form, rights: e.target.checked })} />
              <label htmlFor="rights">Tôi xác nhận rằng tôi có đầy đủ quyền để chia sẻ và xuất bản nội dung sách này trên nền tảng.</label>
            </div>
            <div className="checkbox-group">
              <input type="checkbox" id="terms" checked={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.checked })} />
              <label htmlFor="terms">Tôi đã đọc và đồng ý với Điều khoản Dịch vụ và Chính sách Tải lên.</label>
            </div>
            <button className="btn-submit" id="upload-btn" disabled={uploading} onClick={onUpload}>
              {uploading ? 'Đang tải lên…' : '📤 Tải sách lên'}
            </button>
          </div>
          </fieldset>
        </div>
      )}

      {tab === 'history' && (
        <div className="history-container open" id="history-section">
          <h2>Lịch Sử Upload</h2>
          <div id="history-list">
            {loadingHistory && <p>⏳ Đang tải lịch sử...</p>}
            {!loadingHistory && history.length === 0 && <p>📭 Chưa có sách nào được tải lên.</p>}
            {history.map((book) => (
              <div className="history-item" key={book.id}>
                <img src={mediaUrl(book.cover_image)} alt="bìa" width="80" />
                <div>
                  <h3>{book.title}</h3>
                  <p>{book.author}</p>
                  <small>{book.created_at}</small>
                  <button
                    className="btn-delete"
                    onClick={async () => {
                      if (!confirm('Xoá sách này chứ?')) return
                      await deleteBook(book.id)
                      setHistory((prev) => prev.filter((row) => row.id !== book.id))
                      alert('✅ Xoá thành công!')
                    }}
                  >
                    🗑️ Xoá
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
