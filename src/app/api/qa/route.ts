// GET  /api/qa?tenantId=xxx — Order yang menunggu QA
// POST /api/qa — Submit hasil QA (pass/fail), sync kitchen_queue + orders + dashboard_alerts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SessionPayload } from '@/types'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId wajib diisi' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('kitchen_queue')
    .select('id, order_id, order:orders(id, order_number, notes, order_items(quantity, menu_item:menu_items(name)))')
    .eq('tenant_id', tenantId)
    .eq('status', 'qa_pending')

  if (error) {
    console.error('[/api/qa] error:', error)
    return NextResponse.json({ error: 'Gagal mengambil data QA' }, { status: 500 })
  }

  const mapped = (data ?? []).map((row: any) => ({
    id: row.order.id, queueId: row.id,
    order_number: row.order.order_number,
    order_items: row.order.order_items,
    notes: row.order.notes,
  }))

  return NextResponse.json({ orders: mapped })
}

export async function POST(request: Request) {
  const raw = cookies().get('pfos_session')?.value
  if (!raw) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  const session = JSON.parse(raw) as SessionPayload

  const body = await request.json()
  const { orderId, queueId, orderNumber, checks, notes, result } = body as {
    orderId?: string; queueId?: string; orderNumber?: string
    checks?: Record<string, boolean | null>; notes?: string; result?: 'pass' | 'fail'
  }

  if (!orderId || !queueId || !result) {
    return NextResponse.json({ error: 'orderId, queueId, result wajib' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { error: checkError } = await supabase.from('qa_checks').insert({
    order_id: orderId, checker_id: session.userId,
    ...(checks ?? {}), notes: notes || null, result,
  })
  if (checkError) console.error('[/api/qa] insert qa_checks error:', checkError)

  const { error: queueError } = await supabase.from('kitchen_queue').update({ status: 'done' }).eq('id', queueId)
  if (queueError) console.error('[/api/qa] update queue error:', queueError)

  const { error: orderError } = await supabase
    .from('orders').update({ status: result === 'pass' ? 'ready' : 'cancelled' }).eq('id', orderId)
  if (orderError) console.error('[/api/qa] update order error:', orderError)

  if (result === 'fail') {
    const { error: alertError } = await supabase.from('dashboard_alerts').insert({
      tenant_id: session.selectedTenantId, type: 'qa_fail', severity: 'red',
      message: `QA FAIL: Order ${orderNumber ?? ''} — ${notes || 'tidak ada catatan'}`,
      reference_id: orderId,
    })
    if (alertError) console.error('[/api/qa] insert alert error:', alertError)
  }

  return NextResponse.json({ success: true })
}
