import { useEffect, useState } from 'react'
import { getCatalog } from '../api/books'
import { errorMessage } from '../api/client'

export function useCatalog({ page = 1, pageSize = 12, search = '', sort = 'newest' } = {}) {
  const [retry, setRetry] = useState(0)
  const key = JSON.stringify([page, pageSize, search, sort, retry])
  const [result, setResult] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      getCatalog({ page, page_size: pageSize, search, sort }, controller.signal)
        .then((data) => { if (!controller.signal.aborted) setResult({ key, data }) })
        .catch((error) => { if (!controller.signal.aborted) setResult({ key, error: errorMessage(error, 'Không tải được danh mục sách.') }) })
    }, search ? 250 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [key, page, pageSize, search, sort])
  const current = result?.key === key ? result : null
  return { items: current?.data?.items || [], total: current?.data?.total || 0,
    loading: !current, error: current?.error || '', retry: () => setRetry((value) => value + 1) }
}
