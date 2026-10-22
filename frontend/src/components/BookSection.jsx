import { useRef } from 'react'
import BookCard from './BookCard'

export default function BookSection({ title, books, emptyText = 'Không có sách nào để hiển thị.' }) {
  const listRef = useRef(null)

  const scroll = (direction) => {
    const list = listRef.current
    if (!list) return
    const distance = list.clientWidth * 0.8 * direction
    list.scrollBy({ left: distance, behavior: 'smooth' })
  }

  return (
    <div className="book-section book-section--suggested">
      <div className="book-section__header">
        <h2 className="book-section__title">{title}</h2>
      </div>
      <div className="book-section__wrapper">
        <button type="button" className="scroll-btn left" aria-label={`Cuộn trái: ${title}`} onClick={() => scroll(-1)}>
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        <div className="book-section__list" ref={listRef}>
          {books.length === 0 ? (
            <p className="no-result">{emptyText}</p>
          ) : (
            books.map((book) => <BookCard key={`${title}-${book.id}`} book={book} />)
          )}
        </div>
        <button type="button" className="scroll-btn right" aria-label={`Cuộn phải: ${title}`} onClick={() => scroll(1)}>
          <i className="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    </div>
  )
}
