'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

export interface RiderPoint {
  lat: number
  lng: number
  heading?: number | null
}

// Slightly longer than the 5s poll, so the pin is still gliding when the next
// point arrives and motion reads as continuous rather than step-and-wait.
const GLIDE_MS = 5500

const PIN_HTML = `
  <div style="position:relative;width:22px;height:22px">
    <span style="position:absolute;inset:0;border-radius:9999px;background:rgba(19,19,17,.18);animation:riderPulse 1.8s ease-out infinite"></span>
    <span style="position:absolute;inset:4px;border-radius:9999px;background:#131311;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>
  </div>`

/**
 * Leaflet map with one rider pin that glides between GPS fixes and a trail of
 * where the rider has been. Replaces the Google Maps iframe, which reloaded a
 * static pin on every poll.
 *
 * Leaflet touches `window` on import, so it is loaded inside the effect; the
 * parent should render this component client-side only (it already is).
 */
export default function LiveRiderMap({
  points,
  className,
}: {
  points: RiderPoint[]
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const trailRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const frameRef = useRef<number | null>(null)
  const currentRef = useRef<{ lat: number; lng: number } | null>(null)
  const latestPointsRef = useRef<RiderPoint[]>(points)
  latestPointsRef.current = points

  const apply = (L: any, pts: RiderPoint[]) => {
    const map = mapRef.current
    if (!map || pts.length === 0) return
    const target = pts[pts.length - 1]

    trailRef.current?.setLatLngs(pts.map(p => [p.lat, p.lng]))

    if (!markerRef.current) {
      markerRef.current = L.marker([target.lat, target.lng], {
        icon: L.divIcon({ html: PIN_HTML, className: '', iconSize: [22, 22], iconAnchor: [11, 11] }),
        keyboard: false,
      }).addTo(map)
      currentRef.current = { lat: target.lat, lng: target.lng }
      map.setView([target.lat, target.lng], 17)
      return
    }

    const from = currentRef.current ?? { lat: target.lat, lng: target.lng }
    if (from.lat === target.lat && from.lng === target.lng) return

    if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / GLIDE_MS)
      const lat = from.lat + (target.lat - from.lat) * t
      const lng = from.lng + (target.lng - from.lng) * t
      markerRef.current.setLatLng([lat, lng])
      currentRef.current = { lat, lng }
      // Follow the rider, but only pan when they near the edge so the map
      // doesn't fight a buyer who is looking around.
      if (!map.getBounds().pad(-0.25).contains([lat, lng])) map.panTo([lat, lng], { animate: true })
      if (t < 1) frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current || mapRef.current) return
      leafletRef.current = L
      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)
      trailRef.current = L.polyline([], { color: '#131311', weight: 3, opacity: 0.55 }).addTo(map)
      mapRef.current = map
      apply(L, latestPointsRef.current)
    })()

    return () => {
      cancelled = true
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
      trailRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (leafletRef.current) apply(leafletRef.current, points)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points])

  return (
    <>
      <style>{`@keyframes riderPulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.2);opacity:0}}`}</style>
      <div ref={containerRef} className={className} />
    </>
  )
}
