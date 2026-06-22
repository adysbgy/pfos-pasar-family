// GET  /api/recipes?menuItemId=xxx — resep untuk 1 menu item
// GET  /api/recipes?tenantId=xxx  — semua resep untuk 1 tenant
// POST /api/recipes               — tambah resep
// DELETE /api/recipes?id=xxx      — hapus resep
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SessionPayload } from '@/types'

function getSession(): SessionPayload | null {
  const raw = cookies().get('pfos_session')?.value
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export async function GET(request: Request) {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const menuItemId = searchParams.get('menuItemId')
  const tenantId   = searchParams.get('tenantId')

  const supabase = createAdminClient()

  if (menuItemId) {
    const [{ data, error }, { data: menuItem }] = await Promise.all([
      supabase
        .from('recipes')
        .select('*, inventory_item:inventory_items(id, name, unit, category, cost_per_unit)')
        .eq('menu_item_id', menuItemId)
        .order('created_at'),
      supabase.from('menu_items').select('price').eq('id', menuItemId).single(),
    ])

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const cogs = (data ?? []).reduce((s, r: any) => s + r.qty_per_portion * (r.inventory_item?.cost_per_unit ?? 0), 0)
    const price = menuItem?.price ?? 0
    return NextResponse.json({ recipes: data ?? [], cogs, price, margin: price - cogs })
  }

  if (tenantId) {
    // Semua menu item tenant + resep masing-masing
    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('id, name, status, price, category:categories(name)')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('sort_order')

    if (!menuItems?.length) return NextResponse.json({ menuItems: [] })

    const menuIds = menuItems.map(m => m.id)
    const { data: allRecipes } = await supabase
      .from('recipes')
      .select('menu_item_id, id, qty_per_portion, unit, inventory_item:inventory_items(id, name, unit, cost_per_unit)')
      .in('menu_item_id', menuIds)

    // Gabungkan + hitung COGS & margin
    const result = menuItems.map(m => {
      const recipes = allRecipes?.filter(r => r.menu_item_id === m.id) ?? []
      const cogs = recipes.reduce((s, r: any) => s + r.qty_per_portion * (r.inventory_item?.cost_per_unit ?? 0), 0)
      return { ...m, recipes, cogs, margin: m.price - cogs }
    })

    return NextResponse.json({ menuItems: result })
  }

  return NextResponse.json({ error: 'menuItemId atau tenantId diperlukan' }, { status: 400 })
}

export async function POST(request: Request) {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['owner', 'supervisor'].includes(session.primaryRole)) {
    return NextResponse.json({ error: 'Hanya owner/supervisor' }, { status: 403 })
  }

  const body = await request.json()
  const { menuItemId, inventoryItemId, qtyPerPortion, unit, notes } = body

  if (!menuItemId || !inventoryItemId || !qtyPerPortion) {
    return NextResponse.json({ error: 'menuItemId, inventoryItemId, qtyPerPortion wajib' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('recipes')
    .upsert({
      menu_item_id:      menuItemId,
      inventory_item_id: inventoryItemId,
      qty_per_portion:   parseFloat(qtyPerPortion),
      unit:              unit,
      notes:             notes ?? null,
    }, { onConflict: 'menu_item_id,inventory_item_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, recipe: data })
}

export async function DELETE(request: Request) {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['owner', 'supervisor'].includes(session.primaryRole)) {
    return NextResponse.json({ error: 'Hanya owner/supervisor' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id diperlukan' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from('recipes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
