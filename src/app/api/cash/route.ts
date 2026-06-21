// GET  /api/cash?tenantId=xxx — Sesi kas hari ini + riwayat pengeluaran
// POST /api/cash — action: 'open' (buka sesi) | 'expense' (catat pengeluaran)
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

  const { data: cashSession } = await supabase
    .from('cash_sessions').select('*').eq('tenant_id', tenantId).eq('date', today).single()

  let expenses: unknown[] = []
  if (cashSession) {
    const { data: exp } = await supabase
      .from('cash_expenses').select('*').eq('session_id', cashSession.id).order('created_at', { ascending: false })
    expenses = exp ?? []
  }

  return NextResponse.json({ cashSession: cashSession ?? null, expenses })
}

export async function POST(request: Request) {
  const body = await request.json()
  const { action } = body as { action?: 'open' | 'expense' }
  const supabase = createAdminClient()

  if (action === 'open') {
    const { tenantId, userId, openingCash } = body as { tenantId?: string; userId?: string; openingCash?: number }
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'tenantId, userId wajib' }, { status: 400 })
    }
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase.from('cash_sessions').insert({
      tenant_id: tenantId,
      date: today,
      opener_id: userId,
      opening_cash: openingCash ?? 0,
      cash_sales: 0,
      status: 'open',
    }).select().single()

    if (error) {
      console.error('[/api/cash] open error:', error)
      return NextResponse.json({ error: 'Gagal buka sesi kas' }, { status: 500 })
    }
    return NextResponse.json({ success: true, cashSession: data })
  }

  if (action === 'expense') {
    const { sessionId, amount, description, userId } = body as {
      sessionId?: string; amount?: number; description?: string; userId?: string
    }
    if (!sessionId || !amount || !description) {
      return NextResponse.json({ error: 'sessionId, amount, description wajib' }, { status: 400 })
    }
    const { data, error } = await supabase.from('cash_expenses').insert({
      session_id: sessionId,
      amount,
      description,
      created_by: userId,
    }).select().single()

    if (error) {
      console.error('[/api/cash] expense error:', error)
      return NextResponse.json({ error: 'Gagal catat pengeluaran' }, { status: 500 })
    }
    return NextResponse.json({ success: true, expense: data })
  }

  return NextResponse.json({ error: 'action tidak dikenal' }, { status: 400 })
}
