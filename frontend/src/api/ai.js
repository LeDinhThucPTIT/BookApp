import { api, unwrap } from './client'

/**
 * Tóm tắt nội dung chương hoặc trang sách bằng Gemini AI
 */
export async function summarizeContent({ bookId, content, title, chapterName, page, selectedText }) {
  return unwrap(
    await api.post('/ai/summarize', {
      book_id: bookId ? Number(bookId) : undefined,
      content,
      title,
      chapter_name: chapterName,
      page,
      selected_text: selectedText || undefined,
    })
  )
}

/**
 * Hỏi đáp giải đáp thắc mắc về sách bằng Gemini AI
 */
export async function askAboutBook({ bookId, question, context, title, page, selectedText, history }) {
  return unwrap(
    await api.post('/ai/ask', {
      book_id: bookId ? Number(bookId) : undefined,
      question,
      context,
      title,
      page,
      selected_text: selectedText || undefined,
      history,
    })
  )
}
