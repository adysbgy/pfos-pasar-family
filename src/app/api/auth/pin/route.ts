// POST /api/auth/pin — Verifikasi PIN staff, set session cookie
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SessionPayload, RoleName } from '@/types'
import { ROLE_HOME } from '@/types'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, pin } = body as { userId?: string; pin?: string }

    // Validasi input dasar
    if (!userId || !pin) {
      return NextResponse.json(
        { success: false, error: 'userId dan pin wajib diisi' },
        { status: 400 }
      )
    }

    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json(
        { success: false, error: 'PIN harus 4-6 digit angka' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // 0. Cek lockout dari percobaan gagal sebelumnya
    const { data: lockState } = await supabase
      .from('users').select('failed_pin_attempts, locked_until').eq('id', userId).single()

    if (lockState?.locked_until && new Date(lockState.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(lockState.locked_until).getTime() - Date.now()) / 60000)
      return NextResponse.json(
        { success: false, error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${minutesLeft} menit.` },
        { status: 429 }
      )
    }

    // 1. Verifikasi PIN via fungsi Supabase
    const { data: pinValid, error: pinError } = await supabase.rpc('verify_user_pin', {
      p_user_id: userId,
      p_pin: pin,
    })

    if (pinError) {
      console.error('[/api/auth/pin] verify_user_pin error:', pinError)
      return NextResponse.json(
        { success: false, error: 'Terjadi kesalahan sistem. Coba lagi.' },
        { status: 500 }
      )
    }

    if (!pinValid) {
      const attempts = (lockState?.failed_pin_attempts ?? 0) + 1
      const MAX_ATTEMPTS = 5
      const patch: Record<string, unknown> = { failed_pin_attempts: attempts }
      if (attempts >= MAX_ATTEMPTS) {
        patch.locked_until = new Date(Date.now() + 5 * 60 * 1000).toISOString()
        patch.failed_pin_attempts = 0
      }
      await supabase.from('users').update(patch).eq('id', userId)

      const sisaPercobaan = MAX_ATTEMPTS - attempts
      return NextResponse.json(
        {
          success: false,
          error: attempts >= MAX_ATTEMPTS
            ? 'Terlalu banyak percobaan gagal. Akun dikunci 5 menit.'
            : `PIN salah. Coba lagi. (${sisaPercobaan} percobaan tersisa)`,
        },
        { status: 401 }
      )
    }

    // Reset lockout setelah berhasil login
    if ((lockState?.failed_pin_attempts ?? 0) > 0 || lockState?.locked_until) {
      await supabase.from('users').update({ failed_pin_attempts: 0, locked_until: null }).eq('id', userId)
    }

    // 2. Ambil data user + roles
    const { data: userData, error: userError } = await supabase.rpc('get_user_session_data', {
      p_user_id: userId,
    })

    if (userError || !userData) {
      console.error('[/api/auth/pin] get_user_session_data error:', userError)
      return NextResponse.json(
        { success: false, error: 'Gagal mengambil data user' },
        { status: 500 }
      )
    }

    // 3. Tentukan primary role (hierarki: owner > supervisor > kasir > kitchen > qa_checker > marketing_admin > viewer)
    const ROLE_PRIORITY: RoleName[] = [
      'owner', 'supervisor', 'kasir', 'kitchen', 'qa_checker', 'marketing_admin', 'viewer'
    ]

    const roles: Array<{ role: RoleName; tenant_id?: string }> = userData.roles ?? []
    const primaryRole: RoleName = roles
      .map(r => r.role)
      .sort((a, b) => ROLE_PRIORITY.indexOf(a) - ROLE_PRIORITY.indexOf(b))[0] ?? 'viewer'

    // 4. Buat session payload
    const session: SessionPayload = {
      userId: userData.id,
      name: userData.name,
      primaryRole,
      homeTenantId: userData.home_tenant_id ?? null,
      selectedTenantId: userData.home_tenant_id ?? null,
      loginAt: Date.now(),
    }

    // 5. Simpan session ke httpOnly cookie
    const cookieStore = cookies()
    cookieStore.set('pfos_session', JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8, // 8 jam
      path: '/',
    })

    // 6. Catat activity log (non-blocking)
    supabase.from('activity_log').insert({
      user_id: userData.id,
      tenant_id: userData.home_tenant_id,
      action: 'login',
    }).then(() => {})  // fire and forget

    const redirectTo = ROLE_HOME[primaryRole]

    return NextResponse.json({
      success: true,
      user: session,
      redirectTo,
    })
  } catch (err) {
    console.error('[/api/auth/pin] Unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Server error. Coba lagi.' },
      { status: 500 }
    )
  }
}
