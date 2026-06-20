'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRupiah } from '@/types'
import type { SessionPayload } from '@/types'

export default function ClosingPage() {
  const supabase = createClient()
  const [session, setSession]       = useState<SessionPayload | null>(null)
  const [loading, setLoading]       = useState(true)
  const [summary, setSummary]       = useState<any>(null)
  const [cashSession, setCashSession] = useState<any>(null)
  const [actualCash, setActualCash] = useState('')
  const [qrisTotal, setQrisTotal]   = useState('')
  const [selisihNotes, setSelisihNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => setSession(d.session))
  }, [])

  useEffect(() => {
    if (!session?.selectedTenantId) return
    loadData(session.selectedTenantId)
  }, [session])

  async function loadData(tenantId: string) {
    const today = new Date().toISOString().split('T')[0]

    const [ordersRes, cashRes] = await Promise.all([
      supabase.from('orders').select('id, channel, payment_method, total, status').eq('tenant_id', tenantId).gte('created_at', today),
      supabase.from('cash_sessions').select('*').eq('tenant_id', tenantId).eq('date', today).single(),
    ])

    const orders = ordersRes.data ?? []
    const completed = orders.filter((o: any) => o.status === 'completed' || o.status === 'ready')

    const expRes = cashRes.data
      ? await supabase.from('cash_expenses').select('amount').eq('session_id', cashRes.data.id)
      : { data: [] }
    const totalExpenses = (expRes.data ?? []).reduce((s: number, e: any) => s + e.amount, 0)

    setSummary({
      totalOrders:   completed.length,
      grossSales:    completed.reduce((s: number, o: any) => s + o.total, 0),
      totalCash:     completed.filter((o: any) => o.payment_method === 'cash').reduce((s: number, o: any) => s + o.total, 0),
      totalQris:     completed.filter((o: any) => o.payment_method === 'qris').reduce((s: number, o: any) => s + o.total, 0),
      dineIn:        completed.filter((o: any) => o.channel === 'dine_in').length,
      takeaway:      completed.filter((o: any) => o.channel === 'takeaway').length,
      delivery:      completed.filter((o: any) => ['gofood','grabfood','shopeefood','whatsapp'].includes(o.channel)).length,
      totalExpenses,
    })
    setCashSession(cashRes.data)
    setLoading(false)
  }

  const expectedCash = cashSession
    ? (cashSession.opening_cash + (summary?.totalCash ?? 0)) - (summary?.totalExpenses ?? 0)
    : 0
  const selisih = parseInt(actualCash) - expectedCash

  async function submitClosing() {
    if (!session?.selectedTenantId || !summary) return
    if (Math.abs(selisih) > 10000 && !selisihNotes.trim()) {
      alert('Selisih > Rp10.000! Wajib isi catatan selisih.')
      return
    }
    setSubmitting(true)
    const today = new Date().toISOString().split('T')[0]

    // Close cash session
    if (cashSession) {
      await supabase.from('cash_sessions').update({
        closer_id: session.userId,
        closing_cash_expected: expectedCash,
        closing_cash_actual: parseInt(actualCash) || 0,
        selisih,
        selisih_notes: selisihNotes || null,
        qris_total_reported: parseInt(qrisTotal) || 0,
        status: 'closed',
        closed_at: new Date().toISOString(),
      }).eq('id', cashSession.id)
    }

    // Insert closing report
    await supabase.from('closing_reports').insert({
      tenant_id: session.selectedTenantId,
      date: today,
      submitter_id: session.userId,
      total_orders:   summary.totalOrders,
      total_dine_in:  summary.dineIn,
      total_takeaway: summary.takeaway,
      total_delivery: summary.delivery,
      total_cash:     summary.totalCash,
      total_qris:     summary.totalQris,
      gross_sales:    summary.grossSales,
      cash_session_id: cashSession?.id,
    })

    // Alert jika selisih besar
    if (Math.abs(selisih) > 10000) {
      await supabase.from('dashboard_alerts').insert({
        tenant_id: session.selectedTenantId,
        type: 'cash_selisih',
        severity: 'red',
        message: `Selisih kas ${selisih > 0 ? '+' : ''}${formatRupiah(selisih)} — ${selisihNotes}`,
      })
    }

    setSubmitted(true)
    setSubmitting(false)
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" /></div>

  if (submitted) return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
      <div className="text-6xl mb-4">📑</div>
      <h2 className="text-2xl font-bold">Closing Selesai!</h2>
      <p className="text-gray-500 mt-2">Laporan hari ini sudah tersimpan.</p>
      <div className="mt-6 card w-full max-w-xs text-left">
        <div className="flex justify-between"><span className="text-gray-500 text-sm">Total Order</span><span className="font-bold">{summary?.totalOrders}</span></div>
        <div className="flex justify-between mt-1"><span className="text-gray-500 text-sm">Total Penjualan</span><span className="font-bold">{formatRupiah(summary?.grossSales ?? 0)}</span></div>
        {Math.abs(selisih) > 0 && <div className={`flex justify-between mt-1 ${Math.abs(selisih) > 10000 ? 'text-red-600' : 'text-gray-700'}`}>
          <span className="text-sm">Selisih Kas</span>
          <span className="font-bold">{selisih > 0 ? '+' : ''}{formatRupiah(selisih)}</span>
        </div>}
      </div>
    </div>
  )

  return (
    <div className="max-w-md mx-auto px-4 py-4">
      <h1 className="text-xl font-bold mb-1">Closing Report</h1>
      <p className="text-sm text-gray-500 mb-4">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

      {/* Ringkasan penjualan */}
      <div className="card mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Ringkasan Penjualan</p>
        <div className="space-y-2">
          {[
            { label: 'Total Order', value: `${summary?.totalOrders ?? 0} order` },
            { label: 'Total Penjualan', value: formatRupiah(summary?.grossSales ?? 0) },
            { label: 'Cash', value: formatRupiah(summary?.totalCash ?? 0) },
            { label: 'QRIS', value: formatRupiah(summary?.totalQris ?? 0) },
            { label: 'Makan di Sini', value: `${summary?.dineIn ?? 0}` },
            { label: 'Bawa Pulang', value: `${summary?.takeaway ?? 0}` },
            { label: 'Delivery', value: `${summary?.delivery ?? 0}` },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-gray-500">{label}</span>
              <span className="font-semibold">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Closing kas */}
      <div className="card mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Hitung Kas</p>
        <div className="flex justify-between text-sm mb-3">
          <span className="text-gray-500">Ekspektasi Laci</span>
          <span className="font-bold text-lg">{formatRupiah(expectedCash)}</span>
        </div>
        <label className="text-sm text-gray-600 block mb-1">Uang di Laci (hitung manual)</label>
        <input type="tel" inputMode="numeric" value={actualCash} onChange={e => setActualCash(e.target.value)}
          placeholder="0" className="w-full text-xl font-bold border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-gray-900 outline-none mb-2" />
        {actualCash && (
          <div className={`flex justify-between rounded-xl px-4 py-3 ${Math.abs(selisih) > 10000 ? 'bg-red-50' : 'bg-green-50'}`}>
            <span className={`text-sm ${Math.abs(selisih) > 10000 ? 'text-red-700' : 'text-green-700'}`}>Selisih</span>
            <span className={`font-bold ${Math.abs(selisih) > 10000 ? 'text-red-800' : 'text-green-800'}`}>
              {selisih > 0 ? '+' : ''}{formatRupiah(selisih)}
            </span>
          </div>
        )}
        {Math.abs(selisih) > 10000 && (
          <div className="mt-3">
            <label className="text-sm text-red-600 font-medium block mb-1">⚠️ Catatan selisih (wajib)</label>
            <textarea value={selisihNotes} onChange={e => setSelisihNotes(e.target.value)} rows={2}
              placeholder="Jelaskan penyebab selisih..."
              className="w-full border-2 border-red-300 rounded-xl px-3 py-2 text-sm focus:border-red-500 outline-none resize-none" />
          </div>
        )}
      </div>

      {/* QRIS total */}
      <div className="card mb-6">
        <label className="text-sm font-medium text-gray-700 block mb-2">Total QRIS (cek notif GoPay)</label>
        <input type="tel" inputMode="numeric" value={qrisTotal} onChange={e => setQrisTotal(e.target.value)}
          placeholder="0" className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-gray-900 outline-none text-lg font-bold" />
        <p className="text-xs text-gray-400 mt-1">Masukkan total nominal dari notif GoPay Merchant hari ini</p>
      </div>

      <button onClick={submitClosing} disabled={submitting || !actualCash}
        className="btn-primary w-full py-4 text-lg disabled:opacity-40">
        {submitting ? '...' : '📑 Simpan Closing Report'}
      </button>
    </div>
  )
}
