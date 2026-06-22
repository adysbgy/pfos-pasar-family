// GET /api/inventory?tenantId=xxx — Daftar stok per tenant
// POST /api/inventory — Adjust stok (purchase/usage/waste/adjustment)
// POST /api/inventory/items — Tambah item baru
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SessionPayload } from '@/types'

function getSession(): SessionPayload | null {
  const raw = cookies().get('pfos_session')?.value
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

// GET — list semua item + stok saat ini
export async function GET(request: Request) {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId') ?? session.selectedTenantId

  if (!tenantId) return NextResponse.json({ error: 'tenantId diperlukan' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*, stock:inventory_stock(current_qty, last_updated)')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('category')
    .order('sort_order')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

// POST — adjust stok ATAU tambah item baru
export async function POST(request: Request) {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const supabase = createAdminClient()

  // Tambah item baru
  if (body.action === 'create_item') {
    const { tenantId, name, unit, category, minStock, initialQty, costPerUnit } = body
    if (!tenantId || !name || !unit) {
      return NextResponse.json({ error: 'name, unit, tenantId wajib' }, { status: 400 })
    }

    const { data: item, error: itemErr } = await supabase
      .from('inventory_items')
      .insert({ tenant_id: tenantId, name, unit, category: category ?? 'bahan', min_stock: minStock ?? 5, cost_per_unit: costPerUnit ?? 0 })
      .select().single()

    if (itemErr || !item) return NextResponse.json({ error: itemErr?.message }, { status: 500 })

    const qty = parseInt(initialQty) || 0
    await supabase.from('inventory_stock').insert({ item_id: item.id, current_qty: qty })

    if (qty > 0) {
      await supabase.from('inventory_transactions').insert({
        item_id: item.id, tenant_id: tenantId,
        type: 'opening', qty_change: qty, qty_before: 0, qty_after: qty,
        notes: 'Stok awal', created_by: session.userId,
      })
    }

    return NextResponse.json({ success: true, item })
  }

  // Adjust stok
  const { itemId, type, qtyChange, notes } = body
  if (!itemId || !type || qtyChange === undefined) {
    return NextResponse.json({ error: 'itemId, type, qtyChange wajib' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('adjust_inventory_stock', {
    p_item_id:    itemId,
    p_type:       type,
    p_qty_change: parseInt(qtyChange),
    p_notes:      notes ?? null,
    p_user_id:    session.userId,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, result: data })
}

// PATCH — edit harga bahan (cost_per_unit) untuk hitung COGS
export async function PATCH(request: Request) {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['owner', 'supervisor'].includes(session.primaryRole)) {
    return NextResponse.json({ error: 'Hanya owner/supervisor' }, { status: 403 })
  }

  const body = await request.json()
  const { itemId, costPerUnit } = body
  if (!itemId || costPerUnit === undefined) {
    return NextResponse.json({ error: 'itemId, costPerUnit wajib' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .update({ cost_per_unit: costPerUnit })
    .eq('id', itemId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, item: data })
}
