'use client'

import { useEffect, useMemo, useState } from 'react'
import { Heart } from 'lucide-react'

const CELEBRATION_CSS = `
  @keyframes hrfRiseFall {
    0%   { transform: translateY(0) scale(var(--hrf-s, 1)) rotate(var(--hrf-r, 0deg)); opacity: 0; }
    8%   { opacity: 1; }
    55%  { transform: translateY(calc(-1 * var(--hrf-peak, 55vh))) scale(var(--hrf-s, 1)) rotate(var(--hrf-r, 0deg)); opacity: 1; }
    82%  { opacity: 1; }
    100% { transform: translateY(calc(-1 * var(--hrf-peak, 55vh) + 20vh)) scale(var(--hrf-s, 1)) rotate(var(--hrf-r, 0deg)); opacity: 0; }
  }
  .hrf-heart {
    position: absolute;
    bottom: -40px;
    opacity: 0;
    animation-name: hrfRiseFall;
    animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
    animation-fill-mode: forwards;
    will-change: transform, opacity;
  }
`

const COLORS = ['#f43f5e', '#ec4899', '#fb7185', '#f472b6']

function makeHearts(count: number) {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    left: 4 + Math.random() * 92,
    peak: 40 + Math.random() * 45,
    size: 16 + Math.random() * 22,
    duration: 2.2 + Math.random() * 1.1,
    delay: Math.random() * 0.6,
    rotate: (Math.random() - 0.5) * 40,
    color: COLORS[i % COLORS.length],
  }))
}

// A short, once-off "wow" moment for Girlfriend's Day purchases — hearts rise
// from the bottom of the screen, peak, then drift back down as they fade.
// Purely decorative: non-interactive and self-removes after ~3.4s.
export default function GirlfriendsDayCelebration({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(true)
  const hearts = useMemo(() => makeHearts(22), [])

  useEffect(() => {
    if (document.getElementById('batamart-hrf-css')) return
    const s = document.createElement('style')
    s.id = 'batamart-hrf-css'
    s.textContent = CELEBRATION_CSS
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onDone?.() }, 3400)
    return () => clearTimeout(t)
  }, [onDone])

  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[9600] overflow-hidden">
      {hearts.map((h) => (
        <Heart
          key={h.id}
          className="hrf-heart"
          style={{
            left: `${h.left}%`,
            width: h.size,
            height: h.size,
            color: h.color,
            animationDuration: `${h.duration}s`,
            animationDelay: `${h.delay}s`,
            ['--hrf-peak' as string]: `${h.peak}vh`,
            ['--hrf-r' as string]: `${h.rotate}deg`,
          } as React.CSSProperties}
          fill="currentColor"
          strokeWidth={0}
        />
      ))}
    </div>
  )
}
