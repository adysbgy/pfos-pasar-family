'use client'

import { useState, useEffect } from 'react'
import TenantPicker from '@/components/TenantPicker'
import type { SessionPayload } from '@/types'

// ============================================================
// Opening Checklist — Pra-buka toko
// Design utama untuk Om Tommy (supervisor, 75 thn): tombol besar
// ============================================================

interface Tenant { id: string; name: string; color: string }

const CHECK_ITEMS = [
  { key: 'bahan_siap',       label: 'Bahan baku siap',       icon: '🥬' },
  { key: 'peralatan_bersih', label: 'Peralatan bersih',       icon: '🍳' },
  { key: 'area_bersih',      label: 'Area & meja bersih',     icon: '🧹' },
  { key: 'stok_dicek',       label: 'Stok sudah dicek',       icon: '📦' },
  { key: 'kasir_siap',       label: 'Kasir & laci siap',      icon: '💵' },
  { key: 'gas_listrik_aman', label: 'Gas & listrik aman',     icon: '🔌' },
] as const

type CheckKey = typeof CHECK_ITEMS[number]['key']

interface OpeningCheck {
  id: string
  date: string
  notes: string | null
  checker?: { name: string }
  [key: string]: any
}

export default function OpeningPage() {
  const [session, setSession]       = useState<SessionPayload | null>(null)
  const [tenants, setTenants]       = useState<Tenant[]>([])
  const [selectedTenant, setSelectedTenant] = useState('')
  const [existingCheck, setExistingCheck] = useState<OpeningCheck | null>(null)
  const [checks, setChecks]         = useState<Partial<Record<CheckKey, boolean>>>({})
  const [notes, setNotes]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => {
      setSession(d.session)
      if (d.session?.selectedTenantId) setSelectedTenant(d.session.selectedTenantId)
    })
    fetch('/api/tenants').then(r => r.json()).then(d => setTenants(d.tenants ?? []))
  }, [])

  useEffect(() => {
    if (selectedTenant) loadCheck(selectedTenant)
  }, [selectedTenant])

  async function loadCheck(tenantId: string) {
    setLoading(true)
    const res = await fetch(`/api/opening-checks?tenantId=${tenantId}`)
    const data = await res.json()
    setExistingCheck(data.check)
    setChecks({})
    setNotes('')
    setSubmitted(false)
    setLoading(false)
  }

  const allChecked = CHECK_ITEMS.every(c => checks[c.key] !== undefined)
  const allOk = CHECK_ITEMS.every(c => checks[c.key] === true)

  async function handleSubmit() {
    if (!selectedTenant) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/opening-checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: selectedTenant, items: checks, notes: notes || null }),
      })
      const data = await res.json()
      if (data.success) {
        setSubmitted(true)
        setExistingCheck(data.check)
      } else alert(data.error ?? 'Gagal')
    } catch { alert('Koneksi bermasalah.') }
    finally { setSubmitting(false) }
  }

  // ── Pilih tenant dulu ───────────────────────────────────────
  if (!selectedTenant) {
    return (
      <div>
        <TenantPicker tenants={tenants} selected={selectedTenant} onSelect={setSelectedTenant} />
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-3">🏪</p>
          <p className="font-medium">Pilih tenant dulu</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Sudah checklist hari ini ──────────────────────────────
  if (existingCheck && !submitted) {
    const issuesCount = CHECK_ITEMS.filter(c => existingCheck[c.key] === false).length
    return (
      <div>
        {!session?.selectedTenantId && <TenantPicker tenants={tenants} selected={selectedTenant} onSelect={setSelectedTenant} />}
        <div className="max-w-md mx-auto px-4 py-6 text-center">
          <div className="text-6xl mb-4">{issuesCount === 0 ? '✅' : '⚠️'}</div>
          <h1 className="text-2xl font-bold mb-1">Sudah Checklist Hari Ini</h1>
          <p className="text-sm text-gray-500 mb-6">
            Oleh {existingCheck.checker?.name ?? 'Staff'}
            {issuesCount > 0 && ` · ${issuesCount} poin belum siap`}
          </p>
          <div className="card text-left">
            {CHECK_ITEMS.map(c => (
              <div key={c.key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700">{c.icon} {c.label}</span>
                <span className={existingCheck[c.key] ? 'text-green-600' : 'text-red-500'}>
                  {existingCheck[c.key] ? '✓' : '✗'}
                </span>
              </div>
            ))}
          </div>
          {existingCheck.notes && (
            <p className="text-sm text-gray-500 mt-4 bg-gray-50 rounded-xl px-4 py-3">{existingCheck.notes}</p>
          )}
          <button onClick={() => setExistingCheck(null)} className="mt-6 text-sm text-gray-500 underline">
            Isi ulang checklist
          </button>
        </div>
      </div>
    )
  }

  // ── Sukses submit ────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <div className="text-6xl mb-4">{allOk ? '✅' : '⚠️'}</div>
        <h2 className="text-2xl font-bold">Checklist Tersimpan!</h2>
        <p className="text-gray-500 mt-2">{allOk ? 'Semua siap, toko boleh buka.' : 'Ada poin belum siap — owner sudah diberi tahu.'}</p>
      </div>
    )
  }

  // ── Form Checklist ───────────────────────────────────────
  return (
    <div>
      {!session?.selectedTenantId && <TenantPicker tenants={tenants} selected={selectedTenant} onSelect={setSelectedTenant} />}
      <div className="max-w-md mx-auto px-4 py-4">
        <h1 className="text-xl font-bold mb-1">🌅 Opening Checklist</h1>
        <p className="text-sm text-gray-500 mb-5">Cek sebelum buka toko hari ini</p>

        <div className="space-y-2 mb-5">
          {CHECK_ITEMS.map(c => (
            <div key={c.key} className={`card flex items-center gap-3 py-4 ${checks[c.key] === true ? 'bg-green-50 border-green-200' : checks[c.key] === false ? 'bg-red-50 border-red-200' : ''}`}>
              <span className="text-3xl">{c.icon}</span>
              <p className="flex-1 font-semibold text-base">{c.label}</p>
              <button onClick={() => setChecks(p => ({ ...p, [c.key]: true }))}
                className={`w-12 h-12 rounded-2xl font-bold text-2xl ${checks[c.key] === true ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>✓</button>
              <button onClick={() => setChecks(p => ({ ...p, [c.key]: false }))}
                className={`w-12 h-12 rounded-2xl font-bold text-2xl ${checks[c.key] === false ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'}`}>✗</button>
            </div>
          ))}
        </div>

        {!allOk && allChecked && (
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Catatan (wajib kalau ada yang belum siap)..."
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-base mb-4 focus:border-gray-900 outline-none resize-none" />
        )}

        <button onClick={handleSubmit}
          disabled={submitting || !allChecked || (!allOk && !notes.trim())}
          className="w-full py-5 text-xl font-bold bg-gray-900 text-white rounded-2xl disabled:opacity-40 active:bg-gray-700">
          {submitting ? '...' : '✅ SIMPAN CHECKLIST'}
        </button>
      </div>
    </div>
  )
}
