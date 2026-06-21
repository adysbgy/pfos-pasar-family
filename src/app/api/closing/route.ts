// GET  /api/closing?tenantId=xxx — Ringkasan penjualan hari ini + sesi kas
// POST /api/closing — Submit closing report, tutup sesi kas, alert jika selisih besar
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId wajib diisi' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [ordersRes, cashRes] = await Promise.all([
    supabase.from('orders').select('id, channel, payment_method, total, status').eq('tenant_id', tenantId).gte('created_at', today),
    supabase.from('cash_sessions').select('*').eq('tenant_id', tenantId).eq('date', today).single(),
  ])

  const orders = ordersRes.data ?? []
  const completed = orders.filter((o: any) => o.status === 'completed' || o.status === 'ready')

  const cashSession = cashRes.data ?? null
  const expRes = cashSession
    ? await supabase.from('cash_expenses').select('amount').eq('session_id', cashSession.id)
    : { data: [] }
  const totalExpenses = (expRes.data ?? []).reduce((s: number, e: any) => s + e.amount, 0)

  const summary = {
    totalOrders:   completed.length,
    grossSales:    completed.reduce((s: number, o: any) => s + o.total, 0),
    totalCash:     completed.filter((o: any) => o.payment_method === 'cash').reduce((s: number, o: any) => s + o.total, 0),
    totalQris:     completed.filter((o: any) => o.payment_method === 'qris').reduce((s: number, o: any) => s + o.total, 0),
    dineIn:        completed.filter((o: any) => o.channel === 'dine_in').length,
    takeaway:      completed.filter((o: any) => o.channel === 'takeaway').length,
    delivery:      completed.filter((o: any) => ['gofood','grabfood','shopeefood','whatsapp'].includes(o.channel)).length,
    totalExpenses,
  }

  return NextResponse.json({ summary, cashSession })
}

export async function POST(request: Request) {
  const body = await request.json()
  const {
    tenantId, userId, cashSessionId, summary, expectedCash,
    actualCash, qrisTotal, selisih, selisihNotes,
  } = body as {
    tenantId?: string; userId?: string; cashSessionId?: string | null
    summary?: { totalOrders: number; grossSales: number; totalCash: number; totalQris: number; dineIn: number; takeaway: number; delivery: number }
    expectedCash?: number; actualCash?: number; qrisTotal?: number; selisih?: number; selisihNotes?: string
  }

  if (!tenantId || !userId || !summary) {
    return NextResponse.json({ error: 'tenantId, userId, summary wajib' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  if (cashSessionId) {
    const { error } = await supabase.from('cash_sessions').update({
      closer_id: userId,
      closing_cash_expected: expectedCash ?? 0,
      closing_cash_actual: actualCash ?? 0,
      selisih: selisih ?? 0,
      selisih_notes: selisihNotes || null,
      qris_total_reported: qrisTotal ?? 0,
      status: 'closed',
      closed_at: new Date().toISOString(),
    }).eq('id', cashSessionId)
    if (error) console.error('[/api/closing] update cash_session error:', error)
  }

  const { error: reportError } = await supabase.from('closing_reports').insert({
    tenant_id: tenantId,
    date: today,
    submitter_id: userId,
    total_orders:   summary.totalOrders,
    total_dine_in:  summary.dineIn,
    total_takeaway: summary.takeaway,
    total_delivery: summary.delivery,
    total_cash:     summary.totalCash,
    total_qris:     summary.totalQris,
    gross_sales:    summary.grossSales,
    cash_session_id: cashSessionId ?? null,
  })
  if (reportError) {
    console.error('[/api/closing] insert closing_reports error:', reportError)
    return NextResponse.json({ error: 'Gagal simpan closing report' }, { status: 500 })
  }

  if (Math.abs(selisih ?? 0) > 10000) {
    const { error: alertError } = await supabase.from('dashboard_alerts').insert({
      tenant_id: tenantId,
      type: 'cash_selisih',
      severity: 'red',
      message: `Selisih kas ${(selisih ?? 0) > 0 ? '+' : ''}${selisih} — ${selisihNotes ?? ''}`,
    })
    if (alertError) console.error('[/api/closing] insert alert error:', alertError)
  }

  return NextResponse.json({ success: true })
}
