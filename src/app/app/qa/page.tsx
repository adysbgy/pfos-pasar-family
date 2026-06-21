'use client'

import { useState, useEffect } from 'react'
import TenantPicker from '@/components/TenantPicker'
import type { SessionPayload } from '@/types'

interface Tenant { id: string; name: string; color: string }

// ============================================================
// QA Gate — Pemeriksaan kualitas sebelum hidangan ke pelanggan
// Role: qa_checker, supervisor, owner
// ============================================================

interface QAOrder {
  id: string
  queueId: string
  order_number: string
  order_items: { quantity: number; menu_item: { name: string } }[]
  notes: string | null
}

const CHECKS = [
  { key: 'piring_bersih',     label: 'Piring/wadah bersih',      icon: '🍽️' },
  { key: 'sendok_bersih',     label: 'Sendok/alat makan bersih', icon: '🥄' },
  { key: 'no_foreign_object', label: 'Tidak ada benda asing',    icon: '🔍' },
  { key: 'menu_sesuai',       label: 'Menu sesuai pesanan',      icon: '📋' },
  { key: 'topping_lengkap',   label: 'Topping/pelengkap lengkap',icon: '✨' },
  { key: 'tampilan_ok',       label: 'Tampilan layak saji',      icon: '👁️' },
] as const

type CheckKey = typeof CHECKS[number]['key']

export default function QAPage() {
  const [session, setSession]       = useState<SessionPayload | null>(null)
  const [tenants, setTenants]       = useState<Tenant[]>([])
  const [selectedTenant, setSelectedTenant] = useState('')
  const [pendingOrders, setPending] = useState<QAOrder[]>([])
  const [loading, setLoading]       = useState(true)
  const [active, setActive]         = useState<QAOrder | null>(null)
  const [checks, setChecks]         = useState<Partial<Record<CheckKey, boolean>>>({})
  const [notes, setNotes]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [doneCount, setDoneCount]   = useState(0)

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
    loadPending(selectedTenant)
    // Polling tiap 5 detik (RLS blokir Supabase Realtime untuk session PIN-based)
    const t = setInterval(() => loadPending(selectedTenant), 5000)
    return () => clearInterval(t)
  }, [selectedTenant])

  async function loadPending(tenantId: string) {
    const res = await fetch(`/api/qa?tenantId=${tenantId}`)
    const data = await res.json()
    setPending(data.orders ?? [])
    setLoading(false)
  }

  const allChecked = CHECKS.every(c => checks[c.key] !== undefined)
  const allPass    = CHECKS.every(c => checks[c.key] === true)

  async function submitQA(result: 'pass' | 'fail') {
    if (!active || !session) return
    setSubmitting(true)
    await fetch('/api/qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: active.id, queueId: active.queueId, orderNumber: active.order_number,
        checks: Object.fromEntries(CHECKS.map(c => [c.key, checks[c.key] ?? null])),
        notes: notes || null, result,
      }),
    })
    setDoneCount(n => n + 1)
    setActive(null)
    loadPending(selectedTenant)
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

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (active) {
    return (
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setActive(null)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100">←</button>
          <h1 className="text-xl font-bold">{active.order_number}</h1>
        </div>
        <div className="card mb-4 bg-gray-50">
          {active.order_items?.map((oi, i) => (
            <p key={i} className="text-sm text-gray-700"><span className="font-semibold">×{oi.quantity}</span> {oi.menu_item?.name}</p>
          ))}
          {active.notes && <p className="text-xs text-amber-700 mt-2 bg-amber-50 rounded-lg px-2 py-1">📝 {active.notes}</p>}
        </div>
        <div className="space-y-2 mb-5">
          {CHECKS.map(c => (
            <div key={c.key} className={`card flex items-center gap-3 ${checks[c.key] === true ? 'bg-green-50 border-green-200' : checks[c.key] === false ? 'bg-red-50 border-red-200' : ''}`}>
              <span className="text-2xl">{c.icon}</span>
              <p className="flex-1 font-medium text-sm">{c.label}</p>
              <button onClick={() => setChecks(p => ({ ...p, [c.key]: true }))}
                className={`w-10 h-10 rounded-xl font-bold text-lg ${checks[c.key] === true ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>✓</button>
              <button onClick={() => setChecks(p => ({ ...p, [c.key]: false }))}
                className={`w-10 h-10 rounded-xl font-bold text-lg ${checks[c.key] === false ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'}`}>✗</button>
            </div>
          ))}
        </div>
        {!allPass && allChecked && (
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Catatan masalah (wajib jika ada yang gagal)..."
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm mb-4 focus:border-gray-900 outline-none resize-none" />
        )}
        {allChecked && (allPass ? (
          <button onClick={() => submitQA('pass')} disabled={submitting}
            className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-50">
            {submitting ? '...' : '✅ LULUS — Siap Disajikan'}
          </button>
        ) : (
          <button onClick={() => submitQA('fail')} disabled={submitting || !notes.trim()}
            className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-50">
            {submitting ? '...' : '❌ GAGAL — Batalkan Order'}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div>
      {!session?.selectedTenantId && <TenantPicker tenants={tenants} selected={selectedTenant} onSelect={id => { setLoading(true); setSelectedTenant(id) }} />}
      <div className="max-w-md mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">QA Gate</h1>
        {doneCount > 0 && <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-sm font-medium">✅ {doneCount} selesai</span>}
      </div>
      {pendingOrders.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-3">🔍</p>
          <p className="font-medium">Tidak ada order menunggu QA</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingOrders.map(order => (
            <div key={order.id} className="card">
              <p className="text-lg font-bold mb-2">{order.order_number}</p>
              <div className="mb-3">
                {order.order_items?.map((oi, i) => (
                  <p key={i} className="text-sm text-gray-700">×{oi.quantity} {oi.menu_item?.name}</p>
                ))}
              </div>
              <button onClick={() => { setActive(order); setChecks({}); setNotes('') }}
                className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl text-sm">
                🔍 Mulai Periksa
              </button>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
