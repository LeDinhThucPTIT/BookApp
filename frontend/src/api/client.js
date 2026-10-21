import axios from 'axios'

const TOKEN_KEY = 'bookapp_token'

export function getToken() {
  try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setToken(token, remember = true) {
  try {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    if (token) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token)
  } catch { /* HTTP-only session cookie also supports browsers blocking storage. */ }
}

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 35000,
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function unwrap(response) {
  const payload = response.data
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data
  }
  return payload
}

export function errorMessage(err, fallback = 'Có lỗi xảy ra') {
  const details = err?.response?.data?.details
  if (err?.response?.status === 422 && Array.isArray(details)) {
    const names = { email: 'Email', username: 'Tên tài khoản', password: 'Mật khẩu', sdt: 'Số điện thoại', name: 'Họ tên' }
    return details.map((item) => {
      const field = item.loc?.at(-1)
      const label = names[field] || field || 'Thông tin'
      if (item.type === 'string_too_short') return `${label} cần ít nhất ${item.ctx?.min_length} ký tự.`
      if (item.type === 'string_too_long') return `${label} không được quá ${item.ctx?.max_length} ký tự.`
      if (field === 'email') return 'Địa chỉ email không hợp lệ.'
      if (field === 'sdt') return 'Số điện thoại cần có 10–11 chữ số.'
      return `${label}: ${item.msg || 'Dữ liệu không hợp lệ.'}`
    }).join(' ')
  }
  if (!err?.response && err?.code === 'ERR_NETWORK') return 'Không thể kết nối máy chủ. Vui lòng thử lại sau.'
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    fallback
  )
}
