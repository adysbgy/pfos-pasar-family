'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/types'
import type { DashboardAlert } from '@/types'

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading]         = useState(true)
  const [summary, setSummary]         = useState<any>(null)
  const [alerts, setAlerts]           = useState<DashboardAlert[]>([])
  const [tenantStats, setTenantStats] = useState<any[]>([])
  const [closingStatus, setClosingStatus] = useState<any[]>([])

  useEffect(() => {
    loadDashboard()
    const interval = setInterval(loadDashboard, 60000) // refresh setiap 1 menit
    const ch = supabase.channel('dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dashboard_alerts' }, loadDashboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadDashboard)
      .subscribe()
    return () => { clearInterval(interval); supabase.removeChannel(ch) }
  }, [])

  async function loadDashboard() {
    const today = new Date().toISOString().split('T')[0]

    const [alertRes, tenantRes, ordersRes, closingRes] = await Promise.all([
      supabase.from('dashboard_alerts').select('*').eq('is_resolved', false).order('created_at', { ascending: false }).limit(20),
      supabase.from('tenants').select('id, name, color, slug').eq('status', 'active').order('sort_order'),
      supabase.from('orders').select('tenant_id, total, payment_method, status, channel').gte('created_at', today),
      supabase.from('closing_reports').select('tenant_id').eq('date', today),
    ])

    const orders = ordersRes.data ?? []
    const completed = orders.filter((o: any) => ['completed','ready'].includes(o.status))
    const tenants   = tenantRes.data ?? []
    const closedIds = new Set((closingRes.data ?? []).map((r: any) => r.tenant_id))

    const stats = tenants.map((t: any) => {
      const tOrders = completed.filter((o: any) => o.tenant_id === t.id)
      return {
        ...t,
        orders:  tOrders.length,
        revenue: tOrders.reduce((s: number, o: any) => s + o.total, 0),
        closed:  closedIds.has(t.id),
      }
    })

    setAlerts(alertRes.data ?? [])
    setTenantStats(stats)
    setClosingStatus(stats)
    setSummary({
      totalOrders:  completed.length,
      totalRevenue: completed.reduce((s: number, o: any) => s + o.total, 0),
      totalCash:    completed.filter((o: any) => o.payment_method === 'cash').reduce((s: number, o: any) => s + o.total, 0),
      totalQris:    completed.filter((o: any) => o.payment_method === 'qris').reduce((s: number, o: any) => s + o.total, 0),
      unreadAlerts: (alertRes.data ?? []).filter((a: any) => !a.is_read).length,
    })
    setLoading(false)
  }

  async function resolveAlert(id: string) {
    await supabase.from('dashboard_alerts').update({ is_resolved: true, is_read: true }).eq('id', id)
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
