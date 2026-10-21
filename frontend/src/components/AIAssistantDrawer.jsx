import { useEffect, useRef, useState } from 'react'
import { askAboutBook, summarizeContent } from '../api/ai'
import { errorMessage } from '../api/client'
import { createAnnotation } from '../api/reading-tools'

export default function AIAssistantDrawer(props) {
  return <DrawerContent key={`${props.bookId}:${props.pageNumber}:${props.currentContent}:${props.bookTitle}:${props.selectedText}:${props.initialTab}`} {...props} />
}

function DrawerContent({ isOpen, onClose, bookTitle, currentContent, bookId, pageNumber, selectedText = '', initialTab = 'summary', onSource }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [noteStatus, setNoteStatus] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // State cho Tóm tắt
  const [summaryData, setSummaryData] = useState(null)
  const [summarizing, setSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState(null)

  // State cho Chat hỏi đáp
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Bạn đang ở trang ${pageNumber + 1} của "${bookTitle || 'sách'}". Bạn muốn tìm hiểu điều gì về đoạn trích này?`,
    },
  ])
  const [questionText, setQuestionText] = useState(selectedText ? 'Giải thích đoạn văn được chọn.' : '')
  const [asking, setAsking] = useState(false)
  const [suggestions, setSuggestions] = useState([
    'Tóm tắt ngắn gọn diễn biến chính?',
    'Nhân vật chính đang đối mặt với thử thách gì?',
    'Ý nghĩa ẩn dụ của đoạn văn này là gì?',
  ])

  const chatEndRef = useRef(null)
  const drawerRef = useRef(null)
  const requestScope = useRef(0)
  const messageId = useRef(0)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])

  useEffect(() => () => { requestScope.current += 1 }, [])

  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawerRef.current?.querySelector('button')?.focus()
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current()
      }
      if (event.key !== 'Tab') return
      const controls = [...drawerRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')]
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', handleKey, true)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey, true)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [isOpen])

  // Tự động cuộn xuống tin nhắn mới nhất trong chat
  useEffect(() => {
    if (activeTab === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, activeTab, asking])

  // Xử lý Tóm tắt nội dung
  const handleSummarize = async () => {
    if (summarizing) return
    const scope = requestScope.current
    if (!currentContent || currentContent.trim().length < 10) {
      setSummaryError('Không tìm thấy nội dung văn bản trên trang hiện tại để tóm tắt.')
      return
    }

    try {
      setSummarizing(true)
      setSummaryError(null)
      const data = await summarizeContent({
        bookId,
        content: currentContent,
        title: bookTitle,
        chapterName: `Trang ${pageNumber + 1}`,
        page: pageNumber,
        selectedText,
      })
      if (scope === requestScope.current) setSummaryData(data)
    } catch (err) {
      if (scope === requestScope.current) setSummaryError(errorMessage(err, 'Không thể tóm tắt nội dung lúc này. Vui lòng thử lại.'))
    } finally {
      if (scope === requestScope.current) setSummarizing(false)
    }
  }

  // Xử lý gửi câu hỏi chat
  const handleSendQuestion = async (customQ) => {
    const q = (customQ || questionText).trim()
    if (!q || asking) return
    const scope = requestScope.current

    const userMsg = {
      id: `message-${++messageId.current}`,
      sender: 'user',
      text: q,
    }

    setMessages((prev) => [...prev, userMsg])
    setQuestionText('')
    setAsking(true)

    try {
      const data = await askAboutBook({
        bookId,
        question: q,
        context: currentContent || 'Nội dung cuốn sách',
        title: bookTitle,
        page: pageNumber,
        selectedText,
        history: messages.filter((message) => message.id !== 'welcome' && !message.isError).slice(-12).map((message) => ({ role: message.sender === 'user' ? 'user' : 'assistant', content: message.text.slice(0, 3000) })),
      })
      if (scope !== requestScope.current) return

      const aiMsg = {
        id: `message-${++messageId.current}`,
        sender: 'ai',
        text: data.answer,
        isMock: data.is_mock,
        citations: data.citations || [],
      }

      setMessages((prev) => [...prev, aiMsg])
      if (Array.isArray(data.suggested_questions) && data.suggested_questions.length > 0) {
        setSuggestions(data.suggested_questions)
      }
    } catch (err) {
      if (scope !== requestScope.current) return
      const errorMsg = {
        id: `message-${++messageId.current}`,
        sender: 'ai',
        text: errorMessage(err, 'Không thể gửi câu hỏi. Vui lòng thử lại.'),
        isError: true,
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      if (scope === requestScope.current) setAsking(false)
    }
  }

  if (!isOpen) return null

  const saveAnswer = async (message) => {
    if (savingNote) return
    const quote = message.citations?.[0]?.quote || selectedText || currentContent.slice(0, 180)
    const start = currentContent.indexOf(quote)
    if (start < 0 || !quote) return
    setSavingNote(true)
    setNoteStatus('')
    try {
      await createAnnotation(bookId, { page: pageNumber, quote, start_offset: start, end_offset: start + quote.length, color: 'green', note: `Ghi chú AI:\n${message.text}`.slice(0, 10000) })
      setNoteStatus('Đã lưu câu trả lời vào ghi chú của bạn.')
      window.dispatchEvent(new CustomEvent('bookapp:annotations-changed', { detail: { bookId } }))
    } catch (err) {
      setNoteStatus(errorMessage(err, 'Không lưu được ghi chú.'))
    } finally { setSavingNote(false) }
  }

  return (
    <>
      {/* Overlay mờ nền phía sau Drawer */}
      <div className={`ai-drawer-overlay ${isOpen ? 'active' : ''}`} onClick={onClose}></div>

      <aside ref={drawerRef} role="dialog" aria-modal="true" className={`ai-drawer ${isOpen ? 'open' : ''}`} aria-label="Trợ lý AI Đọc sách">
      {/* Header Drawer */}
      <div className="ai-drawer-header">
        <div className="ai-title-wrap">
          <span className="ai-sparkle-icon">✨</span>
          <div>
            <h3>Trợ lý Sách AI</h3>
            <span className="ai-model-tag">Google Gemini Powered</span>
          </div>
        </div>
        <button type="button" className="close-ai-btn" onClick={onClose} aria-label="Đóng Trợ lý AI">
          ✕
        </button>
      </div>

      {selectedText && <div className="ai-selected-source"><strong>Đang hỏi về đoạn đã chọn · Trang {pageNumber + 1}</strong><blockquote>{selectedText}</blockquote></div>}
      {noteStatus && <div className="ai-note-status" role="status">{noteStatus}</div>}

      {/* Tabs chuyển đổi */}
      <div className="ai-tabs">
        <button
          type="button"
          className={`ai-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          <i className="fa-solid fa-wand-magic-sparkles"></i>
          <span>Tóm tắt trang</span>
        </button>
        <button
          type="button"
          className={`ai-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <i className="fa-regular fa-comments"></i>
          <span>Hỏi đáp cùng AI</span>
        </button>
      </div>

      {/* ==================== TAB 1: TÓM TẮT ==================== */}
      {activeTab === 'summary' && (
        <div className="ai-tab-content summary-tab">
          <div className="summary-action-banner">
            <p className="summary-hint">
              Đang xem <strong>Trang {pageNumber + 1}</strong> của cuốn <em>"{bookTitle || 'sách'}"</em>. Nhấn để AI phân tích cốt truyện:
            </p>
            <button
              type="button"
              className="generate-summary-btn"
              onClick={handleSummarize}
              disabled={summarizing}
            >
              <i className="fa-solid fa-bolt"></i>
              <span>{summarizing ? 'Đang đọc và phân tích...' : '✨ Tóm tắt trang hiện tại'}</span>
            </button>
          </div>

          {summaryError && (
            <div className="ai-error-box">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{summaryError}</span>
            </div>
          )}

          {summarizing && (
            <div className="ai-loading-skeleton">
              <div className="skeleton-bar short"></div>
              <div className="skeleton-bar full"></div>
              <div className="skeleton-bar full"></div>
              <div className="skeleton-bar medium"></div>
              <p className="loading-text">Gemini AI đang đúc kết ý chính cho bạn...</p>
            </div>
          )}

          {summaryData && !summarizing && (
            <div className="summary-result-card">
              {summaryData.is_mock && (
                <div className="mock-ai-notice">
                  <i className="fa-solid fa-circle-info"></i>
                  <span>Bản tóm tắt tự động. Bạn có thể thêm <code>GEMINI_API_KEY</code> vào <code>backend/.env</code> để kích hoạt Google Gemini Pro.</span>
                </div>
              )}

              {/* Tóm tắt chính */}
              <div className="summary-section">
                <h4 className="section-title">
                  <i className="fa-solid fa-align-left"></i> Tóm lược nội dung
                </h4>
                <p className="summary-text">{summaryData.summary}</p>
              </div>

              {/* Ý chính cốt lõi */}
              {summaryData.key_points && summaryData.key_points.length > 0 && (
                <div className="summary-section">
                  <h4 className="section-title">
                    <i className="fa-solid fa-list-check"></i> Điểm nổi bật quan trọng
                  </h4>
                  <ul className="key-points-list">
                    {summaryData.key_points.map((point, idx) => (
                      <li key={idx}>
                        <span className="point-bullet">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Nhân vật xuất hiện */}
              {summaryData.characters && summaryData.characters.length > 0 && (
                <div className="summary-section">
                  <h4 className="section-title">
                    <i className="fa-solid fa-user-group"></i> Nhân vật / Đối tượng
                  </h4>
                  <div className="characters-wrap">
                    {summaryData.characters.map((char, idx) => (
                      <span key={idx} className="character-tag">
                        {char}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Bài học / Thông điệp */}
              {summaryData.takeaway && (
                <div className="summary-section takeaway-box">
                  <h4 className="section-title">
                    <i className="fa-solid fa-lightbulb"></i> Thông điệp cốt lõi
                  </h4>
                  <p className="takeaway-text">"{summaryData.takeaway}"</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: HỎI ĐÁP CHAT ==================== */}
      {activeTab === 'chat' && (
        <div className="ai-tab-content chat-tab">
          {/* Vùng tin nhắn */}
          <div className="ai-messages-list" role="log" aria-live="polite" aria-relevant="additions">
            {messages.map((m) => (
              <div key={m.id} className={`ai-message ${m.sender}`}>
                {m.sender === 'ai' && (
                  <div className="ai-msg-avatar" title="Trợ lý Gemini">
                    <span>✨</span>
                  </div>
                )}
                <div className="ai-msg-bubble">
                  <p>{m.text}</p>
                  {m.sender === 'ai' && m.id !== 'welcome' && !m.isError && !m.citations?.length && <small>AI chưa cung cấp trích dẫn trực tiếp cho câu trả lời này.</small>}
                  {m.citations?.map((citation, index) => <button type="button" className="ai-source-citation" key={index} onClick={() => onSource?.(citation.page ?? pageNumber)}>
                    <span>{citation.chapter_title ? `${citation.chapter_title} · ` : ''}Trang {(citation.page ?? pageNumber) + 1}</span>
                    <q>{citation.quote}</q>
                  </button>)}
                  {m.sender === 'ai' && m.id !== 'welcome' && !m.isError && <button className="ai-save-note" type="button" disabled={savingNote} onClick={() => saveAnswer(m)}>Lưu vào ghi chú</button>}
                </div>
              </div>
            ))}

            {asking && (
              <div className="ai-message ai thinking">
                <div className="ai-msg-avatar">
                  <span>✨</span>
                </div>
                <div className="ai-msg-bubble typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Gợi ý câu hỏi nhanh (Quick Chips) */}
          {suggestions.length > 0 && !asking && (
            <div className="ai-suggestions-bar">
              <span className="suggestions-label">Gợi ý câu hỏi:</span>
              <div className="suggestions-scroll">
                {suggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="suggestion-chip"
                    onClick={() => handleSendQuestion(sug)}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Khung nhập tin nhắn */}
          <form
            className="ai-chat-input-box"
            onSubmit={(e) => {
              e.preventDefault()
              handleSendQuestion()
            }}
          >
            <input
              type="text"
              className="ai-input"
              placeholder="Đặt câu hỏi về đoạn trích này..."
              aria-label="Câu hỏi về trang sách"
              maxLength={2000}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              disabled={asking}
            />
            <button
              type="submit"
              className="ai-send-btn"
              disabled={asking || !questionText.trim()}
              title="Gửi câu hỏi"
            >
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </form>
        </div>
      )}
    </aside>
    </>
  )
}
