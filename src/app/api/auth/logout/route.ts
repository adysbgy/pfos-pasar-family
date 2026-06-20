// POST /api/auth/logout — Hapus session cookie
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = cookies()
  cookieStore.delete('pfos_session')

  return NextResponse.json({ success: true })
}
