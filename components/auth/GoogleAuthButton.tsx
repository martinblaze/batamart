'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    google?: any
  }
}

type GoogleAuthButtonProps = {
  mode: 'login' | 'signup'
  payload?: Record<string, unknown>
  onError?: (message: string) => void
  onLoading?: (loading: boolean) => void
  onSuccess?: (data: any) => void
}

export default function GoogleAuthButton({
  mode,
  payload,
  onError,
  onLoading,
  onSuccess,
}: GoogleAuthButtonProps) {
  const buttonRef = useRef<HTMLDivElement | null>(null)
  const [ready, setReady] = useState(false)
  const [scriptError, setScriptError] = useState<string | null>(null)
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  useEffect(() => {
    if (!clientId) return
    const scriptId = 'google-gsi-client'
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => setReady(true)
      script.onerror = () => setScriptError('Could not load Google Sign-In script.')
      document.head.appendChild(script)
    } else {
      setReady(true)
    }
  }, [clientId])

  useEffect(() => {
    if (!ready || !buttonRef.current || !window.google || !clientId) return

    const handleCredentialResponse = async (response: { credential?: string }) => {
      const idToken = response?.credential
      if (!idToken) {
        onError?.('Google sign-in failed. Please try again.')
        return
      }

      onLoading?.(true)
      onError?.('')
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken,
            mode,
            ...(payload ?? {}),
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          onError?.(data.error || 'Google sign-in failed')
          return
        }

        if (onSuccess) {
          onSuccess(data)
          return
        }

        localStorage.setItem('token', data.token)
        localStorage.setItem('userName', data.user.name)
        localStorage.setItem('userRole', data.user.role || '')
        localStorage.setItem('userId', data.user.id)
        document.cookie = `token=${data.token}; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 7}`
        window.dispatchEvent(new Event('auth-change'))
        window.location.href = '/marketplace'
      } catch {
        onError?.('Network error. Please try again.')
      } finally {
        onLoading?.(false)
      }
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    })

    buttonRef.current.innerHTML = ''
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      width: 320,
      text: mode === 'signup' ? 'signup_with' : 'signin_with',
    })
  }, [ready, clientId, mode, payload, onError, onLoading, onSuccess])

  if (!clientId) {
    return (
      <div className="w-full text-center text-xs text-warning bg-warning/5 border border-warning/20 rounded-lg px-3 py-2">
        Google Sign-In is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID.
      </div>
    )
  }

  if (scriptError) {
    return (
      <div className="w-full text-center text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
        {scriptError}
      </div>
    )
  }

  return (
    <div className="w-full">
      <div ref={buttonRef} className="w-full flex justify-center" />
      {!ready && (
        <div className="mt-2 text-center text-xs text-ink-muted">
          Loading Google sign-in…
        </div>
      )}
    </div>
  )
}
