import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useCatalog } from '../hooks/useCatalog'
import BookCard from '../components/BookCard'
import BookSection from '../components/BookSection'

export default function HomePage() {
  const { search = '' } = useOutletContext() || {}
  const keyword = search.trim()
  return <CatalogPage key={keyword} keyword={keyword} />
}

function CatalogPage({ keyword }) {
  const [page, setPage] = useState(1)
  const catalog = useCatalog({ page, search: keyword })
  return <main className="Main">
    <div className="Content">
      <div style={{ padding: '18px 24px' }}><Link to="/stories">Khám phá truyện theo chương →</Link></div>
      {catalog.loading && <p role="status">Đang tải sách…</p>}
      {catalog.error && <p role="alert">{catalog.error} <button type="button" onClick={catalog.retry}>Thử lại</button></p>}
      {keyword ? <>
        <h1>Kết quả tìm kiếm: {keyword}</h1>
        <div className="search-results" style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {catalog.items.map((book) => <BookCard key={book.id} book={book} />)}
          {!catalog.loading && !catalog.error && !catalog.total && <p>Không tìm thấy sách phù hợp.</p>}
        </div>
      </> : <BookSection title="MỚI NHẤT" books={catalog.items} emptyText={catalog.loading ? 'Đang tải…' : catalog.error || 'Chưa có sách.'} />}
      <nav aria-label="Phân trang sách" style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 24 }}>
        <button type="button" disabled={page === 1 || catalog.loading} onClick={() => setPage((value) => value - 1)}>Trang trước</button>
        <span>Trang {page} / {Math.max(1, Math.ceil(catalog.total / 12))}</span>
        <button type="button" disabled={catalog.loading || page * 12 >= catalog.total} onClick={() => setPage((value) => value + 1)}>Trang sau</button>
      </nav>
      {!keyword && <RankedSections />}
    </div>
  </main>
}

function RankedSections() {
  const favorites = useCatalog({ sort: 'favorites', pageSize: 6 })
  const rated = useCatalog({ sort: 'rating', pageSize: 6 })
  return (
    <>
      {[{ title: 'SÁCH ĐƯỢC YÊU THÍCH', result: favorites }, { title: 'SÁCH ĐƯỢC ĐÁNH GIÁ CAO', result: rated }].map(({ title, result }) => <div key={title}>
        <BookSection title={title} books={result.items} emptyText={result.loading ? 'Đang tải…' : result.error || 'Chưa có sách.'} />
        {result.error && <button type="button" onClick={result.retry}>Tải lại {title.toLowerCase()}</button>}
      </div>)}
    </>
  )
}
