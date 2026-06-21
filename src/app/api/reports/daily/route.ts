// GET /api/reports/daily?date=2026-06-21&tenantId=xxx (opsional)
// Kalau tenantId tidak ada = ambil semua tenant milik owner
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SessionPayload } from '@/types'

export async function GET(request: Request) {
  const raw = cookies().get('pfos_session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let session: SessionPayload
  try { session = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  // Hanya owner dan supervisor boleh lihat laporan
  if (!['owner', 'supervisor', 'marketing_admin', 'viewer'].includes(session.primaryRole)) {
    return NextResponse.json({ error: 'Tidak ada akses' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const date     = searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  const tenantId = searchParams.get('tenantId') ?? null

  const supabase = createAdminClient()

  // Ambil tenant yang relevan
  let tenantsQuery = supabase.from('tenants').select('id, name, slug, color').eq('status', 'active')
  if (tenantId) tenantsQuery = tenantsQuery.eq('id', tenantId)
  const { data: tenants } = await tenantsQuery.order('sort_order')

  if (!tenants?.length) return NextResponse.json({ date, tenants: [] })

  const tenantIds = tenants.map(t => t.id)

  // Query orders per tenant untuk hari ini
  const { data: orders } = await supabase
    .from('orders')
    .select('id, tenant_id, total, payment_method, status, created_at')
    .in('tenant_id', tenantIds)
    .gte('created_at', `${date}T00:00:00+07:00`)
    .lte('created_at', `${date}T23:59:59+07:00`)
    .neq('status', 'cancelled')

  // Query order_items untuk top menu
  const orderIds = orders?.map(o => o.id) ?? []
  let topItems: { name: string; tenant_id: string; total_qty: number }[] = []

  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from('order_items')
      .select('quantity, order_id, menu_item:menu_items(name, tenant_id)')
      .in('order_id', orderIds)

    // Aggregate per menu item per tenant
    const agg: Record<string, { name: string; tenant_id: string; total_qty: number }> = {}
    items?.forEach(item => {
      const mi = item.menu_item as { name: string; tenant_id: string } | null
      if (!mi) return
      const key = `${mi.tenant_id}::${mi.name}`
      if (!agg[key]) agg[key] = { name: mi.name, tenant_id: mi.tenant_id, total_qty: 0 }
      agg[key].total_qty += item.quantity
    })
    topItems = Object.values(agg).sort((a, b) => b.total_qty - a.total_qty)
  }

  // Query cash sessions
  const { data: cashSessions } = await supabase
    .from('cash_sessions')
    .select('tenant_id, opening_cash, cash_sales, closing_cash_actual, selisih, qris_total_reported, status, closed_at')
    .in('tenant_id', tenantIds)
    .eq('date', date)

  // Susun per tenant
  const result = tenants.map(tenant => {
    const tenantOrders = orders?.filter(o => o.tenant_id === tenant.id) ?? []
    const cashOrder  = tenantOrders.filter(o => o.payment_method === 'cash')
    const qrisOrders = tenantOrders.filter(o => o.payment_method === 'qris' || o.payment_method === 'platform')
    const cashSession = cashSessions?.find(c => c.tenant_id === tenant.id) ?? null

    const totalRevenue = tenantOrders.reduce((s, o) => s + o.total, 0)
    const cashRevenue  = cashOrder.reduce((s, o) => s + o.total, 0)
    const qrisRevenue  = qrisOrders.reduce((s, o) => s + o.total, 0)

    const top5 = topItems
      .filter(i => i.tenant_id === tenant.id)
      .slice(0, 5)

    return {
      tenantId:    tenant.id,
      tenantName:  tenant.name,
      tenantColor: tenant.color,
      totalOrders:  tenantOrders.length,
      totalRevenue,
      cashRevenue,
      qrisRevenue,
      openingCash:        cashSession?.opening_cash ?? null,
      closingCashActual:  cashSession?.closing_cash_actual ?? null,
      selisih:            cashSession?.selisih ?? null,
      qrisReported:       cashSession?.qris_total_reported ?? null,
      sessionStatus:      cashSession?.status ?? 'not_opened',
      closedAt:           cashSession?.closed_at ?? null,
      topItems: top5,
    }
  })

  const grandTotal = result.reduce((s, r) => s + r.totalRevenue, 0)
  const grandOrders = result.reduce((s, r) => s + r.totalOrders, 0)

  return NextResponse.json({ date, grandTotal, grandOrders, tenants: result })
}
