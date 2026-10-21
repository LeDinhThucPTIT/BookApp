import { Link } from 'react-router-dom'
import { mediaUrl } from '../utils/media'

export default function BookCard({ book, to }) {
  return (
    <Link to={to || `/book/${book.id}`} className="book-card">
      <img
        src={mediaUrl(book.cover_image)}
        alt={book.title}
        className="book-card__image"
      />
      <h3 className="book-card__title">{book.title}</h3>
      <p className="book-card__author">{book.author || 'Chưa rõ'}</p>
    </Link>
  )
}
