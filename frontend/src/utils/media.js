export const DEFAULT_AVATAR = '/images/Logo/Avatar.png'
export const DEFAULT_COVER = '/images/Book/giaodien.png'

const FRONTEND_STATIC_PREFIXES = [
  '/static/images/Logo/',
  '/static/images/Background/',
]

export function mediaUrl(path, fallback = DEFAULT_COVER) {
  if (!path || !String(path).trim()) return fallback
  let value = String(path).trim()

  if (value.startsWith('http') || value.startsWith('data:')) {
    return value
  }

  for (const prefix of FRONTEND_STATIC_PREFIXES) {
    if (value.startsWith(prefix)) {
      value = value.replace('/static', '')
      break
    }
  }

  if (!value.startsWith('/')) {
    value = `/${value}`
  }
  return value
}
