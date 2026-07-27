'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import SpotlightTour, { SpotlightStep } from './SpotlightTour'

const STORAGE_KEY = 'bata_gfd_tour'
const TRIGGER_PARAM_VALUE = 'girlfriends-day-sell'

type Phase = 'entry' | 'hamburger-sell' | 'desktop-sell' | 'checkbox'

const ENTRY_SELECTORS = ['[data-tour="tour-sell-plus"]', '[data-tour="tour-hamburger"]', '[data-tour="tour-user-dropdown"]']

const STEPS: Record<Phase, SpotlightStep> = {
  entry: {
    selectors: ENTRY_SELECTORS,
    title: 'Tap here to sell',
    body: "This is where you list a new product or gift package for Girlfriend's Day.",
  },
  'hamburger-sell': {
    selectors: ['[data-tour="tour-hamburger-sell"]'],
    title: 'Now tap Sell',
    body: 'Tap "Sell" to open the listing form.',
  },
  'desktop-sell': {
    selectors: ['[data-tour="tour-desktop-sell"]'],
    title: 'Now click Sell',
    body: 'Click "Sell" to open the listing form.',
  },
  checkbox: {
    selectors: ['[data-tour="tour-gfd-checkbox"]'],
    title: "Tag it for Girlfriend's Day",
    body: "Tick this box when listing your product. Selling a gift package? Describe everything inside the box so buyers know exactly what they're getting.",
    isFinalStep: true,
  },
}

function readStoredPhase(): Phase | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.phase && parsed.phase in STEPS ? (parsed.phase as Phase) : null
  } catch {
    return null
  }
}

function writePhase(phase: Phase | null) {
  try {
    if (phase) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ phase }))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {}
}

// Guided walkthrough triggered by tapping the Girlfriend's Day seller
// announcement notification. Landing with ?tour=girlfriends-day-sell starts
// it; the phase is persisted to sessionStorage so it survives the real page
// navigations the tour itself causes (hamburger -> Sell -> /sell).
export default function GirlfriendsDaySellTour() {
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<Phase | null>(null)

  useEffect(() => {
    if (searchParams.get('tour') === TRIGGER_PARAM_VALUE) {
      writePhase('entry')
      setPhase('entry')
      const url = new URL(window.location.href)
      url.searchParams.delete('tour')
      window.history.replaceState({}, '', url.pathname + url.search)
      return
    }
    setPhase(readStoredPhase())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const finish = useCallback(() => {
    writePhase(null)
    setPhase(null)
  }, [])

  const advance = useCallback((matchedSelector: string) => {
    if (phase === 'entry') {
      const next: Phase =
        matchedSelector === '[data-tour="tour-hamburger"]' ? 'hamburger-sell' :
        matchedSelector === '[data-tour="tour-user-dropdown"]' ? 'desktop-sell' :
        'checkbox'
      writePhase(next)
      setPhase(next)
      return
    }
    if (phase === 'hamburger-sell' || phase === 'desktop-sell') {
      writePhase('checkbox')
      setPhase('checkbox')
      return
    }
    if (phase === 'checkbox') {
      finish()
    }
  }, [phase, finish])

  if (!phase) return null

  return (
    <SpotlightTour
      step={STEPS[phase]}
      onTargetClick={advance}
      onSkip={finish}
      onGotIt={finish}
    />
  )
}
