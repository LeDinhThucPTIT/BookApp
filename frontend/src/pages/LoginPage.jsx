import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as authApi from '../api/auth'
import { errorMessage } from '../api/client'
import PasswordToggle from '../components/PasswordToggle'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState('login') // 'login' | 'register' | 'forgot'
  const [otpReady, setOtpReady] = useState(false)
  const [resetToken, setResetToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState(null)
  const [remember, setRemember] = useState(true)
  const notify = (message, type = 'error') => setNotice({ message, type })
  const changeView = (next) => {
    if (loading) return
    setNotice(null)
    setShowPassword({})
    setView(next)
  }

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState({
    name: '',
    username: '',
    email: '',
    sdt: '',
    password: '',
    repassword: '',
  })
  const [forgotForm, setForgotForm] = useState({
    email_or_phone: '',
    otp: '',
    new_pass: '',
    confirm: '',
  })
  const [showPassword, setShowPassword] = useState({})

  const toggleType = (key) =>
    setShowPassword((prev) => ({ ...prev, [key]: !prev[key] }))

  const onLogin = async (e) => {
    e.preventDefault()
    if (loading) return
    setNotice(null)
    if (!loginForm.email.trim() || !loginForm.password) {
      notify('⚠️ Vui lòng nhập đầy đủ email và mật khẩu!')
      return
    }
    try {
      setLoading(true)
      const data = await login(loginForm.email.trim(), loginForm.password, remember)
      const target = data.user?.role === 'admin' ? '/admin' : '/home'
      navigate(target, { replace: true })
    } catch (err) {
      notify(`❌ ${errorMessage(err, 'Đăng nhập thất bại')}`)
    } finally {
      setLoading(false)
    }
  }

  const onRegister = async (e) => {
    e.preventDefault()
    if (loading) return
    setNotice(null)
    if (!registerForm.name.trim() || !registerForm.username.trim() || !registerForm.email.trim()) {
      notify('⚠️ Vui lòng điền đầy đủ các thông tin bắt buộc!')
      return
    }
    if (!registerForm.password || registerForm.password.length < 6) {
      notify('⚠️ Mật khẩu phải có ít nhất 6 ký tự!')
      return
    }
    if (registerForm.password !== registerForm.repassword) {
      notify('❌ Mật khẩu nhập lại không khớp!')
      return
    }
    try {
      setLoading(true)
      await authApi.register({
        name: registerForm.name.trim(),
        username: registerForm.username.trim(),
        email: registerForm.email.trim(),
        sdt: registerForm.sdt.trim(),
        password: registerForm.password,
      })
      setLoginForm({ email: registerForm.email.trim(), password: '' })
      setRegisterForm({ name: '', username: '', email: '', sdt: '', password: '', repassword: '' })
      setView('login')
      setShowPassword({})
      notify('Đăng ký thành công! Bạn có thể đăng nhập ngay.', 'success')
    } catch (err) {
      notify(`❌ ${errorMessage(err, 'Đăng ký thất bại')}`)
    } finally {
      setLoading(false)
    }
  }

  const onSendOtp = async () => {
    if (loading) return
    setNotice(null)
    if (!forgotForm.email_or_phone.trim()) {
      notify('⚠️ Vui lòng nhập email hoặc số điện thoại!')
      return
    }
    try {
      setLoading(true)
      const data = await authApi.sendOtp(forgotForm.email_or_phone.trim())
      setResetToken(data?.reset_token || '')
      notify('Mã OTP đã được gửi! Vui lòng kiểm tra hộp thư của bạn.', 'success')
      setOtpReady(true)
    } catch (err) {
      notify(errorMessage(err, 'Không thể gửi OTP'))
    } finally {
      setLoading(false)
    }
  }

  const onVerifyOtp = async () => {
    if (loading) return
    setNotice(null)
    if (!forgotForm.otp.trim() || !forgotForm.new_pass || !forgotForm.confirm) {
      notify('⚠️ Vui lòng nhập đầy đủ mã OTP và mật khẩu mới!')
      return
    }
    if (forgotForm.new_pass.length < 6) {
      notify('⚠️ Mật khẩu mới phải có ít nhất 6 ký tự!')
      return
    }
    if (forgotForm.new_pass !== forgotForm.confirm) {
      notify('❌ Mật khẩu xác nhận không khớp!')
      return
    }
    try {
      setLoading(true)
      await authApi.verifyOtp(forgotForm.otp.trim(), forgotForm.new_pass, resetToken)
      setView('login')
      notify('Cập nhật mật khẩu thành công! Bạn có thể đăng nhập ngay.', 'success')
      setOtpReady(false)
      setResetToken('')
      setForgotForm({ email_or_phone: '', otp: '', new_pass: '', confirm: '' })
    } catch (err) {
      notify(errorMessage(err, 'Không thể đặt lại mật khẩu'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-backdrop-overlay"></div>

      {/* Nút đổi ngôn ngữ */}
      <div className="button language login-language">
        <span className="text">VN</span>
        <img src="/images/Logo/Image VN.png" alt="VN" className="icon flag" />
      </div>

      <div className="auth-card-wrapper">
        {/* ==================== FORM ĐĂNG NHẬP ==================== */}
        {view === 'login' && (
          <div className="login-container box" id="loginContainer">
            {notice && <div className={`auth-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.message}</div>}
            <div className="auth-header">
              <h2>Đăng nhập</h2>
              <p className="auth-subtitle">Chào mừng bạn quay trở lại với BookApp!</p>
            </div>

            <div className="social-buttons">
              <button type="button" className="login-btn google" disabled title="Đăng nhập Google chưa được hỗ trợ">
                <img src="/images/Logo/Google.png" alt="Google" className="icon logo" />
                <span>Google · Sắp có</span>
              </button>
              <button type="button" className="login-btn facebook" disabled title="Đăng nhập Facebook chưa được hỗ trợ">
                <img src="/images/Logo/facebook.png" alt="Facebook" className="icon logo" />
                <span>Facebook · Sắp có</span>
              </button>
            </div>
            <div className="divider"><span>Hoặc bằng email</span></div>
            <form onSubmit={onLogin} className="auth-form">
              <div className="input-box email">
                <label htmlFor="login-email">Email</label>
                <div className="input-wrapper">
                  <input
                    type="email"
                    id="login-email"
                    maxLength={100}
                    name="email"
                    autoComplete="username"
                    placeholder="name@example.com"
                    required
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="input-box password">
                <label htmlFor="login-password">Mật khẩu</label>
                <div className="input-wrapper">
                  <input
                    type={showPassword.login ? 'text' : 'password'}
                    id="login-password"
                    maxLength={128}
                    name="password"
                    autoComplete="current-password"
                    placeholder="Nhập mật khẩu"
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  />
                  <PasswordToggle
                    inputType={showPassword.login ? 'text' : 'password'}
                    onToggle={() => toggleType('login')}
                  />
                </div>
              </div>

              <div className="options">
                <label className="checkbox-custom">
                  <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                  <span className="checkmark"></span>
                  Ghi nhớ đăng nhập
                </label>
                <a
                  href="#forgot"
                  id="forgotPassword"
                  onClick={(e) => {
                    e.preventDefault()
                    changeView('forgot')
                  }}
                >
                  Quên mật khẩu?
                </a>
              </div>

              <button type="submit" className="login submit" disabled={loading}>
                {loading ? 'Đang xử lý...' : 'Đăng nhập'}
              </button>
            </form>

            <p className="signup-text">
              Chưa có tài khoản?{' '}
              <a
                href="#register"
                onClick={(e) => {
                  e.preventDefault()
                  changeView('register')
                }}
              >
                Đăng ký ngay
              </a>
            </p>
          </div>
        )}

        {/* ==================== FORM ĐĂNG KÝ ==================== */}
        {view === 'register' && (
          <div className="register-container box" id="registerContainer">
            {notice && <div className={`auth-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.message}</div>}
            <div className="auth-header text">
              <h2>Đăng ký tài khoản</h2>
              <p className="auth-subtitle">Cùng khám phá kho sách phong phú mỗi ngày</p>
            </div>

            <form id="registerForm" onSubmit={onRegister} className="auth-form">
              <div className="input-row-2">
                <div className="input-box name">
                  <label htmlFor="reg-name">Họ và tên</label>
                  <div className="input-wrapper">
                    <input
                      id="reg-name"
                    maxLength={100}
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder="Nguyễn Văn A"
                      required
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="input-box username">
                  <label htmlFor="reg-username">Tên tài khoản</label>
                  <div className="input-wrapper">
                    <input
                      id="reg-username"
                      minLength={2}
                    maxLength={50}
                      name="username"
                      type="text"
                      autoComplete="username"
                      placeholder="username123"
                      required
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="input-row-2">
                <div className="input-box email">
                  <label htmlFor="reg-email">Email</label>
                  <div className="input-wrapper">
                    <input
                      id="reg-email"
                    maxLength={100}
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@gmail.com"
                      required
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="input-box phonenumber">
                  <label htmlFor="reg-sdt">Số điện thoại</label>
                  <div className="input-wrapper">
                    <input
                      id="reg-sdt"
                      name="tel"
                      type="tel"
                      autoComplete="tel"
                      placeholder="0912 345 678"
                      value={registerForm.sdt}
                      onChange={(e) => setRegisterForm({ ...registerForm, sdt: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="input-box password">
                <label htmlFor="reg-pass">Mật khẩu</label>
                <div className="input-wrapper">
                  <input
                    id="reg-pass"
                    minLength={6}
                    maxLength={128}
                    name="new-password"
                    type={showPassword.reg ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Tối thiểu 6 ký tự"
                    required
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  />
                  <PasswordToggle
                    inputType={showPassword.reg ? 'text' : 'password'}
                    onToggle={() => toggleType('reg')}
                  />
                </div>
              </div>

              <div className="input-box password confirm">
                <label htmlFor="reg-repass">Nhập lại mật khẩu</label>
                <div className="input-wrapper">
                  <input
                    id="reg-repass"
                    maxLength={128}
                    name="confirm-password"
                    type={showPassword.re ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Nhập lại mật khẩu trên"
                    required
                    value={registerForm.repassword}
                    onChange={(e) => setRegisterForm({ ...registerForm, repassword: e.target.value })}
                  />
                  <PasswordToggle
                    inputType={showPassword.re ? 'text' : 'password'}
                    onToggle={() => toggleType('re')}
                  />
                </div>
              </div>

              <button type="submit" className="register submit" disabled={loading}>
                {loading ? 'Đang tạo tài khoản...' : 'Đăng ký tài khoản'}
              </button>
            </form>

            <p className="signin-text">
              Đã có tài khoản?{' '}
              <a
                href="#login"
                onClick={(e) => {
                  e.preventDefault()
                  changeView('login')
                }}
              >
                Đăng nhập ngay
              </a>
            </p>
          </div>
        )}

        {/* ==================== FORM QUÊN MẬT KHẨU ==================== */}
        {view === 'forgot' && (
          <div className="forgot-password box" id="forgotContainer">
            {notice && <div className={`auth-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.message}</div>}
            <div className="auth-header text">
              <h2>Quên mật khẩu</h2>
              <p className="auth-subtitle">
                Nhập email hoặc số điện thoại liên kết để nhận mã xác thực OTP
              </p>
            </div>

            <form id="forgotForm" onSubmit={(e) => e.preventDefault()} className="auth-form">
              <div className="input-box email-or-phone">
                <label htmlFor="forgot-identifier">Email hoặc số điện thoại</label>
                <div className="input-wrapper">
                  <input
                    id="forgot-identifier"
                    type="text"
                    autoComplete="username"
                    placeholder="Nhập email hoặc số điện thoại của bạn"
                    value={forgotForm.email_or_phone}
                    onChange={(e) => setForgotForm({ ...forgotForm, email_or_phone: e.target.value })}
                    disabled={otpReady}
                  />
                </div>
              </div>

              {!otpReady && (
                <button
                  type="button"
                  className="register submit"
                  onClick={onSendOtp}
                  disabled={loading}
                >
                  {loading ? 'Đang gửi...' : 'Gửi mã xác nhận OTP'}
                </button>
              )}

              {otpReady && (
                <div id="otp-section" className="otp-container">
                  <div className="input-box otp">
                    <label htmlFor="forgot-otp">Mã xác nhận OTP (6 số)</label>
                    <div className="input-wrapper">
                      <input
                        id="forgot-otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder="• • • • • •"
                        className="otp-input"
                        value={forgotForm.otp}
                        onChange={(e) =>
                          setForgotForm({ ...forgotForm, otp: e.target.value.replace(/\D/g, '') })
                        }
                      />
                    </div>
                  </div>

                  <div className="input-box password forgot-password">
                    <label htmlFor="forgot-newpass">Mật khẩu mới</label>
                    <div className="input-wrapper">
                      <input
                        id="forgot-newpass"
                    maxLength={128}
                        type={showPassword.forgot_new ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Tối thiểu 6 ký tự"
                        value={forgotForm.new_pass}
                        onChange={(e) => setForgotForm({ ...forgotForm, new_pass: e.target.value })}
                      />
                      <PasswordToggle
                        inputType={showPassword.forgot_new ? 'text' : 'password'}
                        onToggle={() => toggleType('forgot_new')}
                      />
                    </div>
                  </div>

                  <div className="input-box password forgot-password-confirm">
                    <label htmlFor="forgot-confirm">Nhập lại mật khẩu mới</label>
                    <div className="input-wrapper">
                      <input
                        id="forgot-confirm"
                    maxLength={128}
                        type={showPassword.forgot_confirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Xác nhận mật khẩu mới"
                        value={forgotForm.confirm}
                        onChange={(e) => setForgotForm({ ...forgotForm, confirm: e.target.value })}
                      />
                      <PasswordToggle
                        inputType={showPassword.forgot_confirm ? 'text' : 'password'}
                        onToggle={() => toggleType('forgot_confirm')}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="register submit"
                    onClick={onVerifyOtp}
                    disabled={loading}
                  >
                    {loading ? 'Đang cập nhật...' : 'Xác nhận đổi mật khẩu'}
                  </button>
                </div>
              )}

              <p className="forgot-password-text">
                <a
                  href="#login"
                  onClick={(e) => {
                    e.preventDefault()
                    changeView('login')
                  }}
                >
                  ← Quay lại Đăng nhập
                </a>
                <span className="dot-divider">•</span>
                <a
                  href="#register"
                  onClick={(e) => {
                    e.preventDefault()
                    changeView('register')
                  }}
                >
                  Đăng ký tài khoản
                </a>
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
