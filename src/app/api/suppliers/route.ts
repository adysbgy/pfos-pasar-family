// GET  /api/suppliers?tenantId=xxx — daftar supplier aktif
// POST /api/suppliers — tambah supplier baru
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')
  if (!tenantId) return NextResponse.json({ error: 'tenantId wajib diisi' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ suppliers: data ?? [] })
}

export async function POST(request: Request) {
  const body = await request.json()
  const { tenantId, name, phone, notes } = body as { tenantId?: string; name?: string; phone?: string; notes?: string }

  if (!tenantId || !name?.trim()) {
    return NextResponse.json({ error: 'tenantId, name wajib' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ tenant_id: tenantId, name: name.trim(), phone: phone?.trim() || null, notes: notes?.trim() || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, supplier: data })
}
