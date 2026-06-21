'use client'

import { useState, useEffect } from 'react'
import { formatRupiah } from '@/types'
import TenantPicker from '@/components/TenantPicker'
import type { SessionPayload } from '@/types'

interface Tenant { id: string; name: string; color: string }

export default function ClosingPage() {
  const [session, setSession]       = useState<SessionPayload | null>(null)
  const [tenants, setTenants]       = useState<Tenant[]>([])
  const [selectedTenant, setSelectedTenant] = useState('')
  const [loading, setLoading]       = useState(true)
  const [summary, setSummary]       = useState<any>(null)
  const [cashSession, setCashSession] = useState<any>(null)
  const [actualCash, setActualCash] = useState('')
  const [qrisTotal, setQrisTotal]   = useState('')
  const [selisihNotes, setSelisihNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => {
      setSession(d.session)
      if (d.session?.selectedTenantId) setSelectedTenant(d.session.selectedTenantId)
      else setLoading(false)
    })
    fetch('/api/tenants').then(r => r.json()).then(d => setTenants(d.tenants ?? []))
  }, [])

  useEffect(() => {
    if (!selectedTenant) return
    loadData(selectedTenant)
  }, [selectedTenant])

  async function loadData(tenantId: string) {
    const res = await fetch(`/api/closing?tenantId=${tenantId}`)
    const data = await res.json()
    setSummary(data.summary)
    setCashSession(data.cashSession)
    setLoading(false)
  }

  const expectedCash = cashSession
    ? (cashSession.opening_cash + (summary?.totalCash ?? 0)) - (summary?.totalExpenses ?? 0)
    : 0
  const selisih = parseInt(actualCash) - expectedCash

  async function submitClosing() {
    if (!selectedTenant || !summary) return
    if (Math.abs(selisih) > 10000 && !selisihNotes.trim()) {
      alert('Selisih > Rp10.000! Wajib isi catatan selisih.')
      return
    }
    setSubmitting(true)
    await fetch('/api/closing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: selectedTenant,
        userId: session?.userId,
        cashSessionId: cashSession?.id ?? null,
        summary,
        expectedCash,
        actualCash: parseInt(actualCash) || 0,
        qrisTotal: parseInt(qrisTotal) || 0,
        selisih,
        selisihNotes: selisihNotes || null,
      }),
    })
    setSubmitted(true)
    setSubmitting(false)
  }

  if (!session?.selectedTenantId && !selectedTenant) {
    return (
      <div>
        <TenantPicker tenants={tenants} selected={selectedTenant} onSelect={id => { setLoading(true); setSelectedTenant(id) }} />
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-3">🏪</p>
          <p className="font-medium">Pilih tenant dulu</p>
        </div>
      </div>
    )
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
      {!session?.selectedTenantId && <TenantPicker tenants={tenants} selected={selectedTenant} onSelect={id => { setLoading(true); setSelectedTenant(id) }} />}
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
