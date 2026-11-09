'use client'

// Thin wrapper around html5-qrcode: rear camera, starts when `active` becomes true.
// The parent decides what to do with each decoded text (and ignores decodes while busy).

import { useEffect, useRef } from 'react'

interface Props {
  active: boolean
  onDecode: (text: string) => void
  onError: (message: string) => void
}

const READER_ID = 'checker-reader'

function explain(err: unknown): string {
  const name = (err as any)?.name ?? ''
  const msg = String((err as any)?.message ?? err ?? '')
  if (name === 'NotAllowedError' || /permission|denied|notallowed/i.test(msg)) {
    return 'Camera access was blocked. Allow the camera for this site in your browser settings, then tap Start camera again.'
  }
  if (name === 'NotFoundError' || /no camera|not found|requested device/i.test(msg)) return 'No camera was found on this device.'
  if (name === 'NotReadableError' || /in use|not readable/i.test(msg)) return 'The camera is being used by another app. Close it and try again.'
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'The camera only works on a secure (https) page.'
  return 'Could not start the camera. Check permissions and try again.'
}

export default function ScannerCamera({ active, onDecode, onError }: Props) {
  const scannerRef = useRef<any>(null)
  const onDecodeRef = useRef(onDecode)
  const onErrorRef = useRef(onError)
  onDecodeRef.current = onDecode
  onErrorRef.current = onError

  useEffect(() => {
    if (!active) return
    let cancelled = false
    let started = false

    ;(async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        if (cancelled) return
        const scanner = new Html5Qrcode(READER_ID, { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] })
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (w: number, h: number) => {
              const side = Math.floor(Math.min(w, h) * 0.78)
              return { width: side, height: side }
            },
            aspectRatio: 1,
          },
          (text: string) => onDecodeRef.current(text),
          () => { /* per-frame "no QR found" noise */ },
        )
        started = true
        if (cancelled) {
          await scanner.stop().catch(() => {})
          try { scanner.clear() } catch { /* ignore */ }
        }
      } catch (err) {
        if (!cancelled) onErrorRef.current(explain(err))
      }
    })()

    return () => {
      cancelled = true
      const s = scannerRef.current
      scannerRef.current = null
      if (s && started) {
        Promise.resolve(s.stop()).catch(() => {}).finally(() => { try { s.clear() } catch { /* ignore */ } })
      }
    }
  }, [active])

  return <div id={READER_ID} className="w-full overflow-hidden rounded-2xl bg-black [&_video]:!w-full [&_video]:!object-cover" />
}
