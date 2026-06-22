// POST /api/auth/change-pin — staff ganti PIN sendiri (perlu PIN lama untuk verifikasi)
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SessionPayload } from '@/types'

export async function POST(request: Request) {
  const raw = cookies().get('pfos_session')?.value
  if (!raw) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })

  let session: SessionPayload
  try { session = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 }) }

  const body = await request.json()
  const { currentPin, newPin } = body as { currentPin?: string; newPin?: string }

  if (!currentPin || !newPin) {
    return NextResponse.json({ error: 'PIN lama dan PIN baru wajib diisi' }, { status: 400 })
  }
  if (!/^\d{4,6}$/.test(newPin)) {
    return NextResponse.json({ error: 'PIN baru harus 4-6 digit angka' }, { status: 400 })
  }
  if (currentPin === newPin) {
    return NextResponse.json({ error: 'PIN baru tidak boleh sama dengan PIN lama' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: pinValid, error: pinError } = await supabase.rpc('verify_user_pin', {
    p_user_id: session.userId,
    p_pin: currentPin,
  })
  if (pinError) {
    console.error('[/api/auth/change-pin] verify error:', pinError)
    return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 })
  }
  if (!pinValid) {
    return NextResponse.json({ error: 'PIN lama salah' }, { status: 401 })
  }

  // pgcrypto (verify_user_pin) di Supabase hanya menerima prefix $2a$, bcryptjs default $2b$
  const salt = bcrypt.genSaltSync(10).replace('$2b$', '$2a$')
  const newHash = bcrypt.hashSync(newPin, salt)
  const { error: updateError } = await supabase.from('users').update({ pin_hash: newHash }).eq('id', session.userId)

  if (updateError) {
    console.error('[/api/auth/change-pin] update error:', updateError)
    return NextResponse.json({ error: 'Gagal simpan PIN baru' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
