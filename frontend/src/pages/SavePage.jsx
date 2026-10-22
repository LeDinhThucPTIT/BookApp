import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { getLibraryPage, removeFavorite, removeSave } from '../api/library'
import { mediaUrl } from '../utils/media'

export default function SavePage() {
  const { search = '' } = useOutletContext() || {}
  return <LibraryPage key={search.trim()} search={search.trim()} />
}

function LibraryPage({ search }) {
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState(null)
  const [actionError, setActionError] = useState('')
  const [removing, setRemoving] = useState(null)
  const key = `${page}:${retry}:${search}`
  const current = result?.key === key ? result : null
  const items = current?.data?.items || []
  const total = current?.data?.total || 0

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => getLibraryPage({ page, page_size: 12, search }, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, data })
      })
      .catch((err) => { if (!controller.signal.aborted) setResult({ key, error: errorMessage(err, 'Không thể tải tủ sách.') }) }), search ? 250 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [page, retry, search, key])

  return (
    <main className="Main">
      <div className="save-text"><h3>LƯU TRỮ</h3></div>
      {!current && <p role="status">Đang tải tủ sách…</p>}
      {current?.error && <p role="alert">{current.error} <button type="button" onClick={() => setRetry((value) => value + 1)}>Thử lại</button></p>}
      {actionError && <p role="alert">{actionError}</p>}
      {current?.data && !items.length && <p className="empty-save">{search ? 'Không tìm thấy sách phù hợp.' : 'Bạn chưa lưu hoặc yêu thích quyển sách nào.'}</p>}
      <div className="save-container">
        {items.map((book) => (
          <div className="book-save" key={`${book.type}-${book.book_id}`}>
            <div className="book-img">
              <Link to={`/book/${book.book_id}`}>
                <img src={mediaUrl(book.cover_image)} alt={book.title} className="book-save-img" />
              </Link>
              <img
                src={book.type === 'favorite' ? '/images/Logo/Button Heart.png' : '/images/Logo/Button save.png'}
                alt={book.type}
                className={`book-save-heart ${book.type === 'favorite' ? 'favorite-icon' : 'save-icon'}`}
              />
              <button
                className="remove-save"
                type="button"
                title={book.type === 'favorite' ? 'Bỏ yêu thích' : 'Bỏ lưu sách'}
                aria-label={`${book.type === 'favorite' ? 'Bỏ yêu thích' : 'Bỏ lưu'}: ${book.title}`}
                disabled={removing !== null}
                onClick={async () => {
                  setRemoving(book.book_id)
                  setActionError('')
                  try {
                    if (book.type === 'favorite') await removeFavorite(book.book_id)
                    else await removeSave(book.book_id)
                    if (items.length === 1 && page > 1) setPage((value) => value - 1)
                    else setRetry((value) => value + 1)
                  } catch (error) { setActionError(errorMessage(error, 'Không thể bỏ sách khỏi tủ.')) }
                  finally { setRemoving(null) }
                }}
              >
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </div>
            <Link to={`/book/${book.book_id}`} className="book-save-info">
              <h4 className="book-save-title">{book.title}</h4>
              <p className="book-save-author">{book.author || 'Không rõ'}</p>
            </Link>
          </div>
        ))}
      </div>
      <nav aria-label="Phân trang tủ sách" style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 24 }}>
        <button type="button" disabled={page === 1 || !current} onClick={() => setPage((value) => value - 1)}>Trang trước</button>
        <span>Trang {page} / {Math.max(1, Math.ceil(total / 12))}</span>
        <button type="button" disabled={!current || page * 12 >= total} onClick={() => setPage((value) => value + 1)}>Trang sau</button>
      </nav>
    </main>
  )
}
