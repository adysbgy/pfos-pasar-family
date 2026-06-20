// GET /api/users — Daftar user aktif untuk layar login
// Tidak perlu auth (layar sebelum login)
// Tidak return pin_hash

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    // Panggil fungsi Supabase yang sudah aman (tidak expose pin_hash)
    const { data, error } = await supabase.rpc('get_active_users_for_login')

    if (error) {
      console.error('[/api/users] Supabase error:', error)
      return NextResponse.json({ error: 'Gagal mengambil data staff' }, { status: 500 })
    }

    return NextResponse.json({ users: data ?? [] })
  } catch (err) {
    console.error('[/api/users] Error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
