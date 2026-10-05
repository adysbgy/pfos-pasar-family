// GET /api/tenants — Daftar tenant aktif
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
