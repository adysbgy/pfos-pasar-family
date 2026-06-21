// GET   /api/tasks — Tugas aktif (manager lihat semua, staff lain lihat tugas sendiri)
// PATCH /api/tasks — Tandai tugas selesai
// POST  /api/tasks — action: 'add' (tugas baru) | 'complaint' (insiden cepat)
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SessionPayload, RoleName } from '@/types'

function getSession(): SessionPayload | null {
  const raw = cookies().get('pfos_session')?.value
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export async function GET() {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })

  const supabase = createAdminClient()
  let query = supabase
    .from('staff_tasks')
    .select('*')
    .in('status', ['pending'])
    .order('due_time', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  const isManager = ['owner', 'supervisor'].includes(session.primaryRole as RoleName)
  if (!isManager) {
    query = query.or(`assigned_to.eq.${session.userId},assigned_to.is.null`)
  }
  if (session.selectedTenantId) {
    query = query.or(`tenant_id.eq.${session.selectedTenantId},tenant_id.is.null`)
  }

  const { data, error } = await query
  if (error) {
    console.error('[/api/tasks] error:', error)
    return NextResponse.json({ error: 'Gagal mengambil tugas' }, { status: 500 })
  }

  return NextResponse.json({ tasks: data ?? [] })
}

export async function PATCH(request: Request) {
  const body = await request.json()
  const { taskId } = body as { taskId?: string }
  if (!taskId) return NextResponse.json({ error: 'taskId wajib' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from('staff_tasks').update({
    status: 'done',
    completed_at: new Date().toISOString(),
  }).eq('id', taskId)

  if (error) {
    console.error('[/api/tasks] markDone error:', error)
    return NextResponse.json({ error: 'Gagal update tugas' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

export async function POST(request: Request) {
  const session = getSession()
  if (!session) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })

  const body = await request.json()
  const { action } = body as { action?: 'add' | 'complaint' }
  const supabase = createAdminClient()

  if (action === 'add') {
    const { title } = body as { title?: string }
    if (!title?.trim()) return NextResponse.json({ error: 'title wajib' }, { status: 400 })

    const { data, error } = await supabase.from('staff_tasks').insert({
      tenant_id:   session.selectedTenantId,
      assigned_by: session.userId,
      title:       title.trim(),
      type:        'manual',
      status:      'pending',
    }).select().single()

    if (error) {
      console.error('[/api/tasks] add error:', error)
      return NextResponse.json({ error: 'Gagal tambah tugas' }, { status: 500 })
    }
    return NextResponse.json({ success: true, task: data })
  }

  if (action === 'complaint') {
    const { type, label } = body as { type?: string; label?: string }
    if (!session.selectedTenantId || !type) {
      return NextResponse.json({ error: 'tenant/type wajib' }, { status: 400 })
    }

    const { error } = await supabase.from('complaints').insert({
      tenant_id:   session.selectedTenantId,
      reporter_id: session.userId,
      type,
      description: `Dilaporkan oleh ${session.name}`,
      severity:    'medium',
    })

    if (error) {
      console.error('[/api/tasks] complaint error:', error)
      return NextResponse.json({ error: 'Gagal catat insiden' }, { status: 500 })
    }
    return NextResponse.json({ success: true, label })
  }

  return NextResponse.json({ error: 'action tidak dikenal' }, { status: 400 })
}
