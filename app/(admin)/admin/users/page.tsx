// app/(admin)/admin/users/page.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  Search, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, X, UserPlus,
  Eye, EyeOff, Copy, Check, Building2,
} from 'lucide-react'
import {
  AdminHeader, AdminEmpty, AdminButton, AdminTable, Th, Td, Tr,
} from '@/components/admin/AdminUI'
import { Badge } from '@/components/ui/Badge'

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
        <div className={`fixed right-4 top-4 z-50 border px-4 py-3 text-sm font-medium ${
          toast.type === 'success'
            ? 'border-success/25 bg-success/10 text-success'
            : 'border-danger/25 bg-danger/10 text-danger'
        }`}>
          {toast.message}
        </div>
      )}

      {/* ── Header ── */}
      <AdminHeader
        eyebrow="Directory"
        title="Users"
        description={
          <>
            {total.toLocaleString()} accounts ·{' '}
            <span className="font-medium text-ink">{selectedUniName}</span>
          </>
        }
        actions={
          <>
            <div className="flex h-9 items-center gap-2 border border-border bg-card px-3">
              <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
              <select
                value={selectedUni}
                onChange={e => setSelectedUni(e.target.value)}
                aria-label="University"
                className="cursor-pointer bg-transparent text-[13px] text-ink focus:outline-none"
              >
                <option value="all">All universities</option>
                {universities.map(u => (
                  <option key={u.id} value={u.id}>{u.shortName}</option>
                ))}
              </select>
            </div>
            <AdminButton tone="ink" onClick={() => setShowCreateRider(true)} icon={UserPlus}>
              Add rider
            </AdminButton>
          </>
        }
      />

      {/* ── Filters ── */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="flex h-9 flex-1 items-center gap-2 border border-border bg-card px-3">
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
          <input
            type="text"
            placeholder="Search by name, email, or phone…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKey}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-muted focus:outline-none"
          />
        </div>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          aria-label="Filter by role"
          className="h-9 cursor-pointer border border-border bg-card px-3 text-[13px] text-ink transition-colors hover:border-ink/25 focus:border-ink/40 focus:outline-none"
        >
          <option value="ALL">All roles</option>
          <option value="BUYER">Buyers</option>
          <option value="SELLER">Sellers</option>
          <option value="RIDER">Riders</option>
        </select>
        <AdminButton tone="ink" onClick={() => fetchUsers(1)}>Search</AdminButton>
      </div>

      {/* ── Table ── */}
      <div className="border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-ink" />
          </div>
        ) : users.length === 0 ? (
          <AdminEmpty
            className="border-0"
            icon={Search}
            title="No users found"
            description="Nothing matches this search, role filter and university combination."
          />
        ) : (
          <AdminTable>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th>University</Th>
                <Th>Trust</Th>
                <Th>Activity</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <Tr key={user.id}>
                  <Td>
                    <p className="text-sm font-medium text-ink">{user.name}</p>
                    <p className="mt-0.5 text-xs text-ink-secondary">{user.email || user.phone}</p>
                  </Td>
                  <Td>
                    <Badge status="neutral">{user.role}</Badge>
                  </Td>
                  <Td>
                    <span className="text-xs text-ink-secondary">
                      {user.university?.shortName ?? '—'}
                    </span>
                  </Td>
                  <Td>
                    <Badge status={user.trustLevel === 'VERIFIED' ? 'verified' : user.trustLevel === 'GOLD' ? 'warning' : 'neutral'}>
                      {user.trustLevel}
                    </Badge>
                  </Td>
                  <Td>
                    <span className="ui-mono ui-mono-sm whitespace-nowrap text-ink-muted">
                      {user._count.ordersAsBuyer} orders · {user._count.products} products
                    </span>
                  </Td>
                  <Td>
                    {user.isSuspended ? (
                      <Badge status="danger" icon={XCircle}>Suspended</Badge>
                    ) : (
                      <Badge status="success" icon={CheckCircle}>Active</Badge>
                    )}
                  </Td>
                  <Td align="right">
                    {actionLoading === user.id ? (
                      <div className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-border border-t-ink" />
                    ) : user.isSuspended ? (
                      <button
                        onClick={() => setUnsuspendTarget({ userId: user.id, userName: user.name })}
                        className="ui-mono ui-mono-sm text-success transition-opacity hover:opacity-70"
                      >
                        Unsuspend
                      </button>
                    ) : (
                      <button
                        onClick={() => setSuspendDialog({ userId: user.id, userName: user.name, reason: '', days: '30' })}
                        className="ui-mono ui-mono-sm text-danger transition-opacity hover:opacity-70"
                      >
                        Suspend
                      </button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="ui-mono ui-mono-sm text-ink-muted">
            Page {page} / {totalPages} · {total.toLocaleString()} total
          </p>
          <div className="flex gap-2">
            <AdminButton disabled={page <= 1} onClick={() => setPage(p => p - 1)} icon={ChevronLeft}>
              Prev
            </AdminButton>
            <AdminButton disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            </AdminButton>
          </div>
        </div>
      )}

      {/* ── Suspend Dialog ── */}
      {suspendDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSuspendDialog(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm z-10">
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
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm z-10">
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
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md z-10 max-h-[90vh] overflow-y-auto">
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
