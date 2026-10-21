import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { listSaves, removeFavorite, removeSave } from '../api/library'
import { mediaUrl } from '../utils/media'

export default function SavePage() {
  const [items, setItems] = useState([])
  const [message, setMessage] = useState('Đang tải...')

  useEffect(() => {
    listSaves()
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setItems(list)
        if (!list.length) setMessage('Bạn chưa lưu hoặc yêu thích quyển sách nào.')
      })
      .catch((err) => setMessage(errorMessage(err, 'Không thể tải danh sách lưu.')))
  }, [])

  if (!items.length) {
    return (
      <main className="Main">
        <div className="save-text"><h3>LƯU TRỮ</h3></div>
        <div className="save-container"><p className="empty-save">{message}</p></div>
      </main>
    )
  }

  return (
    <main className="Main">
      <div className="save-text"><h3>LƯU TRỮ</h3></div>
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
                title="Xoá khỏi lưu trữ"
                onClick={async () => {
                  if (book.type === 'favorite') await removeFavorite(book.book_id)
                  else await removeSave(book.book_id)
                  setItems((prev) => prev.filter((row) => !(row.book_id === book.book_id && row.type === book.type)))
                }}
              >
                <i className="fa-solid fa-xmark" style={{ position: 'absolute', top: 10, left: 10, fontSize: 20, color: '#fff', cursor: 'pointer' }}></i>
              </button>
            </div>
            <Link to={`/book/${book.book_id}`} className="book-save-info">
              <h4 className="book-save-title">{book.title}</h4>
              <p className="book-save-author">{book.author || 'Không rõ'}</p>
            </Link>
          </div>
        ))}
      </div>
    </main>
  )
}
