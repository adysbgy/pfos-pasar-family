'use client'

import { useState, useEffect } from 'react'
import TenantPicker from '@/components/TenantPicker'
import type { SessionPayload } from '@/types'

interface Tenant { id: string; name: string; color: string }

// ============================================================
// Halaman Complaint & Insiden
// Design utama untuk Om Tommy (supervisor, 75 thn): 3 tombol besar
// Role: supervisor, qa_checker (input), owner (resolve)
// ============================================================

type Severity = 'low' | 'medium' | 'high'
type ComplaintType = 'cleanliness' | 'complaint' | 'wrong_order' | 'other'

interface Complaint {
  id: string
  type: ComplaintType
  description: string
  severity: Severity
  status: 'open' | 'resolved'
  created_at: string
  reporter?: { name: string }
  resolution_notes?: string
}

const QUICK_BUTTONS: { type: ComplaintType; severity: Severity; icon: string; label: string; color: string }[] = [
  { type: 'cleanliness', severity: 'medium', icon: '🍽️', label: 'Piring\nKotor',   color: 'bg-yellow-50 border-yellow-300 text-yellow-900' },
  { type: 'complaint',   severity: 'high',   icon: '😤', label: 'Komplain\nTamu',  color: 'bg-red-50 border-red-300 text-red-900' },
  { type: 'wrong_order', severity: 'high',   icon: '❌', label: 'Menu\nSalah',     color: 'bg-orange-50 border-orange-300 text-orange-900' },
]

const TYPE_LABEL: Record<ComplaintType, string> = {
  cleanliness: 'Kebersihan',
  complaint:   'Komplain Tamu',
  wrong_order: 'Menu Salah',
  other:       'Lainnya',
}

const SEV_CONFIG: Record<Severity, { label: string; color: string }> = {
  low:    { label: 'Ringan',  color: 'bg-gray-100 text-gray-700' },
  medium: { label: 'Sedang',  color: 'bg-yellow-100 text-yellow-800' },
  high:   { label: 'Penting', color: 'bg-red-100 text-red-800' },
}

export default function ComplaintsPage() {
  const [session, setSession]       = useState<SessionPayload | null>(null)
  const [tenants, setTenants]       = useState<Tenant[]>([])
  const [selectedTenant, setSelectedTenant] = useState('')
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading]       = useState(true)
  const [view, setView]             = useState<'main' | 'form' | 'history'>('main')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  // Form state
  const [selType, setSelType]       = useState<ComplaintType>('complaint')
  const [selSev, setSelSev]         = useState<Severity>('high')
  const [desc, setDesc]             = useState('')

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => {
      setSession(d.session)
      if (d.session?.selectedTenantId) setSelectedTenant(d.session.selectedTenantId)
      else setLoading(false)
    })
    fetch('/api/tenants').then(r => r.json()).then(d => setTenants(d.tenants ?? []))
  }, [])

  useEffect(() => {
    if (selectedTenant) loadComplaints()
  }, [selectedTenant])

  async function loadComplaints() {
    if (!selectedTenant) return
    setLoading(true)
    const res = await fetch(`/api/complaints?tenantId=${selectedTenant}`)
    const data = await res.json()
    setComplaints(data.complaints ?? [])
    setLoading(false)
  }

  function openQuick(btn: typeof QUICK_BUTTONS[0]) {
    setSelType(btn.type)
    setSelSev(btn.severity)
    setDesc('')
    setSuccessMsg('')
    setView('form')
  }

  async function handleSubmit() {
    if (!desc.trim() || !selectedTenant) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId:    selectedTenant,
          type:        selType,
          description: desc.trim(),
          severity:    selSev,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccessMsg('✅ Laporan terkirim!')
        setDesc('')
        loadComplaints()
        setTimeout(() => { setSuccessMsg(''); setView('main') }, 2000)
      } else alert(data.error ?? 'Gagal')
    } catch { alert('Koneksi bermasalah.') }
    finally { setSubmitting(false) }
  }

  async function handleResolve(id: string) {
    if (!confirm('Tandai insiden ini sudah selesai?')) return
    await fetch('/api/complaints', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'resolved' }),
    })
    setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: 'resolved' } : c))
  }

  const openComplaints = complaints.filter(c => c.status === 'open')
  const isOwnerOrSup = session?.primaryRole === 'owner' || session?.primaryRole === 'supervisor'

  // ── View: Form ────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('main')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-lg">←</button>
          <h1 className="text-xl font-bold">{TYPE_LABEL[selType]}</h1>
        </div>

        {successMsg && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-4 text-center">
            <p className="text-2xl mb-1">✅</p>
            <p className="font-semibold text-green-800">{successMsg}</p>
          </div>
        )}

        {!successMsg && (
          <>
            {/* Pilih tipe */}
            <div className="card mb-4">
              <label className="text-sm font-medium text-gray-700 block mb-2">Jenis Insiden</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(TYPE_LABEL) as [ComplaintType, string][]).map(([t, label]) => (
                  <button key={t} onClick={() => setSelType(t)}
                    className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-all
                      ${selType === t ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity */}
            <div className="card mb-4">
              <label className="text-sm font-medium text-gray-700 block mb-2">Tingkat</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(SEV_CONFIG) as [Severity, typeof SEV_CONFIG[Severity]][]).map(([s, cfg]) => (
                  <button key={s} onClick={() => setSelSev(s)}
                    className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all
                      ${selSev === s ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white'}`}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Deskripsi */}
            <div className="card mb-4">
              <label className="text-sm font-medium text-gray-700 block mb-2">Keterangan *</label>
              <textarea rows={4} placeholder="Tulis apa yang terjadi..." value={desc}
                onChange={e => setDesc(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-gray-900 outline-none text-base resize-none" />
            </div>

            <button onClick={handleSubmit}
              disabled={submitting || !desc.trim()}
              className="w-full py-5 text-xl font-bold bg-gray-900 text-white rounded-2xl disabled:opacity-40 active:bg-gray-700">
              {submitting
                ? <span className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                : '📤 KIRIM LAPORAN'}
            </button>
          </>
        )}
      </div>
    )
  }

  // ── View: History ─────────────────────────────────────────
  if (view === 'history') {
    return (
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setView('main')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-lg">←</button>
          <h1 className="text-xl font-bold">Riwayat Insiden</h1>
        </div>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : complaints.length === 0 ? (
          <div className="text-center py-16 text-gray-400">Belum ada insiden</div>
        ) : (
          <div className="space-y-2">
            {complaints.map(c => (
              <div key={c.id} className={`card ${c.status === 'resolved' ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{TYPE_LABEL[c.type]}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEV_CONFIG[c.severity].color}`}>
                        {SEV_CONFIG[c.severity].label}
                      </span>
                      {c.status === 'resolved' && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Selesai</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{c.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {c.reporter?.name ?? 'Staff'} · {new Date(c.created_at).toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </p>
                  </div>
                  {isOwnerOrSup && c.status === 'open' && (
                    <button onClick={() => handleResolve(c.id)}
                      className="flex-shrink-0 text-xs bg-green-600 text-white px-2.5 py-1.5 rounded-lg font-medium">
                      Selesai
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── View: Pilih tenant dulu (owner/supervisor tanpa home tenant tetap) ──
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

  // ── View: Main (Om Tommy) ─────────────────────────────────
  return (
    <div className="max-w-md mx-auto px-4 py-6">
      {!session?.selectedTenantId && <TenantPicker tenants={tenants} selected={selectedTenant} onSelect={id => { setLoading(true); setSelectedTenant(id) }} />}
      <h1 className="text-2xl font-bold mb-2 mt-4">Laporan Insiden</h1>
      <p className="text-sm text-gray-500 mb-6">Tap tombol untuk laporkan kejadian</p>

      {/* 3 tombol besar untuk Om Tommy */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {QUICK_BUTTONS.map(btn => (
          <button key={btn.type} onClick={() => openQuick(btn)}
            className={`flex flex-col items-center justify-center border-2 rounded-2xl py-5 gap-2 active:scale-95 transition-transform ${btn.color}`}>
            <span className="text-4xl">{btn.icon}</span>
            <span className="text-sm font-bold text-center leading-tight whitespace-pre-line">{btn.label}</span>
          </button>
        ))}
      </div>

      {/* Lainnya */}
      <button onClick={() => { setSelType('other'); setSelSev('medium'); setDesc(''); setView('form') }}
        className="w-full py-4 border-2 border-gray-200 rounded-2xl text-base font-semibold text-gray-700 bg-white mb-6 active:bg-gray-50">
        ✏️ Lainnya — Tulis Manual
      </button>

      {/* Alert insiden terbuka */}
      {openComplaints.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
          <p className="font-bold text-red-800 text-sm mb-1">⚠️ {openComplaints.length} Insiden Belum Selesai</p>
          {openComplaints.slice(0, 2).map(c => (
            <p key={c.id} className="text-xs text-red-700 truncate">• {c.description}</p>
          ))}
        </div>
      )}

      <button onClick={() => setView('history')}
        className="w-full py-3 text-sm text-gray-500 hover:text-gray-700">
        Lihat Riwayat ({complaints.length}) →
      </button>
    </div>
  )
}
