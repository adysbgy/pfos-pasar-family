'use client'

import { useState, useEffect } from 'react'
import { formatRupiah } from '@/types'

// ============================================================
// Halaman Manajemen Voucher & Diskon
// Role: owner, supervisor
// ============================================================

interface Tenant { id: string; name: string; color: string }

interface Voucher {
  id: string
  tenant_id: string | null
  code: string
  type: 'percent' | 'fixed'
  value: number
  min_purchase: number
  max_discount: number | null
  usage_limit: number | null
  used_count: number
  status: 'active' | 'inactive'
  created_at: string
}

export default function VouchersPage() {
  const [tenants, setTenants]   = useState<Tenant[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading]   = useState(true)
  const [view, setView]         = useState<'list' | 'add'>('list')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Form
  const [fCode, setFCode]         = useState('')
  const [fTenant, setFTenant]     = useState('')   // '' = semua tenant
  const [fType, setFType]         = useState<'percent' | 'fixed'>('percent')
  const [fValue, setFValue]       = useState('')
  const [fMinPurchase, setFMinPurchase] = useState('0')
  const [fMaxDiscount, setFMaxDiscount] = useState('')
  const [fUsageLimit, setFUsageLimit]   = useState('')

  useEffect(() => {
    fetch('/api/tenants').then(r => r.json()).then(d => setTenants(d.tenants ?? []))
    loadVouchers()
  }, [])

  async function loadVouchers() {
    setLoading(true)
    const res = await fetch('/api/vouchers')
    const data = await res.json()
    setVouchers(data.vouchers ?? [])
    setLoading(false)
  }

  function openAdd() {
    setFCode(''); setFTenant(''); setFType('percent'); setFValue('')
    setFMinPurchase('0'); setFMaxDiscount(''); setFUsageLimit('')
    setErrorMsg('')
    setView('add')
  }

  async function handleCreate() {
    if (!fCode.trim() || !fValue) return
    setSubmitting(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: fCode.trim(),
          tenantId: fTenant || null,
          type: fType,
          value: parseInt(fValue),
          minPurchase: parseInt(fMinPurchase) || 0,
          maxDiscount: fMaxDiscount ? parseInt(fMaxDiscount) : null,
          usageLimit: fUsageLimit ? parseInt(fUsageLimit) : null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setVouchers(prev => [data.voucher, ...prev])
        setView('list')
      } else {
        setErrorMsg(data.error ?? 'Gagal membuat voucher')
      }
    } catch { setErrorMsg('Koneksi bermasalah.') }
    finally { setSubmitting(false) }
  }

  async function toggleStatus(v: Voucher) {
    const newStatus = v.status === 'active' ? 'inactive' : 'active'
    await fetch('/api/vouchers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: v.id, status: newStatus }),
    })
    setVouchers(prev => prev.map(x => x.id === v.id ? { ...x, status: newStatus } : x))
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus voucher ini?')) return
    await fetch(`/api/vouchers?id=${id}`, { method: 'DELETE' })
    setVouchers(prev => prev.filter(v => v.id !== id))
  }

  function tenantName(id: string | null) {
    if (!id) return 'Semua Tenant'
    return tenants.find(t => t.id === id)?.name ?? '—'
  }

  // ── View: Add ─────────────────────────────────────────────
  if (view === 'add') {
    return (
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('list')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-lg">←</button>
          <h1 className="text-xl font-bold">Voucher Baru</h1>
        </div>

        {errorMsg && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{errorMsg}</div>
        )}

        <div className="card mb-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">Kode Voucher *</label>
          <input type="text" value={fCode} onChange={e => setFCode(e.target.value.toUpperCase())}
            placeholder="Contoh: HEMAT10" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-gray-900 outline-none font-bold" />
        </div>

        <div className="card mb-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">Berlaku untuk Tenant</label>
          <select value={fTenant} onChange={e => setFTenant(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-gray-900 outline-none bg-white">
            <option value="">Semua Tenant</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="card mb-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">Tipe Diskon</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setFType('percent')}
              className={`py-2.5 rounded-xl border-2 text-sm font-medium ${fType === 'percent' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white'}`}>
              Persen (%)
            </button>
            <button onClick={() => setFType('fixed')}
              className={`py-2.5 rounded-xl border-2 text-sm font-medium ${fType === 'fixed' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white'}`}>
              Nominal (Rp)
            </button>
          </div>
        </div>

        <div className="card mb-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">
            {fType === 'percent' ? 'Persen Diskon (1-100)' : 'Nominal Diskon (Rp)'} *
          </label>
          <input type="tel" inputMode="numeric" value={fValue} onChange={e => setFValue(e.target.value.replace(/\D/g,''))}
            placeholder="0" className="w-full text-2xl font-bold border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-gray-900 outline-none" />
        </div>

        {fType === 'percent' && (
          <div className="card mb-4">
            <label className="text-sm font-medium text-gray-700 block mb-2">Maks. Diskon (Rp, opsional)</label>
            <input type="tel" inputMode="numeric" value={fMaxDiscount} onChange={e => setFMaxDiscount(e.target.value.replace(/\D/g,''))}
              placeholder="Tanpa batas" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-gray-900 outline-none" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="card">
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Min. Belanja</label>
            <input type="tel" inputMode="numeric" value={fMinPurchase} onChange={e => setFMinPurchase(e.target.value.replace(/\D/g,''))}
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-gray-900 outline-none" />
          </div>
          <div className="card">
            <label className="text-xs font-medium text-gray-600 block mb-1.5">Kuota Pakai</label>
            <input type="tel" inputMode="numeric" value={fUsageLimit} onChange={e => setFUsageLimit(e.target.value.replace(/\D/g,''))}
              placeholder="Tanpa batas" className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:border-gray-900 outline-none" />
          </div>
        </div>

        <button onClick={handleCreate} disabled={submitting || !fCode.trim() || !fValue}
          className="btn-primary w-full py-4 text-lg disabled:opacity-40">
          {submitting ? '...' : '+ Buat Voucher'}
        </button>
      </div>
    )
  }

  // ── View: List ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Voucher & Diskon</h1>
        <button onClick={openAdd} className="bg-gray-900 text-white text-sm font-medium px-3 py-2 rounded-xl active:bg-gray-700">
          + Voucher
        </button>
      </div>

      {vouchers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🎟️</p>
          <p>Belum ada voucher</p>
        </div>
      ) : (
        <div className="space-y-2">
          {vouchers.map(v => (
            <div key={v.id} className={`card ${v.status === 'inactive' ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between mb-1">
                <p className="font-bold text-lg tracking-wide">{v.code}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {v.status === 'active' ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <p className="text-sm text-gray-700">
                {v.type === 'percent' ? `${v.value}% diskon` : `${formatRupiah(v.value)} diskon`}
                {v.max_discount ? ` (maks ${formatRupiah(v.max_discount)})` : ''}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {tenantName(v.tenant_id)} · Min belanja {formatRupiah(v.min_purchase)}
                {v.usage_limit ? ` · Dipakai ${v.used_count}/${v.usage_limit}` : ` · Dipakai ${v.used_count}x`}
              </p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => toggleStatus(v)}
                  className="flex-1 text-xs font-medium py-2 rounded-lg bg-gray-100 text-gray-700 active:bg-gray-200">
                  {v.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
                <button onClick={() => handleDelete(v.id)}
                  className="flex-1 text-xs font-medium py-2 rounded-lg bg-red-50 text-red-600 active:bg-red-100">
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
