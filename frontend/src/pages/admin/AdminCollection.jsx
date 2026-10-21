import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminDeleteBook, adminListBooks, adminDeleteUser, adminListUsers, adminDeleteComment, adminListComments } from '../../api/admin'
import { errorMessage } from '../../api/client'
import { mediaUrl } from '../../utils/media'

const options = {
  books: { title: 'Sách & truyện', description: 'Chăm chút từng tác phẩm trong thư viện của bạn.', load: adminListBooks, remove: adminDeleteBook, columns: ['Tác phẩm', 'Tác giả', 'Thể loại', 'Ngày thêm'], search: ['title', 'author', 'genre'] },
  users: { title: 'Cộng đồng người đọc', description: 'Quản lý tài khoản và vai trò thành viên BookApp.', load: adminListUsers, remove: adminDeleteUser, columns: ['Thành viên', 'Email', 'Vai trò', 'Ngày tham gia'], search: ['username', 'email', 'role'] },
  comments: { title: 'Những cuộc trò chuyện', description: 'Theo dõi và quản lý bình luận trong thư viện.', load: adminListComments, remove: adminDeleteComment, columns: ['Người đọc', 'Tác phẩm', 'Nội dung', 'Ngày đăng'], search: ['username', 'title', 'content'] },
}
const date = value => value ? new Date(value.endsWith('Z') || /[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`).toLocaleDateString('vi-VN') : '—'

export default function AdminCollection({ type }) {
  const config = options[type]
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    config.load().then(data => { if (active) setRows(data) }).catch(err => { if (active) setError(errorMessage(err)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [config, attempt])
  const filtered = rows.filter(row => config.search.some(key => String(row[key] || '').toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))))
  const pages = Math.max(1, Math.ceil(filtered.length / 8))
  const current = Math.min(page, pages)
  const remove = async row => {
    const name = row.title || row.username || `#${row.id}`
    if (!window.confirm(`Xóa ${type === 'comments' ? 'bình luận' : type === 'users' ? 'tài khoản' : 'tác phẩm'} “${name}”? Thao tác này không thể hoàn tác và sẽ xóa dữ liệu liên quan.`)) return
    setBusy(row.id); setError('')
    try { await config.remove(row.id); setRows(old => old.filter(r => r.id !== row.id)) } catch (err) { setError(errorMessage(err)) } finally { setBusy(null) }
  }
  return <>
    <div className="admin-page-heading"><div><p className="admin-eyebrow">QUẢN LÝ THƯ VIỆN</p><h1>{config.title}</h1><p>{config.description}</p></div>{type === 'books' && <Link className="admin-button admin-primary" to="/admin/books/add">+ Thêm sách mới</Link>}</div>
    <section className="admin-panel admin-table-panel"><div className="admin-panel-heading"><h2>Tất cả <span className="admin-badge">{rows.length}</span></h2><input className="admin-search" type="search" aria-label="Tìm kiếm danh sách" placeholder="Tìm kiếm…" value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} /></div>
      {error && <div className="admin-error" role="alert">{error} <button onClick={() => { setError(''); setLoading(true); setAttempt(v => v + 1) }}>Tải lại</button></div>}
      {loading ? <p className="admin-loading" role="status">Đang tải dữ liệu…</p> : <><div className="admin-table-scroll"><table className="admin-table"><thead><tr>{config.columns.map(c => <th key={c} scope="col">{c}</th>)}<th scope="col">Thao tác</th></tr></thead><tbody>{filtered.slice((current - 1) * 8, current * 8).map(row => <tr key={row.id}>
        {type === 'books' ? <><td><div className="admin-book-cell">{row.cover_image ? <img src={mediaUrl(row.cover_image)} alt="" /> : <span className="admin-cover-placeholder">B</span>}<div><strong>{row.title}</strong><small>#{row.id}</small></div></div></td><td>{row.author || 'Chưa cập nhật'}</td><td><span className="admin-badge">{row.genre || 'Chưa phân loại'}</span></td><td>{date(row.created_at)}</td></> : type === 'users' ? <><td><div className="admin-book-cell"><span className="admin-avatar">{row.username?.slice(0, 1).toUpperCase()}</span><strong>{row.username}</strong></div></td><td>{row.email}</td><td><span className={`admin-badge ${row.role === 'admin' ? 'admin-badge-blue' : ''}`}>{row.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</span></td><td>{date(row.created_at)}</td></> : <><td><strong>{row.username}</strong></td><td>{row.title}</td><td className="admin-comment-cell">{row.content}</td><td>{date(row.created_at)}</td></>}
        <td>{type === 'users' && row.role === 'admin' ? <span className="admin-muted">Được bảo vệ</span> : <button className="admin-delete" disabled={busy !== null} onClick={() => remove(row)} aria-label={`Xóa ${type === 'comments' ? 'bình luận của ' + row.username : row.title || row.username}`}>{busy === row.id ? 'Đang xóa…' : 'Xóa'}</button>}</td>
      </tr>)}</tbody></table></div>{!filtered.length && <p className="admin-empty">{query ? 'Không tìm thấy kết quả phù hợp.' : error ? 'Dữ liệu chưa tải được. Vui lòng thử lại.' : 'Chưa có dữ liệu trong danh sách này.'}</p>}<div className="admin-pagination"><span>{filtered.length ? `${(current - 1) * 8 + 1}–${Math.min(current * 8, filtered.length)}` : '0'} trên {filtered.length} kết quả</span><div><button className="admin-button" disabled={current === 1} onClick={() => setPage(current - 1)}>← Trước</button><span>{current} / {pages}</span><button className="admin-button" disabled={current === pages} onClick={() => setPage(current + 1)}>Sau →</button></div></div></>}
    </section>
  </>
}
