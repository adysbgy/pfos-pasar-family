// GET /api/analytics?tenantId=xxx&days=7 — Menu terlaris, jam tersibuk, tren penjualan harian
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DONE_STATUSES = ['completed', 'ready']

function jakartaDateKey(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) // YYYY-MM-DD
}
function jakartaHour(iso: string) {
  return parseInt(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')
  const days = parseInt(searchParams.get('days') ?? '7')

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId wajib diisi' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, total, created_at, status')
    .eq('tenant_id', tenantId)
    .gte('created_at', since)

  if (ordersError) {
    console.error('[/api/analytics] orders error:', ordersError)
    return NextResponse.json({ error: 'Gagal mengambil data order' }, { status: 500 })
  }

  const doneOrders = (orders ?? []).filter(o => DONE_STATUSES.includes(o.status))
  const doneOrderIds = doneOrders.map(o => o.id)

  let orderItems: { order_id: string; quantity: number; unit_price: number; menu_item_id: string; menu_item: { name: string } | null }[] = []
  if (doneOrderIds.length > 0) {
    const { data, error } = await supabase
      .from('order_items')
      .select('order_id, quantity, unit_price, menu_item_id, menu_item:menu_items(name)')
      .in('order_id', doneOrderIds)
    if (error) console.error('[/api/analytics] order_items error:', error)
    orderItems = (data as unknown as typeof orderItems) ?? []
  }

  // Menu terlaris
  const menuAgg: Record<string, { name: string; qty: number; revenue: number }> = {}
  orderItems.forEach(oi => {
    const name = oi.menu_item?.name ?? 'Tidak diketahui'
    if (!menuAgg[oi.menu_item_id]) menuAgg[oi.menu_item_id] = { name, qty: 0, revenue: 0 }
    menuAgg[oi.menu_item_id].qty += oi.quantity
    menuAgg[oi.menu_item_id].revenue += oi.quantity * oi.unit_price
  })
  const topMenu = Object.values(menuAgg).sort((a, b) => b.qty - a.qty).slice(0, 10)

  // Jam tersibuk (berdasarkan semua order masuk, bukan hanya yang selesai)
  const hourly: Record<number, number> = {}
  for (let h = 0; h < 24; h++) hourly[h] = 0
  ;(orders ?? []).forEach(o => { hourly[jakartaHour(o.created_at)]++ })
  const hourlyDistribution = Object.entries(hourly).map(([hour, count]) => ({ hour: parseInt(hour), count }))

  // Tren penjualan harian
  const dailyAgg: Record<string, { orders: number; revenue: number }> = {}
  doneOrders.forEach(o => {
    const key = jakartaDateKey(o.created_at)
    if (!dailyAgg[key]) dailyAgg[key] = { orders: 0, revenue: 0 }
    dailyAgg[key].orders += 1
    dailyAgg[key].revenue += o.total
  })
  const dailyTrend = Object.entries(dailyAgg)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({ topMenu, hourlyDistribution, dailyTrend })
}
