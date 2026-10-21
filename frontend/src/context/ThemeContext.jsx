import { useLayoutEffect, useState } from 'react'
import { applyTheme, isTheme, readTheme, THEME_KEY } from '../utils/theme'
import { ThemeContext } from './theme-context'

export function ThemeProvider({ children }) {
  const [theme, updateTheme] = useState(() => readTheme({ getItem: (key) => localStorage.getItem(key) }))
  useLayoutEffect(() => {
    applyTheme(theme, document.documentElement, { setItem: (key, value) => localStorage.setItem(key, value) })
  }, [theme])
  useLayoutEffect(() => {
    const sync = (event) => {
      if (event.key === THEME_KEY && isTheme(event.newValue)) updateTheme(event.newValue)
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const setTheme = (next) => { if (isTheme(next)) updateTheme(next) }
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

