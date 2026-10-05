// GET /api/vouchers/report?tenantId=xxx — efektivitas voucher: dipakai, total diskon, omzet terkait
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/session'
import { canAccessTenant } from '@/lib/authz'


export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')

  if (tenantId) {
    if (!canAccessTenant(session, tenantId)) {
      return NextResponse.json({ error: 'Tidak punya akses ke tenant ini' }, { status: 403 })
    }
  } else if (session.primaryRole !== 'owner') {
    return NextResponse.json({ error: 'tenantId wajib untuk peran Anda' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Order yang pakai voucher (voucher_id tidak null)
  let query = supabase
    .from('orders')
    .select('voucher_id, voucher_code, discount, total')
    .not('voucher_id', 'is', null)
  if (tenantId) query = query.eq('tenant_id', tenantId)

  const { data: orders, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Agregasi per voucher
  const agg: Record<string, { code: string; uses: number; totalDiscount: number; totalRevenue: number }> = {}
  ;(orders ?? []).forEach((o: any) => {
    const id = o.voucher_id
    if (!agg[id]) agg[id] = { code: o.voucher_code ?? '—', uses: 0, totalDiscount: 0, totalRevenue: 0 }
    agg[id].uses += 1
    agg[id].totalDiscount += o.discount ?? 0
    agg[id].totalRevenue += o.total ?? 0
  })

  const report = Object.entries(agg)
    .map(([voucherId, v]) => ({ voucherId, ...v }))
    .sort((a, b) => b.uses - a.uses)

  const summary = {
    totalUses: report.reduce((s, r) => s + r.uses, 0),
    totalDiscount: report.reduce((s, r) => s + r.totalDiscount, 0),
    totalRevenue: report.reduce((s, r) => s + r.totalRevenue, 0),
  }

  return NextResponse.json({ report, summary })
}
