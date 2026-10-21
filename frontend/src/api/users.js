import { api, unwrap } from './client'

export async function getProfile() {
  return unwrap(await api.get('/users/me'))
}

export async function updateProfile(formData) {
  return unwrap(
    await api.put('/users/me', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  )
}
