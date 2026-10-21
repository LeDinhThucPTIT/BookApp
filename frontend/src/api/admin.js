import { api, unwrap } from './client'

export async function getStats(days = 14) {
  return unwrap(await api.get('/admin/stats', { params: { days } }))
}

export async function adminListBooks() {
  return unwrap(await api.get('/admin/books'))
}

export async function adminAddBook(formData) {
  return unwrap(
    await api.post('/admin/books', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  )
}

export async function adminDeleteBook(bookId) {
  return unwrap(await api.delete(`/admin/books/${bookId}`))
}

export async function adminListUsers() {
  return unwrap(await api.get('/admin/users'))
}

export async function adminDeleteUser(userId) {
  return unwrap(await api.delete(`/admin/users/${userId}`))
}

export async function adminListComments() {
  return unwrap(await api.get('/admin/comments'))
}

export async function adminDeleteComment(commentId) {
  return unwrap(await api.delete(`/admin/comments/${commentId}`))
}
