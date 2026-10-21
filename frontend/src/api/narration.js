import { api, errorMessage } from './client'

export async function loadNarrationAudio({ bookId, page, chapterId, voice, segment = 0 }, signal) {
  try {
    const response = await api.get(`/books/${bookId}/audio`, {
      params: { page, chapter_id: chapterId || undefined, voice, segment },
      responseType: 'blob', signal, timeout: 65000,
    })
    if (!response.data.size || !response.headers['content-type']?.includes('audio/mpeg')) {
      throw new Error('Máy chủ chưa trả về âm thanh hợp lệ.')
    }
    const segments = Number(response.headers['x-audio-segments'])
    if (!Number.isInteger(segments) || segments < 1 || segments > 100) throw new Error('Danh sách đoạn đọc không hợp lệ. Hãy tải lại trang.')
    return { url: URL.createObjectURL(response.data), segments }
  } catch (err) {
    if (signal.aborted) throw err
    if (err.response?.data instanceof Blob) {
      try { err.response.data = JSON.parse(await err.response.data.text()) } catch { /* Use the fallback message. */ }
    }
    throw new Error(errorMessage(err, 'Không thể tải giọng đọc. Vui lòng thử lại.'))
  }
}
