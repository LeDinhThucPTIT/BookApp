import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { listBooks } from '../api/books'
import BookCard from '../components/BookCard'
import BookSection from '../components/BookSection'
import { shuffle } from '../utils/media'

export default function HomePage() {
  const { search = '' } = useOutletContext() || {}
  const [books, setBooks] = useState([])
  const [error, setError] = useState('')
  const [suggested, setSuggested] = useState([])

  useEffect(() => {
    listBooks()
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setBooks(list)
        setSuggested(shuffle(list).slice(0, 6))
      })
      .catch(() => setError('Không tải được dữ liệu 😢'))
  }, [])

  const keyword = search.toLowerCase().trim()
  const matched = useMemo(
    () =>
      books.filter((book) => {
        const title = book.title?.toLowerCase() || ''
        const author = book.author?.toLowerCase() || ''
        return title.includes(keyword) || author.includes(keyword)
      }),
    [books, keyword],
  )

  const empty = error || 'Không có sách nào để hiển thị.'

  if (keyword) {
    return (
      <main className="Main">
        <div className="search-results" style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {matched.length > 0 ? (
            matched.map((book) => <BookCard key={book.id} book={book} />)
          ) : (
            <p style={{ textAlign: 'center', margin: '40px 0 60px', fontSize: 18, color: '#666' }}>
              Không tìm thấy kết quả nào cho "<b>{keyword}</b>"
            </p>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="Main">
      <div className="Content">
        <div style={{ padding: '18px 24px' }}><Link to="/stories">Khám phá truyện theo chương →</Link></div>
        <BookSection title="MỚI NHẤT" books={books} emptyText={empty} />
        <BookSection title="SÁCH ĐƯỢC YÊU THÍCH" books={books.slice(0, 6)} emptyText={empty} />
        <BookSection title="SÁCH ĐỀ XUẤT" books={suggested} emptyText={empty} />
      </div>
      <BookSection
        title="SÁCH ĐƯỢC ĐÁNH GIÁ CAO"
        books={[...books].sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0)).slice(0, 6)}
        emptyText={empty}
      />
    </main>
  )
}
