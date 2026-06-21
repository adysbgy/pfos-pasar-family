// GET   /api/kitchen?tenantId=xxx — Antrian dapur (waiting/cooking/qa_pending)
// PATCH /api/kitchen — Update status antrian + sync status order
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId wajib diisi' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('kitchen_queue')
    .select(`
      id, order_id, status, started_at, done_at,
      order:orders(
        order_number, channel, notes, created_at,
        order_items(quantity, menu_item:menu_items(name))
      )
    `)
    .eq('tenant_id', tenantId)
    .in('status', ['waiting', 'cooking', 'qa_pending'])
    .order('done_at', { ascending: true, nullsFirst: true })

  if (error) {
    console.error('[/api/kitchen] error:', error)
    return NextResponse.json({ error: 'Gagal mengambil antrian' }, { status: 500 })
  }

  return NextResponse.json({ queue: data ?? [] })
}

export async function PATCH(request: Request) {
  const body = await request.json()
  const { queueId, orderId, status } = body as { queueId?: string; orderId?: string; status?: string }

  if (!queueId || !orderId || !status) {
    return NextResponse.json({ error: 'queueId, orderId, status wajib' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const updates: Record<string, unknown> = { status }
  if (status === 'cooking') updates.started_at = new Date().toISOString()
  if (status === 'qa_pending') updates.done_at = new Date().toISOString()

  const { error: queueError } = await supabase.from('kitchen_queue').update(updates).eq('id', queueId)
  if (queueError) {
    console.error('[/api/kitchen] update queue error:', queueError)
    return NextResponse.json({ error: 'Gagal update antrian' }, { status: 500 })
  }

  const orderStatus =
    status === 'cooking'    ? 'cooking'    :
    status === 'qa_pending' ? 'qa_pending' :
    status === 'done'       ? 'ready'      : 'pending'

  const { error: orderError } = await supabase.from('orders').update({ status: orderStatus }).eq('id', orderId)
  if (orderError) {
    console.error('[/api/kitchen] update order error:', orderError)
  }

  return NextResponse.json({ success: true })
}
