'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, Package, AlertTriangle,
  FileText, DollarSign, BarChart3, LogOut, Menu, X, Send, MessageSquare, Navigation, Database, Truck, ClipboardList, PackageCheck,
} from 'lucide-react'
import { Logo } from '@/components/layout/Logo'

// Design bible section 10 — admin is a data-dense SaaS shell matching the
// /my-shop sidebar pattern: flat, bordered, single primary accent, no
// per-item color variety.
const adminRoutes = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
  { label: 'Users',     icon: Users,           href: '/admin/users' },
  { label: 'Order intake', icon: ClipboardList, href: '/admin/order-intake' },
  { label: 'Sorting room', icon: PackageCheck, href: '/admin/sorting' },
  { label: 'Products',  icon: Package,         href: '/admin/products' },
  { label: 'Disputes',  icon: AlertTriangle,   href: '/admin/disputes' },
  { label: 'Reports',   icon: FileText,        href: '/admin/reports' },
  { label: 'Oversized', icon: AlertTriangle,   href: '/admin/oversized' },
  { label: 'Delivery Zones', icon: Truck,      href: '/admin/delivery-zones' },
  { label: 'Revenue',   icon: DollarSign,      href: '/admin/revenue' },
  { label: 'Analytics', icon: BarChart3,       href: '/admin/analytics' },
  { label: 'Usage',     icon: Database,        href: '/admin/usage' },
  { label: 'Support',   icon: MessageSquare,   href: '/admin/support' },
  { label: 'Push test', icon: Send,            href: '/admin/push' },
  { label: 'Rider GPS', icon: Navigation,      href: '/admin/rider-tracking' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const handleNavClick = (href: string) => {
    setSidebarOpen(false)
    router.push(href)
  }

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    document.cookie = 'adminToken=; path=/; max-age=0; SameSite=Strict'
    router.push('/admin-login')
  }

  // On mobile: controlled by sidebarOpen
  // On desktop: always visible (translateX(0))
  const sidebarTransform = isMobile
    ? sidebarOpen ? 'translateX(0)' : 'translateX(-100%)'
    : 'translateX(0)'

  return (
    <div className="min-h-screen bg-surface">

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-4 bg-card border-b border-border">
        <Logo size={28} href="/admin" />
        <button
          onClick={() => setSidebarOpen(prev => !prev)}
          className="text-ink-secondary hover:text-ink p-2"
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        >
          {sidebarOpen ? <X className="h-6 w-6" strokeWidth={1.75} /> : <Menu className="h-6 w-6" strokeWidth={1.75} />}
        </button>
      </div>

      {/* Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-[60] bg-ink/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — inline style controls transform to avoid Tailwind purge issues */}
      <div
        style={{
          transform: sidebarTransform,
          transition: 'transform 300ms ease-in-out',
        }}
        className="fixed top-0 left-0 z-[70] h-full w-64 bg-card border-r border-border"
      >
        <div className="flex flex-col h-full">

          {/* Logo — desktop */}
          <div className="hidden md:flex items-center h-16 px-4 border-b border-border">
            <Link href="/admin" className="flex items-center gap-2">
              <Logo size={28} showWordmark={false} />
              <div>
                <h1 className="text-[15px] leading-none text-ink">BataMart</h1>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                  Admin panel
                </p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto mt-16 md:mt-0">
            {adminRoutes.map((route) => {
              const Icon = route.icon
              const isActive = pathname === route.href

              return (
                <button
                  key={route.href}
                  onClick={() => handleNavClick(route.href)}
                  className={`group relative flex w-full items-center px-3 py-2.5 text-left text-[13px] font-medium transition-colors duration-300 ${
                    isActive
                      ? 'bg-surface text-ink before:absolute before:inset-y-1 before:left-0 before:w-[2px] before:bg-primary'
                      : 'text-ink-secondary hover:bg-surface hover:text-ink'
                  }`}
                >
                  <Icon className="mr-3 h-4 w-4 shrink-0" strokeWidth={1.75} />
                  {route.label}
                </button>
              )
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-border">
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center rounded-lg border border-border px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-secondary transition-colors duration-300 hover:border-danger/40 hover:text-danger"
            >
              <LogOut className="mr-2 h-4 w-4" strokeWidth={1.75} />
              Logout
            </button>
          </div>

        </div>
      </div>

      {/* Main Content */}
      <div className="md:pl-64 pt-16 md:pt-0">
        <main className="min-h-screen p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

    </div>
  )
}
