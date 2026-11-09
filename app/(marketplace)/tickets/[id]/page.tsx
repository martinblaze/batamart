'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/marketplace/DetailChrome'
import LiveTicket from '@/components/tickets/LiveTicket'

export default function TicketPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Signed-in owners only. (Guests use their emailed /t/<token> link.)
    if (!localStorage.getItem('token')) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)
      return
    }
    setReady(true)
  }, [router])

  return (
    <div className="min-h-screen bg-surface pb-24">
      <PageHeader eyebrow="Ticket" title="My ticket" back="/tickets" />
      <div className="mx-auto max-w-md px-4 py-6">
        {ready && <LiveTicket ticketId={params.id} />}
      </div>
    </div>
  )
}
