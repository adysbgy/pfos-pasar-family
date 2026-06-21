'use client'

import { useState, useEffect } from 'react'
import { formatRupiah } from '@/types'
import TenantPicker from '@/components/TenantPicker'
import type { SessionPayload, CashSession } from '@/types'

interface Tenant { id: string; name: string; color: string }

export default function CashPage() {
  const [session, setSession]         = useState<SessionPayload | null>(null)
  const [tenants, setTenants]         = useState<Tenant[]>([])
  const [selectedTenant, setSelectedTenant] = useState('')
  const [cashSession, setCashSession] = useState<CashSession | null>(null)
  const [loading, setLoading]         = useState(true)
  const [openingCash, setOpeningCash] = useState('')
  const [expenseAmt, setExpenseAmt]   = useState('')
  const [expenseDesc, setExpenseDesc] = useState('')
  const [expenses, setExpenses]       = useState<{ id: string; amount: number; description: string; created_at: string }[]>([])
  const [submitting, setSubmitting]   = useState(false)

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
    loadSession(selectedTenant)
  }, [selectedTenant])

  async function loadSession(tenantId: string) {
    const res = await fetch(`/api/cash?tenantId=${tenantId}`)
    const data = await res.json()
    setCashSession(data.cashSession)
    setExpenses(data.expenses ?? [])
    setLoading(false)
  }

  async function openSession() {
    if (!selectedTenant) return
    setSubmitting(true)
    const res = await fetch('/api/cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'open', tenantId: selectedTenant, userId: session?.userId,
        openingCash: parseInt(openingCash) || 0,
      }),
    })
    const data = await res.json()
    setCashSession(data.cashSession)
    setSubmitting(false)
  }

  async function addExpense() {
    if (!cashSession || !expenseAmt || !expenseDesc) return
    setSubmitting(true)
    const res = await fetch('/api/cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'expense', sessionId: cashSession.id,
        amount: parseInt(expenseAmt), description: expenseDesc, userId: session?.userId,
      }),
    })
    const data = await res.json()
    setExpenses(prev => [data.expense, ...prev])
    setExpenseAmt('')
    setExpenseDesc('')
    setSubmitting(false)
  }

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const expectedCash  = (cashSession?.opening_cash ?? 0) + (cashSession?.cash_sales ?? 0) - totalExpenses

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

  // Belum buka sesi
  if (!cashSession) {
    return (
      <div className="max-w-md mx-auto px-4 py-6">
        {!session?.selectedTenantId && <TenantPicker tenants={tenants} selected={selectedTenant} onSelect={id => { setLoading(true); setSelectedTenant(id) }} />}
        <h1 className="text-xl font-bold mb-1">Buka Sesi Kas</h1>
        <p className="text-sm text-gray-500 mb-6">Hitung modal awal sebelum mulai berjualan</p>
        <div className="card mb-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">Modal Awal (uang receh)</label>
          <input type="tel" inputMode="numeric" value={openingCash} onChange={e => setOpeningCash(e.target.value)}
            placeholder="0" className="w-full text-2xl font-bold border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-gray-900 outline-none" />
          <p className="text-xs text-gray-400 mt-2">Jumlah uang tunai yang ada di laci kasir sekarang</p>
        </div>
        <button onClick={openSession} disabled={submitting}
          className="btn-primary w-full py-4 text-lg">
          {submitting ? '...' : '💵 Buka Sesi Hari Ini'}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-4">
      {!session?.selectedTenantId && <TenantPicker tenants={tenants} selected={selectedTenant} onSelect={id => { setLoading(true); setSelectedTenant(id) }} />}
      <h1 className="text-xl font-bold mb-4">Sesi Kas Hari Ini</h1>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card text-center">
          <p className="text-xs text-gray-500">Modal Awal</p>
          <p className="text-lg font-bold">{formatRupiah(cashSession.opening_cash)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500">Penjualan Cash</p>
          <p className="text-lg font-bold text-green-700">{formatRupiah(cashSession.cash_sales)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500">Total Keluar</p>
          <p className="text-lg font-bold text-red-600">{formatRupiah(totalExpenses)}</p>
        </div>
        <div className="card text-center bg-gray-900 text-white">
          <p className="text-xs text-gray-400">Ekspektasi Laci</p>
          <p className="text-lg font-bold">{formatRupiah(expectedCash)}</p>
        </div>
      </div>

      {/* Tambah pengeluaran */}
      <div className="card mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Catat Pengeluaran</p>
        <input type="text" value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)}
          placeholder="Keterangan (misal: beli plastik)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-2 focus:border-gray-900 outline-none" />
        <div className="flex gap-2">
          <input type="tel" inputMode="numeric" value={expenseAmt} onChange={e => setExpenseAmt(e.target.value)}
            placeholder="Jumlah" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-gray-900 outline-none" />
          <button onClick={addExpense} disabled={submitting || !expenseAmt || !expenseDesc}
            className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40">
            Catat
          </button>
        </div>
      </div>

      {/* Riwayat pengeluaran */}
      {expenses.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Riwayat Pengeluaran</p>
          <div className="space-y-2">
            {expenses.map(e => (
              <div key={e.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
                <p className="text-sm text-gray-700">{e.description}</p>
                <p className="text-sm font-semibold text-red-600">-{formatRupiah(e.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <p className="text-xs text-blue-700">💡 Closing kas dilakukan di halaman <strong>Closing Report</strong> saat akhir shift</p>
      </div>
    </div>
  )
}
