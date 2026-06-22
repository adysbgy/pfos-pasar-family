// GET /api/inventory/history?itemId=xxx — Riwayat transaksi per item
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SessionPayload } from '@/types'

export async function GET(request: Request) {
  const raw = cookies().get('pfos_session')?.value
  if (!raw) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let session: SessionPayload
  try { session = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  void session // session valid check is enough

  const { searchParams } = new URL(request.url)
  const itemId = searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'itemId diperlukan' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('id, type, qty_change, qty_before, qty_after, notes, created_at, supplier:suppliers(name)')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transactions: data ?? [] })
}
