// GET /api/analytics?tenantId=xxx&days=7
// Menu terlaris, jam tersibuk, tren harian, channel split, pola per hari, menu engineering
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DONE_STATUSES = ['completed', 'ready']
const DOW_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

function jakartaDateKey(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) // YYYY-MM-DD
}
function jakartaHour(iso: string) {
  return parseInt(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }))
}
function jakartaDOW(iso: string) {
  const wd = new Date(iso).toLocaleDateString('en-US', { timeZone: 'Asia/Jakarta', weekday: 'long' })
  const map: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 }
  return map[wd] ?? 0
}

function median(nums: number[]) {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
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
    .select('id, total, created_at, status, channel')
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

  // Agregasi penjualan per menu item (qty + revenue)
  const menuAgg: Record<string, { name: string; qty: number; revenue: number }> = {}
  orderItems.forEach(oi => {
    const name = oi.menu_item?.name ?? 'Tidak diketahui'
    if (!menuAgg[oi.menu_item_id]) menuAgg[oi.menu_item_id] = { name, qty: 0, revenue: 0 }
    menuAgg[oi.menu_item_id].qty += oi.quantity
    menuAgg[oi.menu_item_id].revenue += oi.quantity * oi.unit_price
  })
  const topMenu = Object.values(menuAgg).sort((a, b) => b.qty - a.qty).slice(0, 10)

  // Jam tersibuk
  const hourly: Record<number, number> = {}
  for (let h = 0; h < 24; h++) hourly[h] = 0
  ;(orders ?? []).forEach(o => { hourly[jakartaHour(o.created_at)]++ })
  const hourlyDistribution = Object.entries(hourly).map(([hour, count]) => ({ hour: parseInt(hour), count }))

  // Tren harian
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

  // Channel split (dine_in/takeaway/gofood/whatsapp/...)
  const channelAgg: Record<string, { orders: number; revenue: number }> = {}
  doneOrders.forEach(o => {
    const ch = o.channel ?? 'lainnya'
    if (!channelAgg[ch]) channelAgg[ch] = { orders: 0, revenue: 0 }
    channelAgg[ch].orders += 1
    channelAgg[ch].revenue += o.total
  })
  const channelSplit = Object.entries(channelAgg)
    .map(([channel, v]) => ({ channel, ...v }))
    .sort((a, b) => b.revenue - a.revenue)

  // Pola per hari dalam seminggu (rata-rata revenue per hari yang muncul)
  const dowAgg: Record<number, { orders: number; revenue: number; days: Set<string> }> = {}
  for (let d = 0; d < 7; d++) dowAgg[d] = { orders: 0, revenue: 0, days: new Set() }
  doneOrders.forEach(o => {
    const dow = jakartaDOW(o.created_at)
    dowAgg[dow].orders += 1
    dowAgg[dow].revenue += o.total
    dowAgg[dow].days.add(jakartaDateKey(o.created_at))
  })
  const dayOfWeek = Object.entries(dowAgg).map(([dow, v]) => {
    const occurrences = v.days.size || 1
    return {
      dow: parseInt(dow),
      label: DOW_NAMES[parseInt(dow)],
      orders: v.orders,
      revenue: v.revenue,
      avgRevenue: Math.round(v.revenue / occurrences),
    }
  })

  // Menu engineering quadrant — butuh COGS dari resep
  const { data: activeMenu } = await supabase
    .from('menu_items')
    .select('id, name, price')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')

  const menuIds = (activeMenu ?? []).map(m => m.id)
  let recipeRows: { menu_item_id: string; qty_per_portion: number; inventory_item: { cost_per_unit: number } | null }[] = []
  if (menuIds.length > 0) {
    const { data } = await supabase
      .from('recipes')
      .select('menu_item_id, qty_per_portion, inventory_item:inventory_items(cost_per_unit)')
      .in('menu_item_id', menuIds)
    recipeRows = (data as unknown as typeof recipeRows) ?? []
  }

  // COGS per menu item
  const cogsByMenu: Record<string, number> = {}
  const hasRecipe: Record<string, boolean> = {}
  recipeRows.forEach(r => {
    hasRecipe[r.menu_item_id] = true
    cogsByMenu[r.menu_item_id] = (cogsByMenu[r.menu_item_id] ?? 0) + r.qty_per_portion * (r.inventory_item?.cost_per_unit ?? 0)
  })

  // Hanya item dengan resep yang bisa diklasifikasi (COGS diketahui)
  const classifiable = (activeMenu ?? [])
    .filter(m => hasRecipe[m.id])
    .map(m => {
      const cogs = cogsByMenu[m.id] ?? 0
      const margin = m.price - cogs
      const qty = menuAgg[m.id]?.qty ?? 0
      return { id: m.id, name: m.name, price: m.price, cogs, margin, qty }
    })

  const medQty = median(classifiable.map(c => c.qty))
  const medMargin = median(classifiable.map(c => c.margin))

  const menuEngineering = classifiable.map(c => {
    const popular = c.qty >= medQty
    const profitable = c.margin >= medMargin
    const category =
      popular && profitable ? 'star' :       // laku + margin tinggi
      popular && !profitable ? 'plowhorse' : // laku + margin tipis
      !popular && profitable ? 'puzzle' :    // jarang + margin tinggi
      'dog'                                   // jarang + margin tipis
    return { ...c, category }
  }).sort((a, b) => b.qty - a.qty)

  const menuNoRecipe = (activeMenu ?? []).filter(m => !hasRecipe[m.id]).map(m => ({ id: m.id, name: m.name }))

  return NextResponse.json({
    topMenu, hourlyDistribution, dailyTrend,
    channelSplit, dayOfWeek, menuEngineering, menuNoRecipe,
  })
}
