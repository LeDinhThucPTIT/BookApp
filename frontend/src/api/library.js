import { api, unwrap } from './client'

export async function getLibraryPage(params = {}, signal) {
  return unwrap(await api.get('/library', { params, signal }))
}

export async function getCommentsPage(bookId, page = 1) {
  return unwrap(await api.get(`/books/${bookId}/comments/page`, { params: { page, page_size: 20 } }))
}

export async function getProgress(bookId) {
  return unwrap(await api.get(`/books/${bookId}/progress`))
}

export async function saveProgress(bookId, progress) {
  return unwrap(await api.put(`/books/${bookId}/progress`, progress))
}

export async function getFavorite(bookId) {
  return unwrap(await api.get(`/books/${bookId}/favorite`))
}

export async function toggleFavorite(bookId) {
  return unwrap(await api.post(`/books/${bookId}/favorite`))
}

export async function getSave(bookId) {
  return unwrap(await api.get(`/books/${bookId}/save`))
}

export async function toggleSave(bookId) {
  return unwrap(await api.post(`/books/${bookId}/save`))
}

export async function listSaves() {
  return unwrap(await api.get('/saves'))
}

export async function removeSave(bookId) {
  return unwrap(await api.post('/saves/remove', { book_id: Number(bookId) }))
}

export async function removeFavorite(bookId) {
  return unwrap(await api.post('/favorites/remove', { book_id: Number(bookId) }))
}

export async function listComments(bookId) {
  return unwrap(await api.get(`/books/${bookId}/comments`))
}

export async function addComment(bookId, content) {
  return unwrap(await api.post(`/books/${bookId}/comments`, { content }))
}

export async function getRating(bookId) {
  return unwrap(await api.get(`/books/${bookId}/rating`))
}

export async function setRating(bookId, stars) {
  return unwrap(await api.post(`/books/${bookId}/rating`, { stars }))
}

export async function saveHistory(bookId) {
  return unwrap(await api.post('/history', { book_id: Number(bookId) }))
}

export async function listHistory() {
  return unwrap(await api.get('/history'))
}

export async function deleteHistory(bookId) {
  return unwrap(await api.delete(`/history/${bookId}`))
}
