export const THEME_KEY = 'bookapp_theme'
export const isTheme = (value) => ['light', 'sepia', 'dark'].includes(value)

export function readTheme(storage) {
  try {
    const saved = storage.getItem(THEME_KEY)
    if (isTheme(saved)) return saved
    const legacy = JSON.parse(storage.getItem('bookapp_reader_settings') || '{}')
    if (isTheme(legacy.theme)) return legacy.theme
  } catch { /* Theme still works when storage is unavailable. */ }
  return 'light'
}

export function applyTheme(theme, root, storage) {
  if (!isTheme(theme)) return
  root.dataset.theme = theme
  root.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
  try { storage.setItem(THEME_KEY, theme) } catch { /* Keep in-memory selection. */ }
}
