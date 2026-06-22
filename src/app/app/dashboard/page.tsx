'use client'

import { useState, useEffect } from 'react'
import { formatRupiah } from '@/types'
import PushNotificationToggle from '@/components/PushNotificationToggle'
import type { DashboardAlert } from '@/types'

export default function DashboardPage() {
  const [loading, setLoading]         = useState(true)
  const [summary, setSummary]         = useState<any>(null)
  const [alerts, setAlerts]           = useState<DashboardAlert[]>([])
  const [tenantStats, setTenantStats] = useState<any[]>([])
  const [closingStatus, setClosingStatus] = useState<any[]>([])

  useEffect(() => {
    loadDashboard()
    // Polling tiap 15 detik (RLS blokir Supabase Realtime untuk session PIN-based)
    const interval = setInterval(loadDashboard, 15000)
    return () => clearInterval(interval)
  }, [])

  async function loadDashboard() {
    const res = await fetch('/api/dashboard')
    const data = await res.json()
    setAlerts(data.alerts ?? [])
    setTenantStats(data.tenantStats ?? [])
    setClosingStatus(data.tenantStats ?? [])
    setSummary(data.summary)
    setLoading(false)
  }

  async function resolveAlert(id: string) {
    await fetch('/api/dashboard', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" /></div>

  const redAlerts    = alerts.filter(a => a.severity === 'red')
  const yellowAlerts = alerts.filter(a => a.severity === 'yellow')
  const now = new Date()
  const isBeyondClosingTime = now.getHours() >= 13 && now.getMinutes() >= 30

  return (
    <div className="max-w-md mx-auto px-4 py-4">
      {/* Status hari */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-500">{now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-green-500 rounded-full pulse-dot" />
          <span className="text-xs text-gray-500">Live</span>
        </div>
      </div>

      <PushNotificationToggle />

      {/* Alert merah — paling atas */}
      {redAlerts.length > 0 && (
        <div className="mb-4">
          {redAlerts.map(a => (
            <div key={a.id} className="bg-red-600 text-white rounded-2xl p-4 mb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-sm">🚨 {a.type.replace(/_/g, ' ').toUpperCase()}</p>
                  <p className="text-sm mt-0.5 text-red-100">{a.message}</p>
                </div>
                <button onClick={() => resolveAlert(a.id)} className="text-red-200 text-xs shrink-0 mt-0.5">Selesai</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ringkasan revenue */}
      <div className="card mb-4 bg-gray-900 text-white">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Penjualan Hari Ini</p>
        <p className="text-3xl font-bold">{formatRupiah(summary?.totalRevenue ?? 0)}</p>
        <div className="flex gap-4 mt-2">
          <span className="text-sm text-gray-400">{summary?.totalOrders ?? 0} order</span>
          <span className="text-sm text-gray-400">Cash: {formatRupiah(summary?.totalCash ?? 0)}</span>
          <span className="text-sm text-gray-400">QRIS: {formatRupiah(summary?.totalQris ?? 0)}</span>
        </div>
      </div>

      {/* Per tenant */}
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Per Tenant</p>
      <div className="space-y-2 mb-4">
        {tenantStats.map(t => (
          <div key={t.id} className="card flex items-center gap-3">
            <div className="w-2.5 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{t.name}</p>
              <p className="text-xs text-gray-500">{t.orders} order</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-sm">{formatRupiah(t.revenue)}</p>
              {isBeyondClosingTime && (
                <span className={`text-xs ${t.closed ? 'text-green-600' : 'text-red-500'}`}>
                  {t.closed ? '✓ Closing' : '⚠ Belum closing'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Alert kuning */}
      {yellowAlerts.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Perhatian</p>
          {yellowAlerts.map(a => (
            <div key={a.id} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-2 flex items-start justify-between gap-2">
              <p className="text-sm text-amber-800">{a.message}</p>
              <button onClick={() => resolveAlert(a.id)} className="text-amber-500 text-xs shrink-0">OK</button>
            </div>
          ))}
        </div>
      )}

      {/* Semua aman */}
      {alerts.length === 0 && (
        <div className="card text-center bg-green-50 border-green-100">
          <p className="text-2xl mb-1">✅</p>
          <p className="text-sm font-medium text-green-800">Semua aman, tidak ada alert</p>
        </div>
      )}
    </div>
  )
}
