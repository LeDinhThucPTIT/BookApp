import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/auth-context'
import { useTheme } from '../../context/theme-context'
import '../../styles/admin.css'

export function AdminIcon({ name }) {
  const paths = { dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', book: 'M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Zm0 0v16', users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m9-7a4 4 0 0 1 0 8m4 9v-2a4 4 0 0 0-3-4', comment: 'M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4Z', arrow: 'M19 12H5m6-6-6 6 6 6', sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0', menu: 'M3 6h18M3 12h18M3 18h18', logout: 'M9 3H3v18h6m6-15 6 6-6 6m-7-6h13' }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.book} /></svg>
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    const close = event => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [open])
  const links = [['/admin', 'dashboard', 'Tổng quan'], ['/admin/books', 'book', 'Sách & truyện'], ['/admin/users', 'users', 'Người dùng'], ['/admin/comments', 'comment', 'Bình luận']]
  return <div className={`admin-shell ${open ? 'admin-menu-open' : ''}`}>
    {open && <button className="admin-overlay" aria-label="Đóng menu" onClick={() => setOpen(false)} />}
    <aside className="admin-sidebar">
      <Link className="admin-brand" to="/admin"><span><AdminIcon name="book" /></span><div>BookApp<small>KHÔNG GIAN QUẢN TRỊ</small></div></Link>
      <p className="admin-nav-label">QUẢN LÝ THƯ VIỆN</p>
      <nav aria-label="Quản trị">{links.map(([to, icon, text]) => <NavLink key={to} to={to} end={to === '/admin'} onClick={() => setOpen(false)}><AdminIcon name={icon} />{text}</NavLink>)}</nav>
      <div className="admin-sidebar-bottom"><div className="admin-sidebar-note"><AdminIcon name="book" /><strong>Mỗi trang sách, một hành trình.</strong><p>Chăm chút thư viện để những câu chuyện tìm được người đọc.</p></div>
        <Link to="/"><AdminIcon name="arrow" />Về trang đọc sách</Link>
        <button onClick={async () => { try { await logout(); navigate('/', { replace: true }) } catch { setError('Chưa thể đăng xuất. Vui lòng thử lại.') } }}><AdminIcon name="logout" />Đăng xuất</button>
      </div>
    </aside>
    <div className="admin-workspace"><header className="admin-topbar"><div className="admin-topbar-title"><button className="admin-icon-button admin-menu-toggle" onClick={() => setOpen(!open)} aria-label="Mở menu" aria-expanded={open}><AdminIcon name="menu" /></button><span>Thư viện của bạn <span className="admin-muted">/ Quản trị</span></span></div><div className="admin-topbar-actions"><button className="admin-icon-button" aria-label={theme === 'dark' ? 'Bật giao diện sáng' : 'Bật giao diện tối'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><AdminIcon name="sun" /></button><span className="admin-avatar">{user?.username?.slice(0, 1).toUpperCase() || 'A'}</span><div className="admin-profile"><strong>{user?.username || 'Admin'}</strong><small>Quản trị viên</small></div></div></header>
      <main className="admin-content">{error && <p className="admin-error" role="alert">{error}</p>}<Outlet /></main>
    </div>
  </div>
}
