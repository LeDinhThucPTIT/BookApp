import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getBookContent } from '../api/books'
import { getSave, saveHistory, toggleSave, getProgress } from '../api/library'
import { errorMessage } from '../api/client'
import { useReaderProgress } from '../hooks/useReaderProgress'
import { useAuth } from '../context/auth-context'
import { useTheme } from '../context/theme-context'
import { paginateText, restorePage, restoreReadingPage, validProgress, expandReaderBook, chooseReadingProgress } from '../utils/reader'
import Sidebar from '../components/Sidebar'
import { mediaUrl } from '../utils/media'
import AIAssistantDrawer from '../components/AIAssistantDrawer'
import ReadingPageTools from '../components/ReadingPageTools'
import NarrationPlayer from '../components/NarrationPlayer'
import '../styles/ai-drawer.css';
// Hàm chia trang thông minh từ text
function splitPages(html) {
  if (!html) return []
  const document = new DOMParser().parseFromString(html, 'text/html')
  document.querySelectorAll('script, style, iframe, object').forEach((node) => node.remove())
  document.querySelectorAll('br').forEach((node) => node.replaceWith('\n'))
  document.querySelectorAll('p, div, h1, h2, h3, li').forEach((node) => node.append('\n'))
  return paginateText(document.body.textContent || '')
}

const DEFAULT_SETTINGS = {
  theme: 'sepia', // 'light' | 'sepia' | 'dark'
  fontSize: 18, // 14 -> 26
  fontFamily: 'serif', // 'serif' | 'sans'
  lineHeight: 1.8, // 1.5, 1.8, 2.1
  contentWidth: 'normal', // 'narrow' (750px), 'normal' (900px), 'wide' (1150px)
}

export default function ReadBookPage() {
  const { bookId } = useParams()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const requestedChapter = searchParams.get('chapter')
  return <ReaderSession key={`${user.id}:${bookId}:${requestedChapter}`} bookId={bookId} userId={user.id} requestedChapter={requestedChapter} />
}

function ReaderSession({ bookId, userId, requestedChapter }) {
  const { theme, setTheme } = useTheme()
  const progressKey = `bookapp_progress_${userId}_${bookId}`
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [savingBook, setSavingBook] = useState(false)
  const [reload, setReload] = useState(0)
  const [chapterLoading, setChapterLoading] = useState(false)
  const [chapterError, setChapterError] = useState('')
  const [chapterRetry, setChapterRetry] = useState(0)
  const [chapterOpen, setChapterOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSelection, setAiSelection] = useState({ text: '', mode: 'summary' })
  // Khởi tạo trang từ localStorage nếu có tiến độ đọc dở
  const [page, setPage] = useState(0)
  const [isSaved, setIsSaved] = useState(false)
  const [resumeToast, setResumeToast] = useState(null)
  const contentContainerRef = useRef(null)
  const settingsRef = useRef(null)

  // Khôi phục cài đặt Reader từ localStorage
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('bookapp_reader_settings')
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  // Lưu cài đặt Reader mỗi khi thay đổi
  const updateSettings = (partial) => {
    if (partial.theme) setTheme(partial.theme)
    setSettings((prev) => {
      const updated = { ...prev, ...partial }
      try {
        localStorage.setItem('bookapp_reader_settings', JSON.stringify(updated))
      } catch {
        // Bỏ qua lỗi quota storage nếu có
      }
      return updated
    })
  }

  // Tải nội dung sách và trạng thái lưu

  const pages = useMemo(() => book?.pages ? book.pages.map((item) => item.text) : splitPages(book?.content || ''), [book])
  const total = pages.length || 1
  const chapters = useMemo(() => (book?.pages || []).flatMap((item, index, list) => item.chapter_id && (index === 0 || list[index - 1].chapter_id !== item.chapter_id)
    ? [{ ...item, page: index }] : []), [book])
  const currentChapter = book?.pages?.[page]
  const chapterIndex = chapters.findIndex((chapter) => chapter.chapter_id === currentChapter?.chapter_id)
  const { syncStatus, syncConflict, setSyncRetry, initializeProgress, useServerPosition, keepLocalPosition } = useReaderProgress({ book, bookId, page, setPage, pages, total, loading, progressKey, contentContainerRef })

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [initialContent, remoteResult] = await Promise.all([
          getBookContent(bookId, requestedChapter),
          getProgress(bookId).then((value) => ({ value })).catch(() => ({ failed: true })),
        ])
        if (!active) return
        let local = null
        try { local = JSON.parse(localStorage.getItem(progressKey)) } catch { /* unavailable */ }
        if (!validProgress(local)) local = null
        const remote = validProgress(remoteResult.value) ? remoteResult.value : null
        const progress = chooseReadingProgress(local, remote)
        let content = expandReaderBook(initialContent)
        const count = content.pages?.length ?? splitPages(content.content || '').length
        const restored = content.pages ? restoreReadingPage(progress, content.pages, requestedChapter) : restorePage(progress, count)
        if (content.is_story && content.pages[restored] && !content.pages[restored].text) {
          content = expandReaderBook(await getBookContent(bookId, content.pages[restored].chapter_id), content)
        }
        if (!active) return
        initializeProgress(progress, remoteResult.failed ? 'offline' : 'saved')
        setPage(restored)
        setBook(content)
        if (restored > 0) setResumeToast({ page: restored + 1, total: count, percentage: Math.round(((restored + 1) / count) * 100) })
        saveHistory(bookId).catch(() => {})
      } catch (err) {
        if (active) setLoadError(errorMessage(err, 'Không thể tải sách. Vui lòng thử lại.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    getSave(bookId)
      .then((res) => { if (active) setIsSaved(Boolean(res?.saved)) })
      .catch(() => {})
    return () => { active = false }
  }, [bookId, progressKey, reload, requestedChapter, initializeProgress])


  // Load only the selected chapter, then warm the next chapter in the background.
  useEffect(() => {
    if (!book?.is_story || !currentChapter) return
    let active = true
    const loadChapter = async () => {
      try {
        if (!currentChapter.text) {
          setChapterLoading(true)
          setChapterError('')
          const loaded = await getBookContent(bookId, currentChapter.chapter_id)
          if (!active) return
          setBook((previous) => expandReaderBook(loaded, previous))
        } else {
          const next = chapters[chapterIndex + 1]
          if (next && !book.chapterPages?.[next.chapter_id]) {
            const loaded = await getBookContent(bookId, next.chapter_id)
            if (active) setBook((previous) => expandReaderBook(loaded, previous))
          }
        }
      } catch (err) { if (active && !currentChapter.text) setChapterError(errorMessage(err, 'Không tải được chương.')) }
      finally { if (active) setChapterLoading(false) }
    }
    loadChapter()
    return () => { active = false }
  }, [bookId, book, chapters, chapterIndex, currentChapter, chapterRetry])

  // Hiển thị thông báo khi khôi phục trang đọc dở
  useEffect(() => {
    if (resumeToast) {
      const timer = setTimeout(() => setResumeToast(null), 4500)
      return () => clearTimeout(timer)
    }
  }, [resumeToast])

  // Lưu tiến độ đọc dở mỗi khi chuyển trang
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSettingsOpen(false)
        setChapterOpen(false)
        setAiOpen(false)
        return
      }
      // Không bắt phím khi đang mở modal hoặc focus vào input
      if (aiOpen || chapterOpen || settingsOpen || loading || !pages.length || e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(e.target.tagName)) return

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        setPage((p) => Math.max(0, p - 1))
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        setPage((p) => Math.min(total - 1, p + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [total, aiOpen, chapterOpen, settingsOpen, loading, pages.length])

  // Đóng popover cài đặt khi click ra ngoài
  useEffect(() => {
    if (!settingsOpen) return
    const handleClickOutside = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [settingsOpen])

  // Toggle lưu sách
  const handleToggleSave = async () => {
    if (savingBook) return
    setSavingBook(true)
    setActionError('')
    try {
      const res = await toggleSave(bookId)
      setIsSaved(Boolean(res?.saved))
    } catch (err) {
      setActionError(errorMessage(err, 'Không thể cập nhật tủ sách.'))
    } finally {
      setSavingBook(false)
    }
  }

  // Tính % tiến độ đọc
  const progressPercent = pages.length ? Math.min(100, Math.max(0, Math.round(((page + 1) / total) * 100))) : 0

  return (
    <div className={`reader-page theme-${theme}`}>
      <Sidebar active={book?.is_story ? 'Stories' : 'Home'} />

      <main className="reader-main">
        {/* Thanh Topbar */}
        <header className="reader-tophar">
          <div className="tophar-left">
            <Link to={book?.is_story ? `/stories/${bookId}` : `/book/${bookId}`} className="back-link" title="Quay lại trang chi tiết">
              <span className="btn-icon"><i className="fa-solid fa-angle-left"></i></span>
            </Link>
            <div className="title">
              <h2>{book?.title || (loading ? 'Đang tải...' : 'Đọc sách')}</h2>
              {book?.author && <span className="author-name"> • {book.author}</span>}
            </div>
          </div>

          <div className="tophar-right">
            <ul>
              {/* Nút tùy biến giao diện (Aa) */}
              <li className="settings-item" ref={settingsRef}>
                <button
                  type="button"
                  className={`btn-icon ${settingsOpen ? 'active' : ''}`}
                  onClick={() => setSettingsOpen((v) => !v)}
                  title="Tùy biến hiển thị (Cỡ chữ, Theme, Font)"
                >
                  <span className="font-icon">Aa</span>
                </button>

                {/* Popover tùy biến Reader */}
                {settingsOpen && (
                  <div className="reader-settings-popover" role="dialog" aria-label="Tùy biến đọc sách">
                    <div className="settings-header">
                      <h4>Tùy biến giao diện đọc</h4>
                      <button type="button" className="close-btn" onClick={() => setSettingsOpen(false)}>✕</button>
                    </div>

                    <div className="settings-body">
                      {/* Chọn Theme màu nền */}
                      <div className="setting-group">
                        <label className="setting-label">Màu nền trang sách</label>
                        <div className="theme-options">
                          <button
                            type="button"
                            className={`theme-btn theme-light-btn ${theme === 'light' ? 'selected' : ''}`}
                            onClick={() => updateSettings({ theme: 'light' })}
                          >
                            <span className="swatch light"></span>
                            <span>Sáng</span>
                          </button>
                          <button
                            type="button"
                            className={`theme-btn theme-sepia-btn ${theme === 'sepia' ? 'selected' : ''}`}
                            onClick={() => updateSettings({ theme: 'sepia' })}
                          >
                            <span className="swatch sepia"></span>
                            <span>Giấy cổ</span>
                          </button>
                          <button
                            type="button"
                            className={`theme-btn theme-dark-btn ${theme === 'dark' ? 'selected' : ''}`}
                            onClick={() => updateSettings({ theme: 'dark' })}
                          >
                            <span className="swatch dark"></span>
                            <span>Tối</span>
                          </button>
                        </div>
                      </div>

                      {/* Chọn Cỡ chữ */}
                      <div className="setting-group">
                        <label className="setting-label">Cỡ chữ</label>
                        <div className="font-size-control">
                          <button
                            type="button"
                            className="size-btn decrease"
                            onClick={() => updateSettings({ fontSize: Math.max(14, settings.fontSize - 1) })}
                            disabled={settings.fontSize <= 14}
                            title="Giảm cỡ chữ"
                          >
                            A-
                          </button>
                          <span className="current-size">{settings.fontSize}px</span>
                          <button
                            type="button"
                            className="size-btn increase"
                            onClick={() => updateSettings({ fontSize: Math.min(26, settings.fontSize + 1) })}
                            disabled={settings.fontSize >= 26}
                            title="Tăng cỡ chữ"
                          >
                            A+
                          </button>
                        </div>
                      </div>

                      {/* Chọn Phông chữ */}
                      <div className="setting-group">
                        <label className="setting-label">Kiểu chữ</label>
                        <div className="font-family-options">
                          <button
                            type="button"
                            className={`font-btn ${settings.fontFamily === 'serif' ? 'selected' : ''}`}
                            style={{ fontFamily: 'Georgia, serif' }}
                            onClick={() => updateSettings({ fontFamily: 'serif' })}
                          >
                            Serif (Có chân)
                          </button>
                          <button
                            type="button"
                            className={`font-btn ${settings.fontFamily === 'sans' ? 'selected' : ''}`}
                            style={{ fontFamily: "'Poppins', sans-serif" }}
                            onClick={() => updateSettings({ fontFamily: 'sans' })}
                          >
                            Sans (Hiện đại)
                          </button>
                        </div>
                      </div>

                      {/* Chọn Giãn dòng */}
                      <div className="setting-group">
                        <label className="setting-label">Khoảng cách dòng</label>
                        <div className="line-height-options">
                          <button
                            type="button"
                            className={`lh-btn ${settings.lineHeight === 1.5 ? 'selected' : ''}`}
                            onClick={() => updateSettings({ lineHeight: 1.5 })}
                          >
                            Vừa (1.5)
                          </button>
                          <button
                            type="button"
                            className={`lh-btn ${settings.lineHeight === 1.8 ? 'selected' : ''}`}
                            onClick={() => updateSettings({ lineHeight: 1.8 })}
                          >
                            Chuẩn (1.8)
                          </button>
                          <button
                            type="button"
                            className={`lh-btn ${settings.lineHeight === 2.1 ? 'selected' : ''}`}
                            onClick={() => updateSettings({ lineHeight: 2.1 })}
                          >
                            Rộng (2.1)
                          </button>
                        </div>
                      </div>

                      {/* Độ rộng trang */}
                      <div className="setting-group">
                        <label className="setting-label">Độ rộng trang</label>
                        <div className="width-options">
                          <button
                            type="button"
                            className={`width-btn ${settings.contentWidth === 'narrow' ? 'selected' : ''}`}
                            onClick={() => updateSettings({ contentWidth: 'narrow' })}
                          >
                            Gọn (750px)
                          </button>
                          <button
                            type="button"
                            className={`width-btn ${settings.contentWidth === 'normal' ? 'selected' : ''}`}
                            onClick={() => updateSettings({ contentWidth: 'normal' })}
                          >
                            Chuẩn (900px)
                          </button>
                          <button
                            type="button"
                            className={`width-btn ${settings.contentWidth === 'wide' ? 'selected' : ''}`}
                            onClick={() => updateSettings({ contentWidth: 'wide' })}
                          >
                            Rộng (1150px)
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </li>

              {/* Danh sách chương */}
              <li className="list">
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setChapterOpen(true)}
                  title={book?.is_story ? 'Mục lục chương' : 'Danh sách trang'}
                  disabled={loading || !pages.length}
                >
                  <i className="fa-solid fa-list-ul"></i>
                </button>
              </li>

              {/* Lưu vào tủ sách */}
              <li className="save">
                <button
                  type="button"
                  className={`btn-icon ${isSaved ? 'saved' : ''}`}
                  onClick={handleToggleSave}
                  disabled={savingBook || loading || !book}
                  title={isSaved ? 'Đã lưu trong tủ sách' : 'Lưu vào tủ sách'}
                >
                  <i className={`${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark`}></i>
                </button>
              </li>

              {/* Trợ lý AI */}
              <li className="ai">
                <button
                  type="button"
                  className={`btn-icon ${aiOpen ? 'active' : ''}`}
                  onClick={() => { setAiSelection({ text: '', mode: 'summary' }); setAiOpen(true) }}
                  disabled={loading || !pages[page]}
                  title="Mở Trợ lý AI"
                >
                  <i className="fa-solid fa-brain"></i>
                </button>
              </li>
            </ul>
          </div>
        </header>

        {/* Thanh tiến độ đọc sách mỏng trên đỉnh */}
        <div className="reading-progress-track">
          <div
            className="reading-progress-bar"
            style={{ width: `${progressPercent}%` }}
            title={`Tiến độ đọc: ${progressPercent}%`}
          ></div>
        </div>

        {actionError && <div className="reader-notice" role="alert">{actionError}</div>}
        {!loading && pages.length > 0 && (
          <div className="reader-sync" role="status">
            {syncStatus === 'saving' && 'Đang đồng bộ vị trí đọc…'}
            {syncStatus === 'saved' && 'Đã đồng bộ vị trí đọc'}
            {syncStatus === 'offline' && 'Đã lưu trên thiết bị; chưa đồng bộ được với máy chủ.'}
            {syncStatus === 'failed' && 'Chưa lưu được vị trí đọc. Vui lòng thử lại.'}
            {syncStatus === 'conflict' && 'Vị trí đọc đã thay đổi ở một phiên khác.'}
            {syncConflict && <>
              <button type="button" onClick={useServerPosition}>Dùng vị trí đã đồng bộ</button>
              <button type="button" onClick={keepLocalPosition}>Giữ vị trí đang đọc</button>
            </>}
            {['offline', 'failed'].includes(syncStatus) && <button type="button" onClick={() => setSyncRetry((value) => value + 1)}>Thử đồng bộ lại</button>}
          </div>
        )}

        {/* Khu vực hiển thị trang sách */}
        <div className="reader-content">
          <div
            ref={contentContainerRef}
            className={`book-page width-${settings.contentWidth}`}
            style={{
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
              fontFamily:
                settings.fontFamily === 'serif'
                  ? 'Merriweather, Georgia, "Times New Roman", serif'
                  : "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            <div className="chapter-header">
              <h1 className="chapter-book-title">{book?.title}</h1>
              {book?.author && <p className="chapter-author">Tác giả: {book.author}</p>}
              {currentChapter?.chapter_title && <h2>Chương {currentChapter.chapter_number}: {currentChapter.chapter_title}</h2>}
              {book?.is_story && <div className="reading-tool-actions">
                <button type="button" disabled={chapterIndex <= 0} onClick={() => setPage(chapters[chapterIndex - 1]?.page ?? 0)}>Chương trước</button>
                <button type="button" onClick={() => setChapterOpen(true)}>Mục lục</button>
                <button type="button" disabled={chapterIndex < 0 || chapterIndex >= chapters.length - 1} onClick={() => setPage(chapters[chapterIndex + 1]?.page ?? page)}>Chương sau</button>
              </div>}
            </div>

            {!loading && pages.length > 0 && <NarrationPlayer bookId={bookId} chapterId={currentChapter?.chapter_id} text={pages[page] || ''} page={page} total={total} onNext={() => setPage((value) => Math.min(total - 1, value + 1))} />}
            <div className="chapter-body">
              {loading ? (
                <div className="reader-loading" role="status"><div className="loading-spinner"></div><p>Đang tải nội dung sách...</p></div>
              ) : loadError ? (
                <div className="reader-loading" role="alert"><p>{loadError}</p><button type="button" className="nav-btn" onClick={() => { setLoading(true); setLoadError(''); setReload((value) => value + 1) }}>Thử lại</button></div>
              ) : pages.length && !pages[page] ? (
                <div className="reader-loading" role={chapterError ? 'alert' : 'status'}><p>{chapterError || (chapterLoading ? 'Đang tải chương…' : 'Đang chuẩn bị chương…')}</p>{chapterError && <button type="button" onClick={() => setChapterRetry((value) => value + 1)}>Thử tải lại chương</button>}</div>
              ) : pages.length ? (
                  <div className="converted-content">
                    <ReadingPageTools bookId={bookId} page={page} chapterId={currentChapter?.chapter_id} chapterPage={page - (chapters[chapterIndex]?.page || 0)} text={pages[page]} onJump={(target) => setPage(Math.max(0, Math.min(total - 1, target)))} onAsk={(text, mode) => { setAiSelection({ text, mode }); setAiOpen(true) }} />
                  </div>
              ) : book?.file_path ? (
                <iframe
                  src={mediaUrl(book.file_path, '')}
                  width="100%"
                  height="800px"
                  style={{ border: 'none', borderRadius: '8px' }}
                  title={book.title}
                />
              ) : (
                <div className="reader-loading">
                  <p>Sách này chưa có nội dung để đọc.</p>
                  <Link to={`/book/${bookId}`}>Quay lại chi tiết sách</Link>
                </div>
              )}
            </div>

            {/* Thanh điều hướng trang dưới cùng */}
            {pages.length > 0 && !loading && <div className="chapter-footer">
              <button
                type="button"
                className="nav-btn prev"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                title="Trang trước (←)"
              >
                <i className="fa-solid fa-angle-left"></i>
                <span className="nav-label">Trang trước</span>
              </button>

              <div className="page-indicator">
                <span className="current-page">Trang {page + 1}</span>
                <span className="separator">/</span>
                <span className="total-pages">{total}</span>
                <span className="percent-badge">({progressPercent}%)</span>
              </div>

              <button
                type="button"
                className="nav-btn next"
                disabled={page >= total - 1}
                onClick={() => setPage((p) => Math.min(total - 1, p + 1))}
                title="Trang sau (→)"
              >
                <span className="nav-label">Trang sau</span>
                <i className="fa-solid fa-angle-right"></i>
              </button>
            </div>}
          </div>
        </div>

        {/* Toast thông báo khôi phục vị trí đọc dở */}
        {resumeToast && (
          <div className="resume-toast" role="status">
            <div className="toast-icon">
              <i className="fa-solid fa-bookmark"></i>
            </div>
            <div className="toast-content">
              <p className="toast-title">Tiếp tục đọc dở</p>
              <p className="toast-desc">
                Đã mở lại Trang {resumeToast.page}/{resumeToast.total} ({resumeToast.percentage}%)
              </p>
            </div>
            <button
              type="button"
              className="toast-restart-btn"
              onClick={() => {
                setPage(0)
                setResumeToast(null)
              }}
            >
              Về đầu sách
            </button>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => setResumeToast(null)}
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>
        )}

        {/* Overlay và Drawer danh sách chương */}
        <div
          className={`overlay ${chapterOpen ? 'active' : ''}`}
          onClick={() => {
            setChapterOpen(false)
            setSettingsOpen(false)
          }}
        ></div>

        <div className={`chapter-list ${chapterOpen ? 'active' : ''}`}>
          <div className="chapter-list-header">
            <h3>{book?.is_story ? 'Mục lục chương' : 'Danh sách trang'}</h3>
            <button type="button" onClick={() => setChapterOpen(false)} aria-label="Đóng">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <ul className="chapter-items">
            {book?.is_story ? chapters.map((chapter) => <li key={chapter.chapter_id} className={chapter.chapter_id === currentChapter?.chapter_id ? 'active' : ''}>
              <button type="button" onClick={() => { setPage(chapter.page); setChapterOpen(false) }}>Chương {chapter.chapter_number}: {chapter.chapter_title}<span className="chapter-page"> · Trang {chapter.page + 1}</span></button>
            </li>) : pages.map((_, index) => (
              <li key={index} className={index === page ? 'active' : ''}>
                <button type="button" onClick={() => { setPage(index); setChapterOpen(false) }} aria-current={index === page ? 'page' : undefined}>
                  <span className="chapter-page">Trang {index + 1}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </main>
        <AIAssistantDrawer
          key={bookId}
          isOpen={aiOpen}
          onClose={() => setAiOpen(false)}
          bookTitle={book?.title}
          currentContent={pages[page] || ''}
          bookId={bookId}
          pageNumber={page}
          selectedText={aiSelection.text}
          initialTab={aiSelection.mode}
          onSource={(sourcePage) => { setPage(Math.max(0, Math.min(total - 1, sourcePage))); setAiOpen(false) }}
        />
    </div>
  )
}
