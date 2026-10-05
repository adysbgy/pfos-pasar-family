// GET /api/auth/session — Baca session dari cookie (untuk client components)
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function GET() {
  // Verifikasi tanda tangan + expiry (ditangani lib/session)
  const session = await getSession()
  return NextResponse.json({ session })
}
