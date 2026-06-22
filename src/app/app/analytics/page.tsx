'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatRupiah } from '@/types'
import TenantPicker from '@/components/TenantPicker'
import type { SessionPayload } from '@/types'

// ============================================================
// Halaman Analytics — Menu Terlaris, Jam Tersibuk, Tren Penjualan
// Role: owner, supervisor
// ============================================================

interface Tenant { id: string; name: string; color: string }
interface TopMenuRow { name: string; qty: number; revenue: number }
interface HourlyRow { hour: number; count: number }
interface DailyRow { date: string; orders: number; revenue: number }

const RANGE_OPTIONS = [
  { label: '7 Hari', days: 7 },
  { label: '30 Hari', days: 30 },
]

export default function AnalyticsPage() {
  const [session, setSession]   = useState<SessionPayload | null>(null)
  const [tenants, setTenants]   = useState<Tenant[]>([])
  const [selectedTenant, setSelectedTenant] = useState('')
  const [days, setDays]         = useState(7)
  const [topMenu, setTopMenu]   = useState<TopMenuRow[]>([])
  const [hourly, setHourly]     = useState<HourlyRow[]>([])
  const [daily, setDaily]       = useState<DailyRow[]>([])
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => {
      setSession(d.session)
      if (d.session?.selectedTenantId) setSelectedTenant(d.session.selectedTenantId)
    })
    fetch('/api/tenants').then(r => r.json()).then(d => setTenants(d.tenants ?? []))
  }, [])

  const loadAnalytics = useCallback(async (tenantId: string, d: number) => {
    setLoading(true)
    const res = await fetch(`/api/analytics?tenantId=${tenantId}&days=${d}`)
    const data = await res.json()
    setTopMenu(data.topMenu ?? [])
    setHourly(data.hourlyDistribution ?? [])
    setDaily(data.dailyTrend ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (selectedTenant) loadAnalytics(selectedTenant, days)
  }, [selectedTenant, days, loadAnalytics])

  const maxHourly = Math.max(1, ...hourly.map(h => h.count))
  const maxDaily  = Math.max(1, ...daily.map(d => d.revenue))
  const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0)
  const totalOrders  = daily.reduce((s, d) => s + d.orders, 0)
  const peakHour = hourly.reduce((max, h) => h.count > max.count ? h : max, { hour: 0, count: 0 })

  // ── Pilih tenant dulu ───────────────────────────────────────
  if (!selectedTenant) {
    return (
      <div>
        <TenantPicker tenants={tenants} selected={selectedTenant} onSelect={setSelectedTenant} />
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-3">🏪</p>
          <p className="font-medium">Pilih tenant dulu</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {!session?.selectedTenantId && <TenantPicker tenants={tenants} selected={selectedTenant} onSelect={setSelectedTenant} />}
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold">Analytics</h1>
          <div className="flex gap-1.5">
            {RANGE_OPTIONS.map(opt => (
              <button key={opt.days} onClick={() => setDays(opt.days)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                  ${days === opt.days ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <a href="/app/staff-kpi" className="inline-block text-xs font-medium bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full active:bg-gray-200 mb-4">
          👤 Staff KPI →
        </a>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Ringkasan */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="card text-center bg-gray-900 text-white">
                <p className="text-xs text-gray-400">Total Penjualan</p>
                <p className="text-lg font-bold">{formatRupiah(totalRevenue)}</p>
              </div>
              <div className="card text-center">
                <p className="text-xs text-gray-500">Total Order</p>
                <p className="text-lg font-bold">{totalOrders}</p>
              </div>
            </div>

            {/* Tren harian */}
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Tren Penjualan</p>
            {daily.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">Belum ada data</p>
            ) : (
              <div className="card mb-4">
                <div className="flex gap-1.5 h-32">
                  {daily.map(d => (
                    <div key={d.date} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
                      <div className="w-full bg-gray-900 rounded-t-md" style={{ height: `${Math.max(4, (d.revenue / maxDaily) * 100)}%` }} />
                      <span className="text-[9px] text-gray-400">{d.date.slice(8, 10)}/{d.date.slice(5, 7)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Jam tersibuk */}
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Jam Tersibuk {peakHour.count > 0 && `· Peak ${String(peakHour.hour).padStart(2, '0')}:00 (${peakHour.count} order)`}
            </p>
            <div className="card mb-4">
              <div className="flex gap-0.5 h-24">
                {hourly.map(h => (
                  <div key={h.hour} className="flex-1 h-full flex flex-col items-center justify-end gap-0.5" title={`${h.hour}:00 — ${h.count} order`}>
                    <div className={`w-full rounded-t-sm ${h.hour === peakHour.hour && h.count > 0 ? 'bg-amber-500' : 'bg-gray-300'}`}
                      style={{ height: `${Math.max(2, (h.count / maxHourly) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-gray-400 mt-1">
                <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
              </div>
            </div>

            {/* Menu terlaris */}
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Menu Terlaris</p>
            {topMenu.length === 0 ? (
              <p className="text-sm text-gray-400">Belum ada data</p>
            ) : (
              <div className="space-y-2">
                {topMenu.map((m, i) => (
                  <div key={m.name} className="card flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-400 w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{m.name}</p>
                      <p className="text-xs text-gray-500">{m.qty} terjual</p>
                    </div>
                    <p className="text-sm font-semibold">{formatRupiah(m.revenue)}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
