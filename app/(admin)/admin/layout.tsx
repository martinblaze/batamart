'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, Package, AlertTriangle,
  FileText, DollarSign, BarChart3, LogOut, Menu, X, Send, MessageSquare, Navigation, Database,
} from 'lucide-react'

const adminRoutes = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/admin',           color: 'text-blue-400' },
  { label: 'Users',     icon: Users,           href: '/admin/users',     color: 'text-violet-400' },
  { label: 'Products',  icon: Package,         href: '/admin/products',  color: 'text-green-400' },
  { label: 'Disputes',  icon: AlertTriangle,   href: '/admin/disputes',  color: 'text-orange-400' },
  { label: 'Reports',   icon: FileText,        href: '/admin/reports',   color: 'text-red-400' },
  { label: 'Oversized', icon: AlertTriangle,   href: '/admin/oversized', color: 'text-amber-400' },
  { label: 'Revenue',   icon: DollarSign,      href: '/admin/revenue',   color: 'text-emerald-400' },
  { label: 'Analytics', icon: BarChart3,       href: '/admin/analytics', color: 'text-cyan-400' },
  { label: 'Usage',     icon: Database,        href: '/admin/usage',     color: 'text-indigo-400' },
  { label: 'Support',   icon: MessageSquare,   href: '/admin/support',   color: 'text-pink-400' },
  { label: 'Push Test', icon: Send,           href: '/admin/push',      color: 'text-rose-400' },
  { label: 'Rider GPS', icon: Navigation,      href: '/admin/rider-tracking', color: 'text-sky-400' },
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
    <div className="min-h-screen bg-gray-900">

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-4 bg-gray-800 border-b border-gray-700">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">B</span>
          </div>
          <h1 className="text-lg font-bold text-white">BATAMART Admin</h1>
        </Link>
        <button
          onClick={() => setSidebarOpen(prev => !prev)}
          className="text-gray-400 hover:text-white p-2"
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-[60] bg-gray-900/80"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — inline style controls transform to avoid Tailwind purge issues */}
      <div
        style={{
          transform: sidebarTransform,
          transition: 'transform 300ms ease-in-out',
        }}
        className="fixed top-0 left-0 z-[70] h-full w-64 bg-gray-800 border-r border-gray-700"
      >
        <div className="flex flex-col h-full">

          {/* Logo — desktop */}
          <div className="hidden md:flex items-center h-16 px-4 border-b border-gray-700">
            <Link href="/admin" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">B</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">BATAMART</h1>
                <p className="text-xs text-gray-400">Admin Panel</p>
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
                  className={`
                    w-full group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all text-left
                    ${isActive
                      ? 'bg-gray-700 text-white shadow-lg'
                      : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                    }
                  `}
                >
                  <Icon className={`mr-3 h-5 w-5 shrink-0 ${isActive ? route.color : 'text-gray-500 group-hover:text-gray-400'}`} />
                  {route.label}
                </button>
              )
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gray-700">
            <button
              onClick={handleLogout}
              className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-red-400 bg-gray-700/50 rounded-lg hover:bg-red-500/10 hover:text-red-300 transition-all"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Logout
            </button>
          </div>

        </div>
      </div>

      {/* Main Content */}
      <div className="md:pl-64 pt-16 md:pt-0">
        <main className="min-h-screen p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

    </div>
  )
}
