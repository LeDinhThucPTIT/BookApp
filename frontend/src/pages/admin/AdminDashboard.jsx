import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getStats } from '../../api/admin'
import { errorMessage } from '../../api/client'
import { AdminIcon } from './AdminLayout'

const colors = ['#168bea', '#8b74e8', '#ef9b49', '#30b29b', '#ed7898', '#698399', '#b0996c', '#729c57']
const number = value => new Intl.NumberFormat('vi-VN').format(value)

function GrowthChart({ daily }) {
  const max = Math.max(3, Math.ceil(Math.max(0, ...daily.flatMap(d => [d.books, d.users])) / 3) * 3)
  const x = i => 42 + i * 594 / Math.max(1, daily.length - 1)
  const y = value => 190 - value / max * 150
  return <svg className="admin-growth-chart" viewBox="0 0 660 230" role="img" aria-label="Biểu đồ số sách mới và tài khoản mới mỗi ngày, theo UTC">
    {[0, 1, 2, 3].map(i => <g key={i}><line x1="42" x2="636" y1={40 + i * 50} y2={40 + i * 50} className="admin-chart-grid" /><text x="30" y={44 + i * 50} textAnchor="end">{Number((max * (3 - i) / 3).toFixed(1))}</text></g>)}
    {['books', 'users'].map((key, k) => <g key={key}><polyline points={daily.map((d, i) => `${x(i)},${y(d[key])}`).join(' ')} fill="none" stroke={colors[k]} strokeWidth="3" strokeLinejoin="round" />{daily.map((d, i) => <circle key={d.date} cx={x(i)} cy={y(d[key])} r="4" fill={colors[k]} tabIndex="0"><title>{d.date}: {d[key]} {k ? 'tài khoản mới' : 'sách mới'}</title></circle>)}</g>)}
    {daily.map((d, i) => (i === 0 || i === daily.length - 1 || i % Math.ceil(daily.length / 6) === 0) && <text key={d.date} x={x(i)} y="217" textAnchor="middle">{d.date.slice(8)}/{d.date.slice(5, 7)}</text>)}
  </svg>
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [days, setDays] = useState(14)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    getStats(days).then(data => { if (active) setStats(data) }).catch(err => { if (active) setError(errorMessage(err)) })
    return () => { active = false }
  }, [days, attempt])
  const reload = () => { setError(''); setStats(null); setAttempt(a => a + 1) }
  const cards = stats ? [
    ['book', 'Sách & truyện', stats.total_books, 'Tất cả nội dung trong thư viện'],
    ['users', 'Thành viên', stats.total_users, 'Tài khoản đã đăng ký'],
    ['comment', 'Bình luận', stats.total_comments, 'Kết nối cộng đồng người đọc'],
    ['dashboard', 'Lịch sử đọc', stats.total_reads, 'Số bản ghi người dùng – sách'],
  ] : []
  return <>
    <div className="admin-page-heading"><div><p className="admin-eyebrow">GÓC NHÌN TỔNG QUAN</p><h1>Một thư viện, nhiều câu chuyện.</h1><p>Theo dõi nội dung và cộng đồng BookApp của bạn.</p></div><Link className="admin-button admin-primary" to="/admin/books/add">+ Thêm sách mới</Link></div>
    {error ? <div className="admin-error" role="alert">{error} <button onClick={reload}>Thử lại</button></div> : !stats ? <div className="admin-panel admin-loading" role="status">Đang tổng hợp dữ liệu thư viện…</div> : <>
      <div className="admin-stat-grid">{cards.map(([icon, label, value, hint], i) => <article className="admin-stat" key={label}><div className={`admin-stat-icon tone-${i}`}><AdminIcon name={icon} /></div><span>{label}</span><strong>{number(value)}</strong><small>{hint}</small></article>)}</div>
      <div className="admin-chart-layout"><section className="admin-panel"><div className="admin-panel-heading"><div><h2>Nhịp phát triển thư viện</h2><p>Sách & truyện mới và tài khoản mới · ngày UTC</p></div><select aria-label="Khoảng thời gian thống kê" value={days} onChange={e => { setStats(null); setError(''); setDays(Number(e.target.value)) }}>{[7, 14, 30].map(n => <option key={n} value={n}>{n} ngày qua</option>)}</select></div><div className="admin-chart-legend"><span style={{ '--legend': colors[0] }}>Sách & truyện mới</span><span style={{ '--legend': colors[1] }}>Thành viên mới</span></div><GrowthChart daily={stats.daily} />{!stats.daily.some(d => d.books || d.users) && <p className="admin-muted">Chưa có nội dung hoặc tài khoản mới trong thời gian này.</p>}</section>
      <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Sắc màu thư viện</h2><p>Phân bố thể loại · toàn bộ thời gian</p></div></div>{stats.total_books ? <><div className="admin-donut-wrap"><svg viewBox="0 0 160 160" role="img" aria-label="Phân bố sách theo thể loại"><circle cx="80" cy="80" r="60" fill="none" stroke="var(--admin-line)" strokeWidth="22" />{stats.genres.map((genre, i) => { const length = genre.count / stats.total_books * 100; const start = stats.genres.slice(0, i).reduce((sum, item) => sum + item.count, 0) / stats.total_books * 100; return <circle key={genre.name} cx="80" cy="80" r="60" fill="none" stroke={colors[i % colors.length]} strokeWidth="22" pathLength="100" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-start} transform="rotate(-90 80 80)"><title>{genre.name}: {genre.count} sách ({Math.round(length)}%)</title></circle> })}<text x="80" y="79" textAnchor="middle" className="admin-donut-number">{number(stats.total_books)}</text><text x="80" y="99" textAnchor="middle">tác phẩm</text></svg></div><ul className="admin-genre-list">{stats.genres.map((g, i) => <li key={g.name}><span style={{ '--legend': colors[i % colors.length] }}>{g.name}</span><strong>{g.count}</strong></li>)}</ul></> : <p className="admin-empty">Thêm sách để xem phân bố thể loại.</p>}</section></div>
      <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Những trang sách được mở</h2><p>Top 5 theo số người đọc riêng biệt · toàn bộ thời gian</p></div><Link className="admin-text-link" to="/admin/books">Quản lý thư viện →</Link></div>{stats.popular_books.some(b => b.readers > 0) ? <div className="admin-ranking">{stats.popular_books.filter(b => b.readers > 0).map((b, i) => <div className="admin-ranking-row" key={b.id}><span className="admin-rank">0{i + 1}</span><div><strong>{b.title}</strong><div className="admin-bar-track"><span style={{ width: `${b.readers / Math.max(1, ...stats.popular_books.map(v => v.readers)) * 100}%` }} /></div></div><span>{number(b.readers)} người đọc</span></div>)}</div> : <p className="admin-empty">Chưa có lịch sử đọc. Biểu đồ sẽ xuất hiện khi thành viên bắt đầu đọc sách.</p>}</section>
    </>}
  </>
}
