// GET /api/staff-kpi?days=7 — KPI per staff: penjualan per kasir, pass rate QA per checker
// Lintas-tenant (kasir & qa_checker bisa kerja di tenant manapun)
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') ?? '7')
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const supabase = createAdminClient()

  const [{ data: orders, error: ordersError }, { data: qaChecks, error: qaError }, { data: users }] = await Promise.all([
    supabase.from('orders').select('kasir_id, total, status').gte('created_at', since),
    supabase.from('qa_checks').select('checker_id, result').gte('created_at', since),
    supabase.from('users').select('id, name'),
  ])

  if (ordersError || qaError) {
    console.error('[/api/staff-kpi] error:', ordersError ?? qaError)
    return NextResponse.json({ error: 'Gagal mengambil data KPI' }, { status: 500 })
  }

  const userName = (id: string) => users?.find(u => u.id === id)?.name ?? 'Tidak diketahui'
  const doneOrders = (orders ?? []).filter(o => ['completed', 'ready'].includes(o.status))

  // KPI Kasir
  const kasirAgg: Record<string, { orders: number; revenue: number }> = {}
  doneOrders.forEach(o => {
    if (!o.kasir_id) return
    if (!kasirAgg[o.kasir_id]) kasirAgg[o.kasir_id] = { orders: 0, revenue: 0 }
    kasirAgg[o.kasir_id].orders += 1
    kasirAgg[o.kasir_id].revenue += o.total
  })
  const kasirKpi = Object.entries(kasirAgg)
    .map(([id, v]) => ({ userId: id, name: userName(id), orders: v.orders, revenue: v.revenue, avgOrder: Math.round(v.revenue / v.orders) }))
    .sort((a, b) => b.revenue - a.revenue)

  // KPI QA Checker
  const qaAgg: Record<string, { total: number; pass: number }> = {}
  ;(qaChecks ?? []).forEach(c => {
    if (!c.checker_id) return
    if (!qaAgg[c.checker_id]) qaAgg[c.checker_id] = { total: 0, pass: 0 }
    qaAgg[c.checker_id].total += 1
    if (c.result === 'pass') qaAgg[c.checker_id].pass += 1
  })
  const qaKpi = Object.entries(qaAgg)
    .map(([id, v]) => ({ userId: id, name: userName(id), total: v.total, pass: v.pass, passRate: Math.round(v.pass / v.total * 100) }))
    .sort((a, b) => b.total - a.total)

  return NextResponse.json({ kasirKpi, qaKpi })
}
