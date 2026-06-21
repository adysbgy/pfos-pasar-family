// GET /api/menu?tenantId=... — Kategori + menu item aktif untuk POS
// Pakai admin client karena staff login via PIN, bukan Supabase Auth (RLS anon tidak bisa baca)
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId wajib diisi' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const [catRes, menuRes] = await Promise.all([
    supabase.from('categories').select('*').eq('tenant_id', tenantId).order('sort_order'),
    supabase.from('menu_items')
      .select('*').eq('tenant_id', tenantId).eq('status', 'active').order('sort_order'),
  ])

  if (catRes.error || menuRes.error) {
    console.error('[/api/menu] Supabase error:', catRes.error ?? menuRes.error)
    return NextResponse.json({ error: 'Gagal mengambil data menu' }, { status: 500 })
  }

  return NextResponse.json({ categories: catRes.data ?? [], menuItems: menuRes.data ?? [] })
}
