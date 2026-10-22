import { api, unwrap } from './client'

export async function listBooks() {
  return unwrap(await api.get('/books'))
}

export async function getCatalog(params = {}, signal) {
  return unwrap(await api.get('/books/catalog', { params, signal }))
}

export async function getBook(bookId) {
  return unwrap(await api.get(`/books/${bookId}`))
}

export async function getBookContent(bookId, chapterId) {
  return unwrap(await api.get(`/books/${bookId}/content`, { params: chapterId ? { chapter_id: chapterId } : {} }))
}

export async function myUploads() {
  return unwrap(await api.get('/books/me'))
}

export async function uploadBook(formData) {
  return unwrap(
    await api.post('/books', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  )
}

export async function deleteBook(bookId) {
  return unwrap(await api.delete(`/books/${bookId}`))
}
