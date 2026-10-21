import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getBook } from '../api/books'
import { errorMessage } from '../api/client'
import {
  addComment,
  getFavorite,
  getRating,
  getSave,
  listComments,
  setRating,
  toggleFavorite,
  toggleSave,
} from '../api/library'
import { useAuth } from '../context/AuthContext'
import { DEFAULT_AVATAR, mediaUrl } from '../utils/media'

export default function BookDetailPage() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [book, setBook] = useState(null)
  const [favorite, setFavorite] = useState(false)
  const [saved, setSaved] = useState(false)
  const [rating, setRatingState] = useState({ average: 0, total: 0, user_rating: 0 })
  const [comments, setComments] = useState([])
  const [expanded, setExpanded] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // State cho bình luận
  const [commentOpen, setCommentOpen] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [inlineCommentText, setInlineCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    const detail = await getBook(bookId)
    setBook(detail)
    const [fav, save, rate, list] = await Promise.all([
      getFavorite(bookId),
      getSave(bookId),
      getRating(bookId),
      listComments(bookId),
    ])
    setFavorite(Boolean(fav?.favorite))
    setSaved(Boolean(save?.saved))
    setRatingState(rate || { average: 0, total: 0, user_rating: 0 })
    setComments(Array.isArray(list) ? list : [])
  }

  useEffect(() => {
    load().catch((err) => alert(errorMessage(err, 'Không tải được chi tiết sách')))
  }, [bookId])

  if (!book) {
    return (
      <main className="Main">
        <div className="book-detail-loading">
          <div className="loading-spinner"></div>
          <p>Đang tải thông tin sách...</p>
        </div>
      </main>
    )
  }

  const bookUrl = window.location.href

  const onCopy = async () => {
    await navigator.clipboard.writeText(bookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Gửi bình luận từ modal popup
  const sendModalComment = async () => {
    if (!commentText.trim()) {
      alert('⚠️ Vui lòng nhập nội dung bình luận!')
      return
    }
    try {
      setSubmitting(true)
      await addComment(bookId, commentText.trim())
      setCommentText('')
      setCommentOpen(false)
      const updated = await listComments(bookId)
      setComments(Array.isArray(updated) ? updated : [])
    } catch (err) {
      alert(`❌ ${errorMessage(err, 'Không thể gửi bình luận')}`)
    } finally {
      setSubmitting(false)
    }
  }

  // Gửi bình luận từ ô nhập trực tiếp (inline)
  const sendInlineComment = async () => {
    if (!inlineCommentText.trim()) {
      alert('⚠️ Vui lòng nhập nội dung bình luận!')
      return
    }
    try {
      setSubmitting(true)
      await addComment(bookId, inlineCommentText.trim())
      setInlineCommentText('')
      const updated = await listComments(bookId)
      setComments(Array.isArray(updated) ? updated : [])
    } catch (err) {
      alert(`❌ ${errorMessage(err, 'Không thể gửi bình luận')}`)
    } finally {
      setSubmitting(false)
    }
  }

  const currentUserAvatar = user?.avatar ? mediaUrl(user.avatar, DEFAULT_AVATAR) : DEFAULT_AVATAR

  return (
    <main className="Main">
      <div className="book-detail-container">
        {/* Nút trở lại */}
        <div className="back-button" onClick={() => navigate('/home')}>
          <i className="fa-solid fa-arrow-left"></i>
          <span>Trở lại trang chủ</span>
        </div>

        {/* Nội dung chi tiết sách */}
        <div className="book-detail-content">
          <div className="book-cover">
            <img src={mediaUrl(book.cover_image)} alt={book.title} />
          </div>

          <div className="book-info">
            <h1 className="book-title">{book.title}</h1>

            <div className="book-rating">
              <div className="rating-stars" title="Nhấp vào sao để đánh giá">
                {[1, 2, 3, 4, 5].map((star) => (
                  <i
                    key={star}
                    className={`fa-star ${star <= (rating.user_rating || 0) ? 'fa-solid active' : 'fa-regular'}`}
                    onClick={async () => {
                      await setRating(bookId, star)
                      setRatingState(await getRating(bookId))
                    }}
                  ></i>
                ))}
              </div>
              <span className="rating-text">
                {rating.total ? `${rating.average}/5 (${rating.total} đánh giá)` : 'Chưa có đánh giá'}
              </span>
            </div>

            <div className="book-meta">
              <div className="meta-content">
                <span className="content-1">Tác giả</span>
                <span className="content-2">{book.author || 'Chưa rõ'}</span>
              </div>
              <div className="meta-content">
                <span className="content-1">Thể loại</span>
                <span className="content-2">{book.genre || 'Văn học'}</span>
              </div>
              <div className="meta-content">
                <span className="content-1">Nhà xuất bản</span>
                <span className="content-2">Kim Đồng</span>
              </div>
              <div className="meta-content">
                <span className="content-1">Trạng thái</span>
                <span className="content-2 status-badge">Đã hoàn thành</span>
              </div>
            </div>

            <div className="book-actions">
              <Link to={`/read/${book.id}`} className="read-btn">
                <i className="fa-solid fa-book-open"></i>
                <span>Đọc sách ngay</span>
              </Link>
              <div className="icons">
                <button
                  type="button"
                  id="favorite-btn"
                  className={`action-icon-btn ${favorite ? 'active' : ''}`}
                  title={favorite ? 'Bỏ yêu thích' : 'Yêu thích'}
                  aria-label={favorite ? 'Bỏ yêu thích' : 'Yêu thích'}
                  aria-pressed={favorite}
                  onClick={async () => {
                    const res = await toggleFavorite(bookId)
                    setFavorite(Boolean(res?.favorite))
                  }}
                >
                  <i
                    className={`${favorite ? 'fa-solid' : 'fa-regular'} fa-heart`}
                    aria-hidden="true"
                  ></i>
                </button>

                <button
                  type="button"
                  id="share-btn"
                  className="action-icon-btn"
                  title="Chia sẻ sách"
                  aria-label="Chia sẻ sách"
                  aria-expanded={shareOpen}
                  onClick={() => setShareOpen((v) => !v)}
                >
                  <i className="fa-solid fa-share-nodes" aria-hidden="true"></i>
                </button>

                <button
                  type="button"
                  id="save-btn"
                  className={`action-icon-btn ${saved ? 'active' : ''}`}
                  title={saved ? 'Đã lưu trong tủ sách' : 'Lưu vào tủ sách'}
                  aria-label={saved ? 'Đã lưu trong tủ sách' : 'Lưu vào tủ sách'}
                  aria-pressed={saved}
                  onClick={async () => {
                    const res = await toggleSave(bookId)
                    setSaved(Boolean(res?.saved))
                  }}
                >
                  <i
                    className={`${saved ? 'fa-solid' : 'fa-regular'} fa-bookmark`}
                    aria-hidden="true"
                  ></i>
                </button>
              </div>
            </div>

            {/* Popup chia sẻ */}
            {shareOpen && (
              <div className="share-popup open" id="share-popup">
                <div className="share-popup-header">
                  <p>Chia sẻ cuốn sách này</p>
                  <button type="button" className="close-share-btn" onClick={() => setShareOpen(false)}>✕</button>
                </div>
                <div className="share-links">
                  <button id="copy-link-btn" type="button" onClick={onCopy}>
                    <i className={`fa-solid ${copied ? 'fa-check' : 'fa-link'}`}></i>
                    <span>{copied ? 'Đã sao chép link!' : 'Sao chép link sách'}</span>
                  </button>
                  <a
                    id="fb-share"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(bookUrl)}`}
                  >
                    <i className="fa-brands fa-facebook-f"></i>
                    <span>Chia sẻ lên Facebook</span>
                  </a>
                  <a
                    id="tw-share"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(bookUrl)}&text=Hãy đọc cuốn sách tuyệt vời này: ${encodeURIComponent(book.title)}`}
                  >
                    <i className="fa-brands fa-x-twitter"></i>
                    <span>Chia sẻ lên X (Twitter)</span>
                  </a>
                </div>
              </div>
            )}

            {/* Mô tả sách */}
            <div className={`book-description ${expanded ? 'expanded' : ''}`}>
              <h3 className="description-title">Giới thiệu nội dung</h3>
              <p className="book-description__text">{book.summary || 'Chưa có thông tin tóm tắt cho cuốn sách này.'}</p>
              {book.summary && book.summary.length > 150 && (
                <button
                  type="button"
                  className="see-more"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? 'Thu gọn nội dung ↑' : 'Xem toàn bộ giới thiệu ↓'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================
            KHU VỰC BÌNH LUẬN (COMMENT SECTION)
           ============================================================ */}
        <section className="comment-section" aria-labelledby="comment-heading">
          <div className="comment-header-bar">
            <h3 id="comment-heading">
              Bình luận độc giả <span id="comment-count" className="comment-badge">({comments.length})</span>
            </h3>
            <button
              id="write-comment-btn"
              type="button"
              className="write-comment-btn"
              onClick={() => setCommentOpen(true)}
            >
              <i className="fa-solid fa-pen-to-square"></i>
              <span>Viết bình luận</span>
            </button>
          </div>

          {/* Khung nhập bình luận trực tiếp hiện đại (Inline Comment Box) */}
          <div className="inline-comment-card">
            <img src={currentUserAvatar} alt="Avatar" className="user-comment-avatar" />
            <div className="inline-comment-content">
              <textarea
                className="inline-comment-input"
                placeholder={user ? "Chia sẻ cảm nghĩ hoặc nhận xét của bạn về cuốn sách này..." : "Đăng nhập để tham gia bình luận..."}
                rows={2}
                value={inlineCommentText}
                onChange={(e) => setInlineCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault()
                    sendInlineComment()
                  }
                }}
              />
              <div className="inline-comment-actions">
                <span className="keyboard-tip">Nhấn Ctrl + Enter để gửi nhanh</span>
                <button
                  type="button"
                  className="inline-send-btn"
                  onClick={sendInlineComment}
                  disabled={submitting || !inlineCommentText.trim()}
                >
                  <i className="fa-solid fa-paper-plane"></i>
                  <span>{submitting ? 'Đang gửi...' : 'Gửi bình luận'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Danh sách bình luận có khả năng cuộn mượt mà */}
          <div id="comments-list" className="comments-list" tabIndex={0} aria-label="Danh sách bình luận">
            {comments.length === 0 ? (
              <div className="empty-comments">
                <div className="empty-icon">
                  <i className="fa-regular fa-comments"></i>
                </div>
                <p className="empty-title">Chưa có bình luận nào</p>
                <p className="empty-desc">Hãy là người đầu tiên chia sẻ cảm nhận về cuốn sách này nhé!</p>
              </div>
            ) : (
              comments.map((c) => (
                <article className="comment-item" key={c.id}>
                  <img
                    src={mediaUrl(c.avatar, DEFAULT_AVATAR)}
                    className="comment-avatar"
                    alt={c.username || 'Người dùng'}
                  />
                  <div className="comment-body">
                    <header className="comment-header">
                      <span className="comment-author">{c.username || 'Độc giả'}</span>
                      <time className="comment-time" dateTime={c.created_at}>
                        {c.created_at ? new Date(c.created_at).toLocaleString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        }) : ''}
                      </time>
                    </header>
                    <p className="comment-content-text">{c.content}</p>
                  </div>
                </article>
              ))
            )}
          </div>

          {/* Modal Popup viết bình luận với Backdrop làm mờ chuyên nghiệp */}
          {commentOpen && (
            <div className="comment-modal-backdrop" onClick={() => setCommentOpen(false)}>
              <div
                className="comment-popup open"
                id="comment-popup"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-comment-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="comment-popup-header">
                  <h4 id="modal-comment-title">Viết bình luận cho sách</h4>
                  <button
                    type="button"
                    className="close-popup-btn"
                    onClick={() => setCommentOpen(false)}
                    aria-label="Đóng"
                  >
                    ✕
                  </button>
                </div>

                <div className="comment-popup-body">
                  <textarea
                    id="comment-input"
                    className="modal-comment-textarea"
                    placeholder="Viết cảm nhận chi tiết của bạn về nội dung, nhân vật, bài học từ cuốn sách này..."
                    value={commentText}
                    maxLength={500}
                    onChange={(e) => setCommentText(e.target.value)}
                    autoFocus
                  ></textarea>
                  <div className="char-count">
                    <span>{commentText.length}/500 ký tự</span>
                  </div>
                </div>

                <div className="comment-popup-actions">
                  <button
                    type="button"
                    id="cancel-comment-btn"
                    className="cancel-btn"
                    onClick={() => {
                      setCommentOpen(false)
                      setCommentText('')
                    }}
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    id="send-comment-btn"
                    className="send-btn"
                    onClick={sendModalComment}
                    disabled={submitting || !commentText.trim()}
                  >
                    {submitting ? 'Đang gửi...' : 'Đăng bình luận'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
