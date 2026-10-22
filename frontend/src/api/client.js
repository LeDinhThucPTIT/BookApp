import axios from 'axios'

export function clearLegacyToken() {
  try {
    localStorage.removeItem('bookapp_token')
    sessionStorage.removeItem('bookapp_token')
  } catch { /* Cookies work even when web storage is unavailable. */ }
}

clearLegacyToken()

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 35000,
})

api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401 && !error.config?.url?.startsWith('/auth/')) {
    window.dispatchEvent(new Event('bookapp:session-expired'))
  }
  return Promise.reject(error)
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
