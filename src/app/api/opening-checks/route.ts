// GET  /api/opening-checks?tenantId=xxx&date=YYYY-MM-DD — checklist pra-buka hari ini
// POST /api/opening-checks — submit/update checklist (upsert per tenant+date)
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/session'
import { canAccessTenant } from '@/lib/authz'


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')
  const date = searchParams.get('date') ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

  if (!tenantId) return NextResponse.json({ error: 'tenantId wajib diisi' }, { status: 400 })

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccessTenant(session, tenantId)) {
    return NextResponse.json({ error: 'Tidak punya akses ke tenant ini' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('opening_checks')
    .select('*, checker:users(name)')
    .eq('tenant_id', tenantId)
    .eq('date', date)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[/api/opening-checks] error:', error)
    return NextResponse.json({ error: 'Gagal mengambil checklist' }, { status: 500 })
  }

  return NextResponse.json({ check: data ?? null })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { tenantId, items, notes } = body as {
    tenantId?: string
    items?: Record<string, boolean>
    notes?: string
  }

  if (!tenantId || !items) {
    return NextResponse.json({ error: 'tenantId, items wajib' }, { status: 400 })
  }
  if (!canAccessTenant(session, tenantId)) {
    return NextResponse.json({ error: 'Tidak punya akses ke tenant ini' }, { status: 403 })
  }

  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('opening_checks')
    .upsert({
      tenant_id: tenantId,
      checker_id: session.userId,
      date,
      ...items,
      notes: notes || null,
    }, { onConflict: 'tenant_id,date' })
    .select()
    .single()

  if (error) {
    console.error('[/api/opening-checks] insert error:', error)
    return NextResponse.json({ error: 'Gagal simpan checklist' }, { status: 500 })
  }

  // Alert kalau ada poin yang belum siap (false)
  const issues = Object.entries(items).filter(([, ok]) => ok === false)
  if (issues.length > 0) {
    await supabase.from('dashboard_alerts').insert({
      tenant_id: tenantId,
      type: 'opening_issue',
      severity: 'yellow',
      message: `Opening checklist: ${issues.length} poin belum siap — ${notes || 'tanpa catatan'}`,
      reference_id: data.id,
    })
  }

  return NextResponse.json({ success: true, check: data })
}
