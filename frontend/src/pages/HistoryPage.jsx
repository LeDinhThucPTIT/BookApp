import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { deleteHistory, listHistory } from '../api/library'
import { mediaUrl } from '../utils/media'

export default function HistoryPage() {
  const [items, setItems] = useState([])
  const [message, setMessage] = useState('Đang tải...')
  const navigate = useNavigate()

  useEffect(() => {
    listHistory()
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setItems(list)
        if (!list.length) setMessage('Bạn chưa đọc quyển sách nào.')
      })
      .catch((err) => setMessage(errorMessage(err, 'Không thể tải lịch sử đọc. Vui lòng thử lại.')))
  }, [])

  if (!items.length) {
    return (
      <main className="Main">
        <div className="history-text"><h3>LỊCH SỬ</h3></div>
        <div className="history-list"><p className="empty-history">{message}</p></div>
      </main>
    )
  }

  return (
    <main className="Main">
      <div className="history-text"><h3>LỊCH SỬ</h3></div>
      <div className="history-list">
        {items.map((item) => {
          const avgRating = item.avg_rating || 0
          const date = item.last_read_at ? new Date(item.last_read_at).toLocaleString('vi-VN') : ''
          return (
            <div className="history-item" key={item.history_id || item.book_id}>
              <div className="book-history">
                <div className="book-image">
                  <img src={mediaUrl(item.cover_image)} alt={item.title} />
                </div>
                <div className="book-info">
                  <div className="book-title">{item.title}</div>
                  <div className="book-rating">
                    <span>{avgRating}</span>
                    <span className="stars">
                      {Array.from({ length: 5 }, (_, i) => (
                        <i key={i} className={`${i < Math.round(avgRating) ? 'fa-solid' : 'fa-regular'} fa-star`}></i>
                      ))}
                    </span>
                    <span>• {item.total_ratings || 0} đánh giá</span>
                  </div>
                  <div className="book-meta">
                    <div className="meta-content">
                      <div className="content-1">Tác giả</div>
                      <div className="content-2">{item.author || 'Không rõ'}</div>
                    </div>
                    <div className="meta-content">
                      <div className="content-1">Thể loại</div>
                      <div className="content-2">{item.genre || 'Chưa rõ'}</div>
                    </div>
                    <div className="meta-content">
                      <div className="content-1">Nhà xuất bản</div>
                      <div className="content-2">Đang cập nhật</div>
                    </div>
                    <div className="meta-content">
                      <div className="content-1">Tình trạng ra</div>
                      <div className="content-2">Đang cập nhật</div>
                    </div>
                    <div className="cancel">
                      <button
                        title="Xoá khỏi lịch sử"
                        onClick={async () => {
                          await deleteHistory(item.book_id)
                          setItems((prev) => prev.filter((row) => row.book_id !== item.book_id))
                        }}
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  </div>
                  <div className="book-actions">
                    <button className="read-btn" onClick={() => navigate(`/read/${item.book_id}`)}>
                      Đọc sách
                    </button>
                  </div>
                  <div className="last-read-time">
                    <span className="state">Đã đọc:</span>
                    <div className="time">{date}</div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
