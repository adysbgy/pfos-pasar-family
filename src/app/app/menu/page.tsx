'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatRupiah } from '@/types'
import type { SessionPayload } from '@/types'

// ============================================================
// Halaman Manajemen Menu
// Role: owner, supervisor
// ============================================================

interface Category {
  id: string
  name: string
  sort_order: number
}

interface MenuItem {
  id: string
  tenant_id: string
  name: string
  price: number
  status: 'active' | 'inactive'
  sort_order: number
  description?: string
  category_id?: string
  category?: Category
}

interface Tenant {
  id: string
  name: string
  slug: string
  color: string
}

export default function MenuManagePage() {
  const [session, setSession]       = useState<SessionPayload | null>(null)
  const [tenants, setTenants]       = useState<Tenant[]>([])
  const [selectedTenant, setSelTen] = useState<string>('')
  const [categories, setCategories] = useState<Category[]>([])
  const [menuItems, setMenuItems]   = useState<MenuItem[]>([])
  const [loading, setLoading]       = useState(false)
  const [activeCategory, setActCat] = useState<string>('all')
  const [view, setView]             = useState<'list' | 'add' | 'edit'>('list')
  const [editItem, setEditItem]     = useState<MenuItem | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [fName, setFName]       = useState('')
  const [fPrice, setFPrice]     = useState('')
  const [fCatId, setFCatId]     = useState('')
  const [fDesc, setFDesc]       = useState('')
  const [fStatus, setFStatus]   = useState<'active' | 'inactive'>('active')

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => {
      setSession(d.session)
      if (d.session?.selectedTenantId) setSelTen(d.session.selectedTenantId)
    })
    fetch('/api/tenants').then(r => r.json()).then(d => setTenants(d.tenants ?? []))
  }, [])

  const loadMenu = useCallback(async (tenantId: string) => {
    if (!tenantId) return
    setLoading(true)
    const res = await fetch(`/api/menu?tenantId=${tenantId}&showAll=true`)
    const data = await res.json()
    setMenuItems(data.menuItems ?? [])
    setCategories(data.categories ?? [])
    setActCat('all')
    setLoading(false)
  }, [])

  useEffect(() => { if (selectedTenant) loadMenu(selectedTenant) }, [selectedTenant, loadMenu])

  function openAdd() {
    setFName(''); setFPrice(''); setFCatId(''); setFDesc(''); setFStatus('active')
    setEditItem(null)
    setView('add')
  }

  function openEdit(item: MenuItem) {
    setFName(item.name)
    setFPrice(String(item.price))
    setFCatId(item.category_id ?? '')
    setFDesc(item.description ?? '')
    setFStatus(item.status)
    setEditItem(item)
    setView('edit')
  }

  async function handleSave() {
    if (!fName.trim() || !fPrice) return
    setSubmitting(true)
    try {
      if (view === 'add') {
        const res = await fetch('/api/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: selectedTenant,
            name: fName.trim(),
            price: parseInt(fPrice.replace(/\D/g, '')),
            categoryId: fCatId || null,
            description: fDesc || null,
          }),
        })
        const data = await res.json()
        if (!data.success) { alert(data.error ?? 'Gagal'); return }
      } else if (editItem) {
        const res = await fetch('/api/menu', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editItem.id,
            name: fName.trim(),
            price: parseInt(fPrice.replace(/\D/g, '')),
            category_id: fCatId || null,
            description: fDesc || null,
            status: fStatus,
          }),
        })
        const data = await res.json()
        if (!data.success) { alert(data.error ?? 'Gagal'); return }
      }
      loadMenu(selectedTenant)
      setView('list')
    } catch { alert('Koneksi bermasalah.') }
    finally { setSubmitting(false) }
  }

  async function handleToggle(item: MenuItem) {
    const newStatus = item.status === 'active' ? 'inactive' : 'active'
    await fetch('/api/menu', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, status: newStatus }),
    })
    setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, status: newStatus } : m))
  }

  async function handleDelete(item: MenuItem) {
    if (!confirm(`Hapus "${item.name}"? Data order lama tidak terpengaruh.`)) return
    await fetch(`/api/menu?id=${item.id}`, { method: 'DELETE' })
    setMenuItems(prev => prev.filter(m => m.id !== item.id))
  }

  const filtered = activeCategory === 'all'
    ? menuItems
    : menuItems.filter(m => m.category_id === activeCategory)

  const activeCount   = menuItems.filter(m => m.status === 'active').length
  const inactiveCount = menuItems.filter(m => m.status === 'inactive').length

  // ── Form: Tambah / Edit ───────────────────────────────────
  if (view === 'add' || view === 'edit') {
    const title = view === 'add' ? 'Tambah Menu' : 'Edit Menu'
    return (
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('list')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-lg">←</button>
          <h1 className="text-xl font-bold">{title}</h1>
        </div>
        <div className="space-y-4">
          <div className="card">
            <label className="text-sm font-medium text-gray-700 block mb-2">Nama Menu *</label>
            <input type="text" placeholder="Contoh: Mie Goreng Special" value={fName}
              onChange={e => setFName(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-gray-900 outline-none text-base" />
          </div>

          <div className="card">
            <label className="text-sm font-medium text-gray-700 block mb-2">Harga (Rp) *</label>
            <input type="tel" inputMode="numeric" placeholder="0" value={fPrice}
              onChange={e => setFPrice(e.target.value.replace(/\D/g, ''))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-gray-900 outline-none text-2xl font-bold" />
            {fPrice && (
              <p className="text-sm text-gray-500 mt-1">{formatRupiah(parseInt(fPrice) || 0)}</p>
            )}
          </div>

          <div className="card">
            <label className="text-sm font-medium text-gray-700 block mb-2">Kategori</label>
            <select value={fCatId} onChange={e => setFCatId(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-gray-900 outline-none bg-white">
              <option value="">— Tanpa Kategori —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="card">
            <label className="text-sm font-medium text-gray-700 block mb-2">Deskripsi (opsional)</label>
            <input type="text" placeholder="Contoh: Pedas, tanpa bawang" value={fDesc}
              onChange={e => setFDesc(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-gray-900 outline-none text-sm" />
          </div>

          {view === 'edit' && (
            <div className="card">
              <label className="text-sm font-medium text-gray-700 block mb-2">Status</label>
              <div className="grid grid-cols-2 gap-2">
                {(['active', 'inactive'] as const).map(s => (
                  <button key={s} onClick={() => setFStatus(s)}
                    className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all
                      ${fStatus === s ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700'}`}>
                    {s === 'active' ? '✅ Aktif' : '⏸ Nonaktif'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={handleSave}
            disabled={submitting || !fName.trim() || !fPrice}
            className="btn-primary w-full py-4 text-lg disabled:opacity-40">
            {submitting
              ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
              : view === 'add' ? '+ Tambah Menu' : '✓ Simpan Perubahan'}
          </button>

          {view === 'edit' && session?.primaryRole === 'owner' && editItem && (
            <button onClick={() => handleDelete(editItem)}
              className="w-full py-3 text-sm text-red-500 hover:text-red-700">
              Hapus menu ini
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── View: List ────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">Manajemen Menu</h1>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-3 py-2 rounded-xl active:bg-gray-700">
            + Menu
          </button>
        </div>

        {/* Tenant selector */}
        {tenants.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-2">
            {tenants.map(t => (
              <button key={t.id} onClick={() => setSelTen(t.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                  ${selectedTenant === t.id ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
                style={selectedTenant === t.id ? { background: t.color } : {}}>
                {t.name}
              </button>
            ))}
          </div>
        )}

        {/* Stats */}
        {menuItems.length > 0 && (
          <div className="flex gap-3 text-xs text-gray-500 mb-2">
            <span className="text-green-700">✅ {activeCount} aktif</span>
            {inactiveCount > 0 && <span className="text-gray-400">⏸ {inactiveCount} nonaktif</span>}
          </div>
        )}
      </div>

      {/* Kategori filter */}
      {categories.length > 0 && (
        <div className="px-4 py-1 flex gap-2 overflow-x-auto mb-1">
          <button onClick={() => setActCat('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${activeCategory === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Semua
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setActCat(c.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                ${activeCategory === c.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="px-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🍽️</p>
            <p>Belum ada menu</p>
            <button onClick={openAdd} className="mt-4 text-sm text-gray-900 underline">+ Tambah Menu</button>
          </div>
        ) : (
          <div className="space-y-2 mt-2">
            {filtered.map(item => (
              <div key={item.id}
                className={`card flex items-center gap-3 transition-opacity ${item.status === 'inactive' ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0" onClick={() => openEdit(item)}>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{item.name}</p>
                    {item.status === 'inactive' && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded flex-shrink-0">Nonaktif</span>
                    )}
                  </div>
                  {item.category && (
                    <p className="text-xs text-gray-400">{item.category.name}</p>
                  )}
                  <p className="font-bold text-sm mt-0.5">{formatRupiah(item.price)}</p>
                </div>

                {/* Toggle aktif/nonaktif */}
                <button onClick={() => handleToggle(item)}
                  className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 relative
                    ${item.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                    ${item.status === 'active' ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>

                {/* Edit button */}
                <button onClick={() => openEdit(item)}
                  className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg text-base active:bg-gray-200">
                  ✏️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
