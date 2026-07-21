// app/(admin)/admin/users/page.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  Search, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, X, UserPlus,
  Eye, EyeOff, Copy, Check, Building2,
} from 'lucide-react'

interface User {
  id: string
  name: string
  email: string
  phone: string
  role: string
  trustLevel: string
  isSuspended: boolean
  penaltyPoints: number
  createdAt: string
  university?: { id: string; shortName: string; name: string } | null
  _count: {
    ordersAsBuyer: number
    ordersAsSeller: number
    products: number
  }
}

interface University {
  id: string
  name: string
  shortName: string
  location: string
}

interface SuspendDialogState {
  userId: string
  userName: string
  reason: string
  days: string
}

interface CreateRiderForm {
  name: string
  phone: string
  email: string
  password: string
  universityId: string
}

type RiderInputField = 'name' | 'phone' | 'email'

const PAGE_SIZE = 50

const RIDER_FIELDS = [
  { label: 'Full Name', field: 'name', type: 'text', placeholder: 'Rider full name' },
  { label: 'Phone Number', field: 'phone', type: 'tel', placeholder: '080xxxxxxxx' },
  { label: 'Email Address', field: 'email', type: 'email', placeholder: 'rider@email.com' },
] as const satisfies ReadonlyArray<{
  label: string
  field: RiderInputField
  type: 'text' | 'tel' | 'email'
  placeholder: string
}>

export default function UsersPage() {
  const [users, setUsers]               = useState<User[]>([])
  const [total, setTotal]               = useState(0)
  const [page, setPage]                 = useState(1)
  const [loading, setLoading]           = useState(true)
  const [searchQuery, setSearchQuery]   = useState('')
  const [filterRole, setFilterRole]     = useState<string>('ALL')
  const [selectedUni, setSelectedUni]   = useState('all')
  const [universities, setUniversities] = useState<University[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  const [suspendDialog, setSuspendDialog]     = useState<SuspendDialogState | null>(null)
  const [unsuspendTarget, setUnsuspendTarget] = useState<{ userId: string; userName: string } | null>(null)

  const [showCreateRider, setShowCreateRider]     = useState(false)
  const [showPassword, setShowPassword]           = useState(false)
  const [createLoading, setCreateLoading]         = useState(false)
  const [createError, setCreateError]             = useState('')
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string; email: string; password: string; university: string
  } | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const [riderForm, setRiderForm] = useState<CreateRiderForm>({
    name: '', phone: '', email: '', password: '', universityId: '',
  })

  // Load universities once
  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    fetch('/api/universities', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setUniversities(data.universities ?? []))
      .catch(() => {})
  }, [])

  // Refetch when filters change
  useEffect(() => {
    setPage(1)
  }, [selectedUni, filterRole, searchQuery])

  useEffect(() => {
    fetchUsers(page)
  }, [page, selectedUni, filterRole])

  const fetchUsers = async (p: number) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const qs = new URLSearchParams({
        page:    String(p),
        limit:   String(PAGE_SIZE),
        ...(selectedUni !== 'all' ? { universityId: selectedUni } : {}),
        ...(filterRole !== 'ALL'  ? { role: filterRole }          : {}),
        ...(searchQuery.trim()    ? { search: searchQuery.trim() } : {}),
      })
      const response = await fetch(`/api/admin/users?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
        setTotal(data.total ?? data.users.length)
      } else {
        showToast('Failed to load users', 'error')
      }
    } catch {
      showToast('Network error loading users', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Search on Enter
  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') fetchUsers(1)
  }

  // ── Create Rider ──────────────────────────────────────────────────────────
  const handleCreateRider = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    if (!riderForm.universityId)   { setCreateError('Please select a university'); return }
    if (riderForm.password.length < 8) { setCreateError('Password must be at least 8 characters'); return }
    if (!/\d/.test(riderForm.password)) { setCreateError('Password must contain at least one number'); return }

    setCreateLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const res   = await fetch('/api/admin/riders/create', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(riderForm),
      })
      const data = await res.json()
      if (res.ok) {
        const uni = universities.find(u => u.id === riderForm.universityId)
        setCreatedCredentials({
          name:       riderForm.name,
          email:      riderForm.email,
          password:   riderForm.password,
          university: uni?.shortName ?? '',
        })
        fetchUsers(page)
      } else {
        setCreateError(data.error || 'Failed to create rider')
      }
    } catch {
      setCreateError('Network error. Please try again.')
    } finally {
      setCreateLoading(false)
    }
  }

  const closeCreateRider = () => {
    setShowCreateRider(false)
    setCreatedCredentials(null)
    setCreateError('')
    setShowPassword(false)
    setRiderForm({ name: '', phone: '', email: '', password: '', universityId: '' })
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    })
  }

  // ── Suspend / Unsuspend ───────────────────────────────────────────────────
  const handleSuspendSubmit = async () => {
    if (!suspendDialog) return
    const { userId, reason, days } = suspendDialog
    const parsedDays = parseInt(days) || 30
    setActionLoading(userId)
    setSuspendDialog(null)
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reason, days: parsedDays }),
      })
      if (res.ok) {
        showToast('User suspended successfully')
        fetchUsers(page)
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to suspend user', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUnsuspend = async () => {
    if (!unsuspendTarget) return
    const { userId } = unsuspendTarget
    setActionLoading(userId)
    setUnsuspendTarget(null)
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/admin/users/${userId}/unsuspend`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        showToast('User unsuspended successfully')
        fetchUsers(page)
      } else {
        const data = await res.json().catch(() => null)
        showToast(data?.error || 'Failed to unsuspend user', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const selectedUniName = selectedUni === 'all'
    ? 'All Universities'
    : universities.find(u => u.id === selectedUni)?.shortName ?? ''

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-ink text-sm font-medium shadow-soft ${
          toast.type === 'success' ? 'bg-success' : 'bg-danger'
        }`}>
          {toast.message}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Users</h1>
          <p className="text-sm text-ink-secondary mt-0.5">
            {total.toLocaleString()} users · <span className="text-ink font-medium">{selectedUniName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* University switcher */}
          <div className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-2">
            <Building2 className="w-4 h-4 text-ink-secondary flex-shrink-0" />
            <select
              value={selectedUni}
              onChange={e => setSelectedUni(e.target.value)}
              className="bg-transparent text-ink text-sm font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Universities</option>
              {universities.map(u => (
                <option key={u.id} value={u.id}>{u.shortName}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowCreateRider(true)}
            className="flex items-center gap-2 px-4 py-2 bg-danger hover:brightness-95 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add Rider
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary" />
          <input
            type="text"
            placeholder="Search by name, email, or phone…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKey}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-border rounded-xl text-ink text-sm placeholder-ink-muted focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="px-4 py-2.5 bg-white border border-border rounded-xl text-ink text-sm focus:outline-none cursor-pointer"
        >
          <option value="ALL">All Roles</option>
          <option value="BUYER">Buyers</option>
          <option value="SELLER">Sellers</option>
          <option value="RIDER">Riders</option>
        </select>
        <button
          onClick={() => fetchUsers(1)}
          className="px-4 py-2.5 bg-surface hover:bg-border text-ink text-sm rounded-xl transition-colors"
        >
          Search
        </button>
      </div>

      {/* ── Table ── */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-ink-secondary">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-ink-secondary uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-ink-secondary uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-ink-secondary uppercase tracking-wider">University</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-ink-secondary uppercase tracking-wider">Trust</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-ink-secondary uppercase tracking-wider">Activity</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-ink-secondary uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-ink-secondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-ink font-medium text-sm">{user.name}</p>
                        <p className="text-ink-secondary text-xs">{user.email || user.phone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'SELLER' ? 'bg-success/10 text-success' :
                        user.role === 'RIDER'  ? 'bg-primary/10 text-primary' :
                        'bg-surface text-ink-secondary'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-ink-secondary text-xs">{user.university?.shortName ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.trustLevel === 'GOLD'     ? 'bg-warning/10 text-warning' :
                        user.trustLevel === 'SILVER'   ? 'bg-surface text-ink-secondary' :
                        user.trustLevel === 'VERIFIED' ? 'bg-primary/10 text-primary' :
                        'bg-warning/10 text-warning'
                      }`}>
                        {user.trustLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-secondary">
                      {user._count.ordersAsBuyer} orders · {user._count.products} products
                    </td>
                    <td className="px-4 py-3">
                      {user.isSuspended ? (
                        <span className="flex items-center gap-1 text-danger text-xs">
                          <XCircle className="w-3 h-3" /> Suspended
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-success text-xs">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {actionLoading === user.id ? (
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : user.isSuspended ? (
                        <button
                          onClick={() => setUnsuspendTarget({ userId: user.id, userName: user.name })}
                          className="text-xs text-success hover:text-success font-medium"
                        >
                          Unsuspend
                        </button>
                      ) : (
                        <button
                          onClick={() => setSuspendDialog({ userId: user.id, userName: user.name, reason: '', days: '30' })}
                          className="text-xs text-danger hover:text-danger font-medium"
                        >
                          Suspend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-secondary">
            Page {page} of {totalPages} · {total.toLocaleString()} total
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-2 bg-white border border-border rounded-xl text-ink-secondary hover:text-ink disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-2 bg-white border border-border rounded-xl text-ink-secondary hover:text-ink disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Suspend Dialog ── */}
      {suspendDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSuspendDialog(null)} />
          <div className="relative bg-white border border-border rounded-2xl p-6 w-full max-w-sm z-10">
            <h3 className="text-lg font-semibold text-ink mb-1">Suspend User</h3>
            <p className="text-sm text-ink-secondary mb-4">{suspendDialog.userName}</p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs text-ink-secondary mb-1">Reason</label>
                <textarea
                  value={suspendDialog.reason}
                  onChange={e => setSuspendDialog({ ...suspendDialog, reason: e.target.value })}
                  rows={3}
                  placeholder="Reason for suspension…"
                  className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-ink text-sm focus:outline-none focus:border-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1">Duration (days)</label>
                <input
                  type="number"
                  value={suspendDialog.days}
                  onChange={e => setSuspendDialog({ ...suspendDialog, days: e.target.value })}
                  min="1"
                  className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-ink text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSuspendDialog(null)} className="flex-1 py-2.5 border border-border rounded-xl text-ink-secondary text-sm hover:bg-surface">Cancel</button>
              <button
                onClick={handleSuspendSubmit}
                disabled={!suspendDialog.reason.trim()}
                className="flex-1 py-2.5 bg-danger hover:brightness-95 disabled:opacity-40 rounded-xl text-white text-sm font-semibold"
              >
                Suspend
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unsuspend Confirm ── */}
      {unsuspendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setUnsuspendTarget(null)} />
          <div className="relative bg-white border border-border rounded-2xl p-6 w-full max-w-sm z-10">
            <h3 className="text-lg font-semibold text-ink mb-2">Unsuspend User</h3>
            <p className="text-sm text-ink-secondary mb-5">Remove suspension from <span className="text-ink">{unsuspendTarget.userName}</span>?</p>
            <div className="flex gap-3">
              <button onClick={() => setUnsuspendTarget(null)} className="flex-1 py-2.5 border border-border rounded-xl text-ink-secondary text-sm hover:bg-surface">Cancel</button>
              <button onClick={handleUnsuspend} className="flex-1 py-2.5 bg-success hover:brightness-95 rounded-xl text-white text-sm font-semibold">Unsuspend</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Rider Modal ── */}
      {showCreateRider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeCreateRider} />
          <div className="relative bg-white border border-border rounded-2xl p-6 w-full max-w-md z-10 max-h-[90vh] overflow-y-auto">
            {createdCredentials ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-ink">Rider Created!</h3>
                    <p className="text-xs text-ink-secondary">{createdCredentials.university}</p>
                  </div>
                </div>
                <p className="text-sm text-ink-secondary mb-4">Share these login credentials securely with the rider:</p>
                <div className="space-y-3 mb-5">
                  {[
                    { label: 'Name',     value: createdCredentials.name,     field: 'name' },
                    { label: 'Email',    value: createdCredentials.email,    field: 'email' },
                    { label: 'Password', value: createdCredentials.password, field: 'password' },
                  ].map(({ label, value, field }) => (
                    <div key={field} className="flex items-center justify-between bg-surface rounded-xl px-4 py-3">
                      <div>
                        <p className="text-xs text-ink-secondary">{label}</p>
                        <p className="text-ink font-mono text-sm">{value}</p>
                      </div>
                      <button onClick={() => copyToClipboard(value, field)} className="text-ink-secondary hover:text-ink">
                        {copiedField === field ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={closeCreateRider} className="w-full py-3 bg-surface hover:bg-border rounded-xl text-ink text-sm font-semibold">Done</button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-semibold text-ink">Create Rider Account</h3>
                  <button onClick={closeCreateRider} className="text-ink-secondary hover:text-ink"><X className="w-5 h-5" /></button>
                </div>
                {createError && (
                  <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm">{createError}</div>
                )}
                <form onSubmit={handleCreateRider} className="space-y-4">
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">University</label>
                    <select
                      value={riderForm.universityId}
                      onChange={e => setRiderForm({ ...riderForm, universityId: e.target.value })}
                      required
                      className="w-full px-3 py-2.5 bg-surface border border-border rounded-xl text-ink text-sm focus:outline-none focus:border-primary"
                    >
                      <option value="">Select university…</option>
                      {universities.map(u => (
                        <option key={u.id} value={u.id}>{u.shortName} — {u.name}</option>
                      ))}
                    </select>
                  </div>
                  {RIDER_FIELDS.map(({ label, field, type, placeholder }) => (
                    <div key={field}>
                      <label className="block text-xs text-ink-secondary mb-1">{label}</label>
                      <input
                        type={type}
                        value={riderForm[field]}
                        onChange={e => setRiderForm({ ...riderForm, [field]: e.target.value })}
                        placeholder={placeholder}
                        required
                        className="w-full px-3 py-2.5 bg-surface border border-border rounded-xl text-ink text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={riderForm.password}
                        onChange={e => setRiderForm({ ...riderForm, password: e.target.value })}
                        placeholder="Min 8 chars, at least 1 number"
                        required
                        className="w-full px-3 py-2.5 pr-10 bg-surface border border-border rounded-xl text-ink text-sm focus:outline-none focus:border-primary"
                      />
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-secondary">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="w-full py-3 bg-danger hover:brightness-95 disabled:opacity-50 rounded-xl text-white text-sm font-semibold transition-colors"
                  >
                    {createLoading ? 'Creating…' : 'Create Rider'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
