'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { SessionPayload, RoleName } from '@/types'

// ============================================================
// App Layout — Shell + Bottom Navigation
// Semua halaman /app/* (kecuali /app/login) menggunakan layout ini
// ============================================================

// Navigasi per role
const NAV_BY_ROLE: Record<RoleName, { href: string; icon: string; label: string }[]> = {
  owner: [
    { href: '/app/dashboard', icon: '📊', label: 'Dashboard' },
    { href: '/app/pos',       icon: '🛒', label: 'POS' },
    { href: '/app/kitchen',   icon: '🍳', label: 'Dapur' },
    { href: '/app/qa',        icon: '✅', label: 'QA' },
    { href: '/app/tasks',     icon: '📋', label: 'Tugas' },
  ],
  supervisor: [
    { href: '/app/qa',        icon: '✅', label: 'QA' },
    { href: '/app/tasks',     icon: '📋', label: 'Tugas' },
    { href: '/app/dashboard', icon: '📊', label: 'Laporan' },
  ],
  kasir: [
    { href: '/app/pos',       icon: '🛒', label: 'POS' },
    { href: '/app/cash',      icon: '💵', label: 'Kas' },
    { href: '/app/tasks',     icon: '📋', label: 'Tugas' },
  ],
  kitchen: [
    { href: '/app/kitchen',   icon: '🍳', label: 'Dapur' },
    { href: '/app/tasks',     icon: '📋', label: 'Tugas' },
  ],
  qa_checker: [
    { href: '/app/qa',        icon: '✅', label: 'QA' },
    { href: '/app/tasks',     icon: '📋', label: 'Tugas' },
  ],
  marketing_admin: [
    { href: '/app/dashboard', icon: '📊', label: 'Dashboard' },
    { href: '/app/tasks',     icon: '📋', label: 'Tugas' },
  ],
  viewer: [
    { href: '/app/dashboard', icon: '📊', label: 'Dashboard' },
  ],
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [session, setSession] = useState<SessionPayload | null>(null)

  // Baca session dari cookie via API (client-side)
  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.session) setSession(data.session)
      })
      .catch(() => {})
  }, [])

  const isLoginPage = pathname === '/app/login'
  if (isLoginPage) return <>{children}</>

  const role    = session?.primaryRole ?? 'kasir'
  const navItems = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.kasir

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/app/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="pt-safe bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">PF</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm">PFOS</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Nama user + role */}
          {session && (
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-700 leading-none">{session.name}</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5 capitalize">{role}</p>
            </div>
          )}

          {/* Tombol logout */}
          <button
            onClick={handleLogout}
            className="w-8 h-8 flex items-center justify-center text-gray-400
                       hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Keluar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Konten halaman */}
      <main className="flex-1 pb-nav">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {navItems.map(item => {
          const isActive = pathname.startsWith(item.href)
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl
                          transition-colors duration-100 min-w-[56px]
                          ${isActive
                            ? 'text-gray-900'
                            : 'text-gray-400 hover:text-gray-600'}`}
            >
              <span className="text-2xl leading-none">{item.icon}</span>
              <span className={`text-[10px] font-medium leading-none ${isActive ? 'text-gray-900' : ''}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-4 h-0.5 bg-gray-900 rounded-full" />
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
