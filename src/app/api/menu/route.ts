// GET  /api/menu?tenantId=xxx&showAll=true — Daftar menu + kategori
// POST /api/menu — Buat menu item baru (owner/supervisor)
// PATCH /api/menu — Edit item / toggle status
// DELETE /api/menu?id=xxx — Hapus item (owner only)
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SessionPayload } from '@/types'

function getSession(): SessionPayload | null {
  const raw = cookies().get('pfos_session')?.value
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

// GET — untuk POS dan halaman manajemen menu
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')
  const showAll  = searchParams.get('showAll') === 'true'

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId wajib diisi' }, { status: 400 })
  }

  const supabase = createAdminClient()

  let menuQuery = supabase
    .from('menu_items')
    .select('*, category:categories(id, name, sort_order)')
    .eq('tenant_id', tenantId)
    .order('sort_order')
    .order('name')

  if (!showAll) menuQuery = menuQuery.eq('status', 'active')

  const [catRes, menuRes] = await Promise.all([
    supabase.from('categories').select('*').eq('tenant_id', tenantId).order('sort_order'),
    menuQuery,
  ])

  if (catRes.error || menuRes.error) {
    console.error('[/api/menu] error:', catRes.error ?? menuRes.error)
    return NextResponse.json({ error: 'Gagal mengambil data menu' }, { status: 500 })
  }

  // Deteksi stok habis dari resep: kalau ada bahan dengan stok 0, menu dianggap habis
  const menuItems = menuRes.data ?? []
  const menuIds = menuItems.map(m => m.id)
  let outOfStockIds = new Set<string>()

  if (menuIds.length > 0) {
    const { data: recipeRows } = await supabase
      .from('recipes')
      .select('menu_item_id, inventory_item:inventory_items(stock:inventory_stock(current_qty))')
      .in('menu_item_id', menuIds)

    ;(recipeRows ?? []).forEach((r: any) => {
      const qty = r.inventory_item?.stock?.current_qty ?? r.inventory_item?.stock?.[0]?.current_qty
      if (qty !== undefined && qty <= 0) outOfStockIds.add(r.menu_item_id)
    })
  }

  const itemsWithStock = menuItems.map(m => ({ ...m, out_of_stock: outOfStockIds.has(m.id) }))

  return NextResponse.json({ categories: catRes.data ?? [], menuItems: itemsWithStock })
}

// POST — buat menu item baru
export async function POST(request: Request) {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['owner', 'supervisor'].includes(session.primaryRole)) {
    return NextResponse.json({ error: 'Hanya owner/supervisor' }, { status: 403 })
  }

  const body = await request.json()
  const { tenantId, name, price, categoryId, description } = body

  if (!tenantId || !name || price === undefined) {
    return NextResponse.json({ error: 'tenantId, name, price wajib' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: last } = await supabase
    .from('menu_items')
    .select('sort_order')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const { data, error } = await supabase
    .from('menu_items')
    .insert({
      tenant_id:   tenantId,
      name:        name.trim(),
      price:       parseInt(price),
      category_id: categoryId ?? null,
      description: description?.trim() ?? null,
      status:      'active',
      sort_order:  (last?.sort_order ?? 0) + 10,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, item: data })
}

// PATCH — edit field atau toggle status
export async function PATCH(request: Request) {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 })

  // Semua role login boleh toggle "habis" (is_available) — field lain hanya owner/supervisor
  const isOwnerOrSup = ['owner', 'supervisor'].includes(session.primaryRole)
  const onlyTogglingAvailability = Object.keys(updates).every(k => k === 'is_available')

  if (!isOwnerOrSup && !onlyTogglingAvailability) {
    return NextResponse.json({ error: 'Hanya owner/supervisor' }, { status: 403 })
  }

  const allowed = isOwnerOrSup
    ? ['name', 'price', 'category_id', 'description', 'status', 'sort_order', 'is_available']
    : ['is_available']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in updates) patch[key] = updates[key]
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Tidak ada field yang diupdate' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('menu_items')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, item: data })
}

// DELETE — hapus item (hanya owner)
export async function DELETE(request: Request) {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.primaryRole !== 'owner') {
    return NextResponse.json({ error: 'Hanya owner' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id diperlukan' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from('menu_items').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
