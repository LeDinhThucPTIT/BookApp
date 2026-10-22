import { api, clearLegacyToken, unwrap } from './client'

export async function login(email, password, remember = true) {
  const data = unwrap(await api.post('/auth/login', { email, password, remember }))
  clearLegacyToken()
  return data
}

export async function register(payload) {
  return unwrap(await api.post('/auth/register', payload))
}

export async function logout() {
  try {
    await api.post('/auth/logout')
  } finally {
    clearLegacyToken()
  }
}

export async function me() {
  return unwrap(await api.get('/auth/me'))
}

export async function sendOtp(email_or_phone) {
  return unwrap(await api.post('/auth/forgot/send-otp', { email_or_phone }))
}

export async function verifyOtp(otp, new_pass, reset_token) {
  return unwrap(await api.post('/auth/forgot/verify', { otp, new_pass, reset_token }))
}
