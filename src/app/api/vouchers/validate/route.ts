// POST /api/vouchers/validate — cek kode voucher valid + hitung diskon (tidak increment used_count)
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const body = await request.json()
  const { code, tenantId, subtotal } = body as { code?: string; tenantId?: string; subtotal?: number }

  if (!code?.trim() || !tenantId || subtotal === undefined) {
    return NextResponse.json({ error: 'code, tenantId, subtotal wajib' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: voucher, error } = await supabase
    .from('vouchers')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .single()

  if (error || !voucher) {
    return NextResponse.json({ error: 'Kode voucher tidak ditemukan' }, { status: 404 })
  }
  if (voucher.status !== 'active') {
    return NextResponse.json({ error: 'Voucher tidak aktif' }, { status: 400 })
  }
  const now = new Date()
  if (voucher.valid_from && now < new Date(voucher.valid_from)) {
    return NextResponse.json({ error: 'Voucher belum berlaku' }, { status: 400 })
  }
  if (voucher.valid_until && now > new Date(voucher.valid_until)) {
    return NextResponse.json({ error: 'Voucher sudah kedaluwarsa' }, { status: 400 })
  }
  if (voucher.usage_limit !== null && voucher.used_count >= voucher.usage_limit) {
    return NextResponse.json({ error: 'Kuota voucher sudah habis' }, { status: 400 })
  }
  if (subtotal < voucher.min_purchase) {
    return NextResponse.json({ error: `Minimal belanja Rp${voucher.min_purchase.toLocaleString('id-ID')}` }, { status: 400 })
  }

  let discount = voucher.type === 'percent'
    ? Math.round(subtotal * voucher.value / 100)
    : voucher.value
  if (voucher.max_discount) discount = Math.min(discount, voucher.max_discount)
  discount = Math.min(discount, subtotal)

  return NextResponse.json({ valid: true, voucherId: voucher.id, code: voucher.code, discount })
}
