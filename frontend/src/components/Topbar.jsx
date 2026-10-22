import { Link } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { useTheme } from '../context/theme-context'
import { DEFAULT_AVATAR, mediaUrl } from '../utils/media'

export default function Topbar({ search, onSearchChange }) {
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()

  return (
    <div className="Tophar">
      <div className="tophar-left">
        <div className="Search-button">
          <img src="/images/Logo/Search.png" alt="Tìm kiếm" />
        </div>
        <div className="Search-input">
          <input
            type="text"
            aria-label="Tìm sách theo tên hoặc tác giả"
            className="Search-input-text"
            placeholder="Tìm sách, tên tác giả…"
            maxLength={200}
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </div>
      </div>
      <div className="tophar-right">
        <button type="button" className="app-theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'} title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'} aria-pressed={theme === 'dark'}>
          <i aria-hidden="true" className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
        </button>
        <div className="button language tophar-language">
          <span className="text">VN</span>
          <img src="/images/Logo/Image VN.png" alt="VN" className="icon flag" />
        </div>
        <div className="tophar-user">
          <Link to="/setting">
            <img
              src={mediaUrl(user?.avatar, DEFAULT_AVATAR)}
              alt="avatar"
              className="topbar-user-avatar"
            />
            <span className="topbar-user-name">{user?.username}</span>
          </Link>
        </div>
        <div className="topbar-notify">
          <img src="/images/Logo/Bell.png" alt="notify" className="topbar-notify-icon" />
        </div>
      </div>
    </div>
  )
}
