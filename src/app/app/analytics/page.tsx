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
interface ChannelRow { channel: string; orders: number; revenue: number }
interface DowRow { dow: number; label: string; orders: number; revenue: number; avgRevenue: number }
interface MenuEngRow { id: string; name: string; price: number; cogs: number; margin: number; qty: number; category: 'star' | 'plowhorse' | 'puzzle' | 'dog' }

const RANGE_OPTIONS = [
  { label: '7 Hari', days: 7 },
  { label: '30 Hari', days: 30 },
]

const CHANNEL_LABEL: Record<string, string> = {
  dine_in: '🪑 Di Sini', takeaway: '🛍️ Bawa', gofood: '🟢 GoFood',
  whatsapp: '💬 WA', grabfood: '🟡 GrabFood', shopeefood: '🟠 ShopeeFood', lainnya: '📦 Lainnya',
}

const QUADRANT: Record<MenuEngRow['category'], { label: string; icon: string; color: string; hint: string }> = {
  star:      { label: 'Bintang',     icon: '⭐', color: 'bg-green-50 text-green-700 border-green-200',  hint: 'Laku & untung — pertahankan' },
  plowhorse: { label: 'Kuda Beban',  icon: '🐴', color: 'bg-amber-50 text-amber-700 border-amber-200',  hint: 'Laku tapi margin tipis — naikkan harga?' },
  puzzle:    { label: 'Teka-teki',   icon: '🧩', color: 'bg-blue-50 text-blue-700 border-blue-200',     hint: 'Untung tapi jarang — promosikan' },
  dog:       { label: 'Anjing',      icon: '🐕', color: 'bg-gray-100 text-gray-600 border-gray-200',    hint: 'Jarang & tipis — pertimbangkan stop' },
}

export default function AnalyticsPage() {
  const [session, setSession]   = useState<SessionPayload | null>(null)
  const [tenants, setTenants]   = useState<Tenant[]>([])
  const [selectedTenant, setSelectedTenant] = useState('')
  const [days, setDays]         = useState(7)
  const [topMenu, setTopMenu]   = useState<TopMenuRow[]>([])
  const [hourly, setHourly]     = useState<HourlyRow[]>([])
  const [daily, setDaily]       = useState<DailyRow[]>([])
  const [channelSplit, setChannelSplit] = useState<ChannelRow[]>([])
  const [dayOfWeek, setDayOfWeek]       = useState<DowRow[]>([])
  const [menuEng, setMenuEng]           = useState<MenuEngRow[]>([])
  const [menuNoRecipe, setMenuNoRecipe] = useState<{ id: string; name: string }[]>([])
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
    setChannelSplit(data.channelSplit ?? [])
    setDayOfWeek(data.dayOfWeek ?? [])
    setMenuEng(data.menuEngineering ?? [])
    setMenuNoRecipe(data.menuNoRecipe ?? [])
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
  const channelTotal = channelSplit.reduce((s, c) => s + c.revenue, 0)
  const maxDow = Math.max(1, ...dayOfWeek.map(d => d.avgRevenue))

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

            {/* Channel split */}
            {channelSplit.length > 0 && (
              <>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Per Channel</p>
                <div className="card mb-4 space-y-2">
                  {channelSplit.map(c => {
                    const pct = channelTotal > 0 ? Math.round(c.revenue / channelTotal * 100) : 0
                    return (
                      <div key={c.channel}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium">{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
                          <span className="text-gray-500">{formatRupiah(c.revenue)} · {c.orders} order</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gray-900 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

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

            {/* Pola per hari */}
            {dayOfWeek.some(d => d.orders > 0) && (
              <>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Rata-rata per Hari</p>
                <div className="card mb-4">
                  <div className="flex gap-1.5 h-24">
                    {dayOfWeek.map(d => (
                      <div key={d.dow} className="flex-1 h-full flex flex-col items-center justify-end gap-1" title={`${d.label}: ${formatRupiah(d.avgRevenue)}/hari`}>
                        <div className="w-full bg-gray-700 rounded-t-md" style={{ height: `${Math.max(3, (d.avgRevenue / maxDow) * 100)}%` }} />
                        <span className="text-[9px] text-gray-400">{d.label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">Rata-rata penjualan per hari (bukan total) — bantu rencana stok & jadwal staff</p>
                </div>
              </>
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
              <p className="text-sm text-gray-400 mb-4">Belum ada data</p>
            ) : (
              <div className="space-y-2 mb-4">
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

            {/* Menu engineering quadrant */}
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Menu Engineering</p>
            {menuEng.length === 0 ? (
              <p className="text-sm text-gray-400 mb-2">
                Belum bisa dianalisis — set resep & harga bahan dulu di halaman Resep agar margin terhitung.
              </p>
            ) : (
              <div className="space-y-2">
                {menuEng.map(m => {
                  const q = QUADRANT[m.category]
                  return (
                    <div key={m.id} className={`card border ${q.color}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate text-gray-900">{m.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {m.qty} terjual · margin {formatRupiah(m.margin)} ({m.price > 0 ? Math.round(m.margin / m.price * 100) : 0}%)
                          </p>
                        </div>
                        <span className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ml-2">{q.icon} {q.label}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1.5">{q.hint}</p>
                    </div>
                  )
                })}
              </div>
            )}
            {menuNoRecipe.length > 0 && (
              <p className="text-[10px] text-gray-400 mt-2">
                {menuNoRecipe.length} menu belum punya resep (tidak masuk analisis): {menuNoRecipe.map(m => m.name).join(', ')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
