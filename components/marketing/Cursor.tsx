'use client'

import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useState } from 'react'

/**
 * A small blend-mode dot that trails the pointer.
 *
 * It never replaces the system cursor — hiding the real one costs more in
 * usability than it buys in polish, and breaks the moment JS is slow. This
 * rides alongside it, grows over interactive targets, and gets out of the way
 * entirely inside the magnetic buttons, which already have their own feedback.
 */
export function Cursor() {
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const sx = useSpring(x, { stiffness: 900, damping: 46, mass: 0.28 })
  const sy = useSpring(y, { stiffness: 900, damping: 46, mass: 0.28 })

  const [scale, setScale] = useState(1)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const move = (e: PointerEvent) => {
      x.set(e.clientX - 6)
      y.set(e.clientY - 6)
      if (!visible) setVisible(true)

      const target = (e.target as HTMLElement)?.closest?.(
        'a, button, [data-cursor], input, textarea, select, summary',
      ) as HTMLElement | null

      if (!target) {
        setScale(1)
      } else if (target.dataset.cursor === 'hide') {
        setScale(0)
      } else {
        setScale(3.4)
      }
    }

    const out = () => setVisible(false)

    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerleave', out)
    return () => {
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', out)
    }
  }, [x, y, visible])

  return (
    <motion.div
      className="mk-cursor"
      style={{ x: sx, y: sy }}
      animate={{ scale, opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      aria-hidden
    />
  )
}
