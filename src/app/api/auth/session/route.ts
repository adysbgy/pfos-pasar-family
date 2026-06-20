// GET /api/auth/session — Baca session dari cookie (untuk client components)
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type { SessionPayload } from '@/types'

export async function GET() {
  const cookieStore = cookies()
  const raw = cookieStore.get('pfos_session')?.value

  if (!raw) {
    return NextResponse.json({ session: null })
  }

  try {
    const session = JSON.parse(raw) as SessionPayload
    // Cek expiry
    const ageMs = Date.now() - session.loginAt
    if (ageMs > 8 * 60 * 60 * 1000) {
      cookieStore.delete('pfos_session')
      return NextResponse.json({ session: null })
    }
    return NextResponse.json({ session })
  } catch {
    return NextResponse.json({ session: null })
  }
}
