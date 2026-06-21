// GET   /api/dashboard — Ringkasan penjualan semua tenant + alert aktif
// PATCH /api/dashboard — Tandai alert sudah selesai/resolved
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [alertRes, tenantRes, ordersRes, closingRes] = await Promise.all([
    supabase.from('dashboard_alerts').select('*').eq('is_resolved', false).order('created_at', { ascending: false }).limit(20),
    supabase.from('tenants').select('id, name, color, slug').eq('status', 'active').order('sort_order'),
    supabase.from('orders').select('tenant_id, total, payment_method, status, channel').gte('created_at', today),
    supabase.from('closing_reports').select('tenant_id').eq('date', today),
  ])

  const orders = ordersRes.data ?? []
  const completed = orders.filter((o: any) => ['completed', 'ready'].includes(o.status))
  const tenants   = tenantRes.data ?? []
  const closedIds = new Set((closingRes.data ?? []).map((r: any) => r.tenant_id))

  const tenantStats = tenants.map((t: any) => {
    const tOrders = completed.filter((o: any) => o.tenant_id === t.id)
    return {
      ...t,
      orders:  tOrders.length,
      revenue: tOrders.reduce((s: number, o: any) => s + o.total, 0),
      closed:  closedIds.has(t.id),
    }
  })

  const alerts = alertRes.data ?? []
  const summary = {
    totalOrders:  completed.length,
    totalRevenue: completed.reduce((s: number, o: any) => s + o.total, 0),
    totalCash:    completed.filter((o: any) => o.payment_method === 'cash').reduce((s: number, o: any) => s + o.total, 0),
    totalQris:    completed.filter((o: any) => o.payment_method === 'qris').reduce((s: number, o: any) => s + o.total, 0),
    unreadAlerts: alerts.filter((a: any) => !a.is_read).length,
  }

  return NextResponse.json({ summary, alerts, tenantStats })
}

export async function PATCH(request: Request) {
  const body = await request.json()
  const { id } = body as { id?: string }
  if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from('dashboard_alerts').update({ is_resolved: true, is_read: true }).eq('id', id)
  if (error) {
    console.error('[/api/dashboard] resolve alert error:', error)
    return NextResponse.json({ error: 'Gagal update alert' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
