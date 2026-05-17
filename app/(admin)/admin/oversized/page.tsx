'use client'

import { useEffect, useMemo, useState } from 'react'

export default function AdminOversizedPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    const token = localStorage.getItem('adminToken')
    const res = await fetch('/api/admin/oversized', { headers: { Authorization: `Bearer ${token}` } })
    const json = await res.json()
    setData(json)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const usersById = useMemo(() => Object.fromEntries((data?.users || []).map((u: any) => [u.id, u.name])), [data])
  const productsById = useMemo(() => Object.fromEntries((data?.products || []).map((p: any) => [p.id, p])), [data])

  const moderate = async (productId: string, action: 'APPROVE' | 'REMOVE') => {
    const token = localStorage.getItem('adminToken')
    await fetch('/api/admin/oversized', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, action }),
    })
    fetchData()
  }

  if (loading) return <div className="text-gray-300">Loading oversized reports...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Oversized Product Management</h1>

      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
        <h2 className="text-white font-bold mb-3">Decline Evidence</h2>
        <div className="space-y-3">
          {(data?.declines || []).map((d: any) => (
            <div key={d.id} className="bg-gray-700/30 rounded-xl p-3 text-sm text-gray-200">
              <p><span className="font-semibold">Product:</span> {productsById[d.productId]?.name || d.productId}</p>
              <p><span className="font-semibold">Seller:</span> {usersById[d.sellerId] || d.sellerId} | <span className="font-semibold">Rider:</span> {usersById[d.riderId] || d.riderId}</p>
              <p><span className="font-semibold">Reason:</span> {d.reason}</p>
              {d.proofImageUrl && <a className="text-blue-300 underline" href={d.proofImageUrl} target="_blank">View Proof Photo</a>}
              <div className="mt-2 flex gap-2">
                <button onClick={() => moderate(d.productId, 'APPROVE')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold">Approve Listing</button>
                <button onClick={() => moderate(d.productId, 'REMOVE')} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold">Remove Listing</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
        <h2 className="text-white font-bold mb-3">Seller Strike History</h2>
        <div className="space-y-2 text-sm text-gray-200">
          {(data?.strikes || []).map((s: any) => (
            <p key={s.id}>{usersById[s.sellerId] || s.sellerId} - Strike #{s.strikeCount} - {s.reason}</p>
          ))}
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
        <h2 className="text-white font-bold mb-3">Suspended Sellers</h2>
        <div className="space-y-2 text-sm text-gray-200">
          {(data?.suspendedSellers || []).map((u: any) => (
            <p key={u.id}>{u.name} - {u.suspensionReason || 'Suspended'} {u.suspendedUntil ? `(until ${new Date(u.suspendedUntil).toLocaleDateString()})` : '(permanent)'}</p>
          ))}
        </div>
      </div>
    </div>
  )
}
