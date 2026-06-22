// GET    /api/vouchers?tenantId=xxx — daftar voucher (tenant ini + voucher semua-tenant)
// POST   /api/vouchers — buat voucher baru (owner)
// PATCH  /api/vouchers — edit / toggle status
// DELETE /api/vouchers?id=xxx — hapus voucher
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
  const tenantId = searchParams.get('tenantId')

  const supabase = createAdminClient()
  let query = supabase.from('vouchers').select('*').order('created_at', { ascending: false })

  if (tenantId) query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vouchers: data ?? [] })
}

export async function POST(request: Request) {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['owner', 'supervisor'].includes(session.primaryRole)) {
    return NextResponse.json({ error: 'Hanya owner/supervisor' }, { status: 403 })
  }

  const body = await request.json()
  const { tenantId, code, type, value, minPurchase, maxDiscount, usageLimit, validFrom, validUntil } = body as {
    tenantId?: string | null; code?: string; type?: 'percent' | 'fixed'; value?: number
    minPurchase?: number; maxDiscount?: number; usageLimit?: number
    validFrom?: string; validUntil?: string
  }

  if (!code?.trim() || !type || value === undefined) {
    return NextResponse.json({ error: 'code, type, value wajib' }, { status: 400 })
  }
  if (type === 'percent' && (value <= 0 || value > 100)) {
    return NextResponse.json({ error: 'Persen harus 1-100' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('vouchers')
    .insert({
      tenant_id:    tenantId || null,
      code:         code.trim().toUpperCase(),
      type,
      value,
      min_purchase: minPurchase ?? 0,
      max_discount: maxDiscount ?? null,
      usage_limit:  usageLimit ?? null,
      valid_from:   validFrom ?? null,
      valid_until:  validUntil ?? null,
      status:       'active',
    })
    .select()
    .single()

  if (error) {
    const msg = error.code === '23505' ? 'Kode voucher sudah dipakai' : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  return NextResponse.json({ success: true, voucher: data })
}

export async function PATCH(request: Request) {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['owner', 'supervisor'].includes(session.primaryRole)) {
    return NextResponse.json({ error: 'Hanya owner/supervisor' }, { status: 403 })
  }

  const body = await request.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 })

  const allowed = ['status', 'value', 'min_purchase', 'max_discount', 'usage_limit', 'valid_from', 'valid_until']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) if (key in updates) patch[key] = updates[key]

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Tidak ada field yang diupdate' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('vouchers').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, voucher: data })
}

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
  const { error } = await supabase.from('vouchers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
