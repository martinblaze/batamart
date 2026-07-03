'use client'

import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

type KeyboardVisibilityContextValue = {
  isKeyboardOpen: boolean
}

const KeyboardVisibilityContext = createContext<KeyboardVisibilityContextValue>({
  isKeyboardOpen: false,
})

function isFocusableTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export function KeyboardVisibilityProvider({ children }: { children: ReactNode }) {
  const [isFocusOpen, setIsFocusOpen] = useState(false)
  const [isViewportOpen, setIsViewportOpen] = useState(false)

  useEffect(() => {
    const evaluateViewport = () => {
      if (typeof window === 'undefined') return
      const viewport = window.visualViewport
      if (!viewport) {
        setIsViewportOpen(false)
        return
      }
      const keyboardHeight = window.innerHeight - viewport.height
      setIsViewportOpen(keyboardHeight > 150)
    }

    const onFocusIn = (event: FocusEvent) => {
      if (isFocusableTextTarget(event.target)) {
        setIsFocusOpen(true)
      }
    }

    const onFocusOut = () => {
      window.setTimeout(() => {
        const active = document.activeElement
        setIsFocusOpen(isFocusableTextTarget(active))
      }, 0)
    }

    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    evaluateViewport()

    const viewport = window.visualViewport
    if (viewport) {
      viewport.addEventListener('resize', evaluateViewport)
      viewport.addEventListener('scroll', evaluateViewport)
    }

    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      if (viewport) {
        viewport.removeEventListener('resize', evaluateViewport)
        viewport.removeEventListener('scroll', evaluateViewport)
      }
    }
  }, [])

  const value = useMemo(
    () => ({ isKeyboardOpen: isFocusOpen || isViewportOpen }),
    [isFocusOpen, isViewportOpen]
  )

  return (
    <KeyboardVisibilityContext.Provider value={value}>
      {children}
    </KeyboardVisibilityContext.Provider>
  )
}

export function useKeyboardVisibility() {
  return useContext(KeyboardVisibilityContext)
}

