// GET  /api/complaints?tenantId=xxx&status=open
// POST /api/complaints — buat insiden baru
// PATCH /api/complaints — resolve insiden
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToRole } from '@/lib/push'
import { getSession } from '@/lib/session'
import { canAccessTenant } from '@/lib/authz'


export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId') ?? session.selectedTenantId
  const status   = searchParams.get('status') // open | resolved | null = semua

  if (tenantId) {
    if (!canAccessTenant(session, tenantId)) {
      return NextResponse.json({ error: 'Tidak punya akses ke tenant ini' }, { status: 403 })
    }
  } else if (session.primaryRole !== 'owner') {
    return NextResponse.json({ error: 'tenantId wajib untuk peran Anda' }, { status: 400 })
  }

  const supabase = createAdminClient()
  let query = supabase
    .from('complaints')
    .select('*, reporter:users(name)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (tenantId) query = query.eq('tenant_id', tenantId)
  if (status)   query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ complaints: data ?? [] })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { tenantId, type, description, severity } = body

  if (!tenantId || !type || !description) {
    return NextResponse.json({ error: 'tenantId, type, description wajib' }, { status: 400 })
  }
  if (!canAccessTenant(session, tenantId)) {
    return NextResponse.json({ error: 'Tidak punya akses ke tenant ini' }, { status: 403 })
  }

  const supabase = createAdminClient()

  // Buat complaint
  const { data, error } = await supabase
    .from('complaints')
    .insert({
      tenant_id:   tenantId,
      reporter_id: session.userId,
      type,
      description: description.trim(),
      severity:    severity ?? 'medium',
      status:      'open',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Buat dashboard_alert + push notification kalau severity high
  if (severity === 'high') {
    await supabase.from('dashboard_alerts').insert({
      tenant_id:    tenantId,
      type:         'complaint',
      severity:     'red',
      message:      `🚨 Insiden: ${description.trim().substring(0, 80)}`,
      reference_id: data.id,
    })
    sendPushToRole('🚨 Insiden Baru', description.trim().substring(0, 120), '/app/dashboard')
      .catch(err => console.error('push error:', err))
  }

  return NextResponse.json({ success: true, complaint: data })
}

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['owner', 'supervisor'].includes(session.primaryRole)) {
    return NextResponse.json({ error: 'Hanya owner/supervisor' }, { status: 403 })
  }

  const body = await request.json()
  const { id, status } = body
  if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 })

  const supabase = createAdminClient()

  // OTORISASI: pastikan insiden milik tenant yang boleh diakses
  const { data: cm } = await supabase.from('complaints').select('tenant_id').eq('id', id).single()
  if (!cm || !canAccessTenant(session, cm.tenant_id)) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 })
  }
  const { data, error } = await supabase
    .from('complaints')
    .update({
      status:      status ?? 'resolved',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, complaint: data })
}
