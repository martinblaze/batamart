'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

type ThemeProviderProps = {
  children: React.ReactNode
}

type Theme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  mounted: boolean
  /** False on routes that are always light — the toggle should hide itself. */
  themeable: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const THEME_STORAGE_KEY = 'batamart-theme'

/**
 * Surfaces that stay light no matter what the user picked.
 *
 * The marketing site has its own fixed bone-and-ink palette and is the
 * product's shop window — it should look identical for everyone. The admin
 * panel is a data tool whose whole job is legibility of dense tables, and its
 * status colours are tuned against a light ground. Dark mode is a
 * preference for the app someone actually lives in, so it stops at the door
 * of both.
 */
const ALWAYS_LIGHT_PREFIXES = [
  '/admin',
  // Listed separately on purpose: the prefix test below matches `/admin` or
  // `/admin/…`, and `/admin-login` is neither.
  '/admin-login',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
]

export function isThemeableRoute(pathname: string | null): boolean {
  if (!pathname) return false
  if (pathname === '/') return false // marketing landing page
  return !ALWAYS_LIGHT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(theme: Theme, themeable: boolean) {
  const root = document.documentElement
  const dark = themeable && theme === 'dark'
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const pathname = usePathname()
  const themeable = isThemeableRoute(pathname)

  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    setThemeState(savedTheme === 'dark' ? 'dark' : 'light')
    setMounted(true)
  }, [])

  // Re-applied on every navigation, not just on change: stepping from a
  // themeable route onto an always-light one has to strip `.dark` from <html>
  // even though the stored preference itself has not changed.
  useEffect(() => {
    if (!mounted) return
    applyTheme(theme, themeable)
  }, [theme, themeable, mounted])

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme)
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  const value = useMemo(
    () => ({ theme, mounted, themeable, setTheme, toggleTheme }),
    [theme, mounted, themeable, setTheme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
