'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatRupiah } from '@/types'
import type { SessionPayload } from '@/types'

// ============================================================
// Halaman Manajemen Resep / BOM
// Role: owner, supervisor
// Fungsi: link menu item → inventory items + qty per porsi
//         Saat order masuk, stok otomatis berkurang
// ============================================================

interface Tenant { id: string; name: string; color: string }

interface InventoryItem { id: string; name: string; unit: string; category: string }

interface Recipe {
  id: string
  qty_per_portion: number
  unit: string
  notes: string | null
  inventory_item: InventoryItem
}

interface MenuItemWithRecipes {
  id: string
  name: string
  price: number
  category: { name: string } | null
  recipes: Recipe[]
  cogs: number
  margin: number
}

export default function RecipesPage() {
  const [session, setSession]           = useState<SessionPayload | null>(null)
  const [tenants, setTenants]           = useState<Tenant[]>([])
  const [selectedTenant, setSelTen]     = useState('')
  const [menuItems, setMenuItems]       = useState<MenuItemWithRecipes[]>([])
  const [invItems, setInvItems]         = useState<InventoryItem[]>([])
  const [loading, setLoading]           = useState(false)
  const [selectedMenu, setSelMenu]      = useState<MenuItemWithRecipes | null>(null)
  const [view, setView]                 = useState<'list' | 'detail' | 'add'>('list')
  const [submitting, setSubmitting]     = useState(false)

  // Add resep form
  const [fInvId, setFInvId]   = useState('')
  const [fQty, setFQty]       = useState('')
  const [fNotes, setFNotes]   = useState('')

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => {
      setSession(d.session)
      if (d.session?.selectedTenantId) setSelTen(d.session.selectedTenantId)
    })
    fetch('/api/tenants').then(r => r.json()).then(d => setTenants(d.tenants ?? []))
  }, [])

  const loadMenu = useCallback(async (tenantId: string): Promise<MenuItemWithRecipes[]> => {
    setLoading(true)
    const res = await fetch(`/api/recipes?tenantId=${tenantId}`)
    const data = await res.json()
    const list: MenuItemWithRecipes[] = data.menuItems ?? []
    setMenuItems(list)
    setLoading(false)
    return list
  }, [])

  const loadInventory = useCallback(async (tenantId: string) => {
    const res = await fetch(`/api/inventory?tenantId=${tenantId}`)
    const data = await res.json()
    setInvItems(data.items ?? [])
  }, [])

  useEffect(() => {
    if (selectedTenant) { loadMenu(selectedTenant); loadInventory(selectedTenant) }
  }, [selectedTenant, loadMenu, loadInventory])

  function openDetail(item: MenuItemWithRecipes) {
    setSelMenu(item)
    setView('detail')
  }

  function openAdd() {
    setFInvId(''); setFQty(''); setFNotes('')
    setView('add')
  }

  async function handleAddRecipe() {
    if (!selectedMenu || !fInvId || !fQty) return
    const invItem = invItems.find(i => i.id === fInvId)
    setSubmitting(true)
    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuItemId: selectedMenu.id,
          inventoryItemId: fInvId,
          qtyPerPortion: parseFloat(fQty),
          unit: invItem?.unit ?? '',
          notes: fNotes || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        const list = await loadMenu(selectedTenant)
        setSelMenu(list.find(m => m.id === selectedMenu.id) ?? null)
        setView('detail')
      } else alert(data.error ?? 'Gagal')
    } catch { alert('Koneksi bermasalah.') }
    finally { setSubmitting(false) }
  }

  async function handleDeleteRecipe(recipeId: string) {
    if (!confirm('Hapus bahan ini dari resep?')) return
    await fetch(`/api/recipes?id=${recipeId}`, { method: 'DELETE' })
    const list = await loadMenu(selectedTenant)
    setSelMenu(prev => list.find(m => m.id === prev?.id) ?? null)
  }

  const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)

  // ── View: Tambah Bahan ────────────────────────────────────
  if (view === 'add' && selectedMenu) {
    const usedIds = new Set(selectedMenu.recipes.map(r => r.inventory_item.id))
    const available = invItems.filter(i => !usedIds.has(i.id))
    const selInv = invItems.find(i => i.id === fInvId)

    return (
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('detail')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold leading-tight">Tambah Bahan</h1>
            <p className="text-xs text-gray-500">{selectedMenu.name}</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="card">
            <label className="text-sm font-medium text-gray-700 block mb-2">Pilih Bahan *</label>
            {available.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">Semua item inventory sudah ditambahkan</p>
            ) : (
              <select value={fInvId} onChange={e => setFInvId(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-gray-900 outline-none bg-white">
                <option value="">— Pilih bahan —</option>
                {available.map(i => (
                  <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                ))}
              </select>
            )}
          </div>

          <div className="card">
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Qty per Porsi{selInv ? ` (${selInv.unit})` : ''} *
            </label>
            <input type="tel" inputMode="decimal" placeholder="0" value={fQty}
              onChange={e => setFQty(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-2xl font-bold focus:border-gray-900 outline-none" />
            <p className="text-xs text-gray-400 mt-1">Contoh: 200 (gr), 2 (butir), 0.5 (liter)</p>
          </div>

          <div className="card">
            <label className="text-sm font-medium text-gray-700 block mb-2">Catatan (opsional)</label>
            <input type="text" placeholder="Contoh: diukur sebelum dimasak" value={fNotes}
              onChange={e => setFNotes(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-gray-900 outline-none text-sm" />
          </div>

          <button onClick={handleAddRecipe}
            disabled={submitting || !fInvId || !fQty}
            className="btn-primary w-full py-4 text-lg disabled:opacity-40">
            {submitting
              ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
              : '+ Tambah ke Resep'}
          </button>
        </div>
      </div>
    )
  }

  // ── View: Detail Resep ────────────────────────────────────
  if (view === 'detail' && selectedMenu) {
    return (
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setView('list')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-lg">←</button>
          <div className="flex-1">
            <h1 className="text-lg font-bold leading-tight">{selectedMenu.name}</h1>
            <p className="text-xs text-gray-400">
              {selectedMenu.category?.name ?? '—'} · Rp {fmt(selectedMenu.price)}
            </p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-1 bg-gray-900 text-white text-sm font-medium px-3 py-2 rounded-xl">
            + Bahan
          </button>
        </div>

        {selectedMenu.recipes.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm">Belum ada resep untuk menu ini</p>
            <p className="text-xs mt-1">Stok tidak akan otomatis berkurang saat order masuk</p>
            <button onClick={openAdd} className="mt-4 text-sm text-gray-900 underline">+ Tambah Bahan</button>
          </div>
        ) : (
          <>
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 mb-4 text-sm text-green-800">
              ✅ {selectedMenu.recipes.length} bahan — stok otomatis berkurang setiap order masuk
            </div>
            <div className="card mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Margin Profit</p>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Harga Jual</span>
                <span className="font-semibold">{formatRupiah(selectedMenu.price)}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Biaya Bahan (COGS)</span>
                <span className="font-semibold text-red-600">-{formatRupiah(selectedMenu.cogs)}</span>
              </div>
              <div className="flex justify-between pt-2 mt-1 border-t border-gray-100">
                <span className="font-bold">Margin</span>
                <span className={`font-bold ${selectedMenu.margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {formatRupiah(selectedMenu.margin)} ({selectedMenu.price > 0 ? Math.round(selectedMenu.margin / selectedMenu.price * 100) : 0}%)
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {selectedMenu.recipes.map(r => (
                <div key={r.id} className="card flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{r.inventory_item.name}</p>
                    <p className="text-sm text-gray-500">
                      {r.qty_per_portion} {r.unit} per porsi
                    </p>
                    {r.notes && <p className="text-xs text-gray-400 mt-0.5">{r.notes}</p>}
                  </div>
                  <button onClick={() => handleDeleteRecipe(r.id)}
                    className="w-9 h-9 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // ── View: List Menu ───────────────────────────────────────
  return (
    <div className="max-w-md mx-auto">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold mb-3">Resep & BOM</h1>
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
        <p className="text-xs text-gray-400">Tap menu untuk set resep. Stok otomatis berkurang saat order masuk.</p>
      </div>

      <div className="px-4 pb-4 mt-2 space-y-2">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : menuItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🍽️</p>
            <p>Tidak ada menu aktif</p>
          </div>
        ) : menuItems.map(item => {
          const hasRecipe = item.recipes.length > 0
          return (
            <button key={item.id} onClick={() => openDetail(item)}
              className="card w-full text-left flex items-center gap-3 active:bg-gray-50">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{item.name}</p>
                {hasRecipe ? (
                  <>
                    <p className="text-xs text-green-700 mt-0.5 truncate">
                      ✅ {item.recipes.length} bahan: {item.recipes.map(r => `${r.inventory_item.name} ${r.qty_per_portion}${r.unit}`).join(', ')}
                    </p>
                    {item.cogs > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Margin: <span className={item.margin >= 0 ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
                          {formatRupiah(item.margin)} ({item.price > 0 ? Math.round(item.margin / item.price * 100) : 0}%)
                        </span>
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">⚪ Belum ada resep</p>
                )}
              </div>
              <span className="text-gray-300 text-lg">›</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
