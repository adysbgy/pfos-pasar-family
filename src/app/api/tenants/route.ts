// GET /api/tenants — Daftar tenant aktif
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SessionPayload } from '@/types'

export async function GET() {
  const raw = cookies().get('pfos_session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let session: SessionPayload
  try { session = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  void session

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, color, status, sort_order')
    .eq('status', 'active')
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tenants: data ?? [] })
}
