import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { updateProfile } from '../api/users'
import { useAuth } from '../context/AuthContext'
import { DEFAULT_AVATAR, mediaUrl } from '../utils/media'

export default function SettingPage() {
  const { user, logout, setUser } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    name: '',
    ngaysinh: '',
    sex: 'Nam',
  })
  const [avatarFile, setAvatarFile] = useState(null)
  const [preview, setPreview] = useState(DEFAULT_AVATAR)

  useEffect(() => {
    if (!user) return
    setForm({
      username: user.username || '',
      name: user.name || '',
      ngaysinh: user.ngaysinh || '',
      sex: user.sex || 'Nam',
    })
    setPreview(mediaUrl(user.avatar, '/images/Logo/Avatar2.png'))
  }, [user])

  const onSubmit = async (e) => {
    e.preventDefault()
    const data = new FormData()
    data.append('username', form.username)
    data.append('name', form.name)
    if (form.ngaysinh) data.append('ngaysinh', form.ngaysinh)
    if (form.sex) data.append('sex', form.sex)
    if (avatarFile) data.append('avatar', avatarFile)
    try {
      const updated = await updateProfile(data)
      setUser(updated)
      alert('Cập nhật hồ sơ thành công!')
    } catch (err) {
      alert(errorMessage(err, 'Không thể cập nhật hồ sơ'))
    }
  }

  return (
    <main className="Main">
      <form className="profile-container" onSubmit={onSubmit}>
        <div className="profile-left">
          <div className="input-group">
            <label>Email</label>
            <input type="email" value={user?.email || ''} readOnly />
          </div>
          <div className="input-group">
            <label>Mật khẩu</label>
            <input type="password" value="********" readOnly />
          </div>
          <div className="input-group">
            <label>Tên tài khoản</label>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          </div>
          <div className="input-group">
            <label>Họ và tên</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="input-row">
            <div className="input-group small">
              <label>Ngày sinh</label>
              <div className="input-with-icon">
                <input type="date" value={form.ngaysinh || ''} onChange={(e) => setForm({ ...form, ngaysinh: e.target.value })} />
              </div>
            </div>
            <div className="input-group small">
              <label>Giới tính</label>
              <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn confirm-btn">Xác nhận</button>
        </div>
        <div className="profile-right">
          <div className="avatar">
            <img id="avatar-preview" src={preview} alt="avatar" />
          </div>
          <input
            type="file"
            id="avatar"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              setAvatarFile(file || null)
              if (file) setPreview(URL.createObjectURL(file))
            }}
          />
          <button type="button" className="btn" onClick={() => document.getElementById('avatar').click()}>
            Thay ảnh
          </button>
          <button
            type="button"
            className="btn logout-btn"
            onClick={async () => {
              await logout()
              navigate('/', { replace: true })
            }}
          >
            Đăng xuất
          </button>
        </div>
        <Link to="/upload">
          <button type="button" className="upload">
            <i className="fa-solid fa-upload"></i>
            <span className="text">Tải lên</span>
          </button>
        </Link>
      </form>
    </main>
  )
}
