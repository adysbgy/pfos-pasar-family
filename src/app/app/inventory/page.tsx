'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SessionPayload } from '@/types'

// ============================================================
// Halaman Inventory & Stok
// Role: owner, supervisor (full), kasir (bisa adjust usage/waste)
// ============================================================

type TxType = 'purchase' | 'usage' | 'waste' | 'adjustment'

interface InventoryItem {
  id: string
  name: string
  unit: string
  category: string
  min_stock: number
  sort_order: number
  stock: { current_qty: number; last_updated: string } | null
}

interface InventoryTransaction {
  id: string
  type: TxType
  qty_change: number
  qty_before: number
  qty_after: number
  notes: string | null
  created_at: string
}

const CATEGORY_LABEL: Record<string, string> = {
  bahan: 'Bahan',
  packaging: 'Packaging',
  peralatan: 'Peralatan',
  lainnya: 'Lainnya',
}

const TX_TYPE_CONFIG: Record<TxType, { label: string; icon: string; sign: string; color: string }> = {
  purchase:   { label: 'Beli/Terima',   icon: '📦', sign: '+', color: 'text-green-700 bg-green-50 border-green-200' },
  usage:      { label: 'Dipakai',        icon: '🍳', sign: '−', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  waste:      { label: 'Terbuang',       icon: '🗑️', sign: '−', color: 'text-red-700 bg-red-50 border-red-200' },
  adjustment: { label: 'Koreksi Manual', icon: '✏️', sign: '±', color: 'text-gray-700 bg-gray-50 border-gray-200' },
}

export default function InventoryPage() {
  const [session, setSession]           = useState<SessionPayload | null>(null)
  const [items, setItems]               = useState<InventoryItem[]>([])
  const [loading, setLoading]           = useState(true)
  const [activeCategory, setCategory]   = useState<string>('all')
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [txHistory, setTxHistory]       = useState<InventoryTransaction[]>([])
  const [histLoading, setHistLoading]   = useState(false)
  const [view, setView]                 = useState<'list' | 'adjust' | 'history' | 'add_item'>('list')

  // Adjust form
  const [txType, setTxType]     = useState<TxType>('purchase')
  const [qtyInput, setQtyInput] = useState('')
  const [notes, setNotes]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  // Add item form
  const [newName, setNewName]         = useState('')
  const [newUnit, setNewUnit]         = useState('pcs')
  const [newCategory, setNewCategory] = useState('bahan')
  const [newMinStock, setNewMinStock] = useState('5')
  const [newInitQty, setNewInitQty]   = useState('0')

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => setSession(d.session))
  }, [])

  useEffect(() => {
    if (session?.selectedTenantId) loadItems()
  }, [session])

  async function loadItems() {
    if (!session?.selectedTenantId) return
    setLoading(true)
    const res = await fetch(`/api/inventory?tenantId=${session.selectedTenantId}`)
    const data = await res.json()
    setItems(data.items ?? [])
    setLoading(false)
  }

  async function loadHistory(itemId: string) {
    setHistLoading(true)
    const res = await fetch(`/api/inventory/history?itemId=${itemId}`)
    const data = await res.json()
    setTxHistory(data.transactions ?? [])
    setHistLoading(false)
  }

  function openAdjust(item: InventoryItem) {
    setSelectedItem(item)
    setTxType('purchase')
    setQtyInput('')
    setNotes('')
    setSuccessMsg('')
    setView('adjust')
  }

  function openHistory(item: InventoryItem) {
    setSelectedItem(item)
    setTxHistory([])
    setView('history')
    loadHistory(item.id)
  }

  async function handleAdjust() {
    if (!selectedItem || !qtyInput) return
    const qty = parseInt(qtyInput)
    if (isNaN(qty) || qty <= 0) return

    const isOut = txType === 'usage' || txType === 'waste'
    const actualQtyChange = isOut ? -qty : qty

    setSubmitting(true)
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          type: txType,
          qtyChange: actualQtyChange,
          notes: notes || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccessMsg(`✅ Stok ${selectedItem.name}: ${data.result.qty_before} → ${data.result.qty_after} ${selectedItem.unit}`)
        setQtyInput('')
        setNotes('')
        loadItems() // refresh list
      } else {
        alert('Error: ' + (data.error ?? 'Gagal'))
      }
    } catch { alert('Koneksi bermasalah.') }
    finally { setSubmitting(false) }
  }

  async function handleAddItem() {
    if (!newName.trim() || !session?.selectedTenantId) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_item',
          tenantId: session.selectedTenantId,
          name: newName.trim(),
          unit: newUnit,
          category: newCategory,
          minStock: parseInt(newMinStock) || 5,
          initialQty: parseInt(newInitQty) || 0,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setNewName(''); setNewUnit('pcs'); setNewCategory('bahan')
        setNewMinStock('5'); setNewInitQty('0')
        loadItems()
        setView('list')
      } else {
        alert('Error: ' + (data.error ?? 'Gagal'))
      }
    } catch { alert('Koneksi bermasalah.') }
    finally { setSubmitting(false) }
  }

  const categories = Array.from(new Set(items.map(i => i.category))).sort()

  const filteredItems = activeCategory === 'all'
    ? items
    : items.filter(i => i.category === activeCategory)

  const isOwnerOrSup = session?.primaryRole === 'owner' || session?.primaryRole === 'supervisor'

  function getStockColor(item: InventoryItem) {
    const qty = item.stock?.current_qty ?? 0
    if (qty === 0) return 'text-red-600 bg-red-50'
    if (qty <= item.min_stock) return 'text-yellow-700 bg-yellow-50'
    return 'text-green-700 bg-green-50'
  }

  // ── View: Adjust ─────────────────────────────────────────
  if (view === 'adjust' && selectedItem) {
    return (
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setView('list'); setSuccessMsg('') }}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold leading-tight">{selectedItem.name}</h1>
            <p className="text-sm text-gray-500">
              Stok saat ini: <span className="font-semibold text-gray-800">{selectedItem.stock?.current_qty ?? 0} {selectedItem.unit}</span>
            </p>
          </div>
        </div>

        {successMsg && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
            {successMsg}
          </div>
        )}

        {/* Tipe transaksi */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {(Object.entries(TX_TYPE_CONFIG) as [TxType, typeof TX_TYPE_CONFIG[TxType]][]).map(([type, cfg]) => (
            <button key={type} onClick={() => setTxType(type)}
              className={`py-3 px-3 rounded-xl border-2 text-left transition-all
                ${txType === type ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white'}`}>
              <span className="text-lg">{cfg.icon}</span>
              <p className="text-xs font-semibold mt-0.5 leading-tight">{cfg.label}</p>
            </button>
          ))}
        </div>

        {/* Jumlah */}
        <div className="card mb-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Jumlah ({selectedItem.unit})
          </label>
          <input type="tel" inputMode="numeric" placeholder="0" value={qtyInput}
            onChange={e => setQtyInput(e.target.value.replace(/\D/g, ''))}
            className="w-full text-3xl font-bold border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-gray-900 outline-none" />
          <div className="grid grid-cols-4 gap-2 mt-2">
            {[1,5,10,25].map(v => (
              <button key={v} onClick={() => setQtyInput(String(v))}
                className="py-2 bg-gray-100 rounded-lg text-sm font-medium active:bg-gray-200">
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Catatan */}
        <div className="card mb-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">Catatan (opsional)</label>
          <input type="text" placeholder="Contoh: Beli dari supplier X" value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-gray-900 outline-none text-sm" />
        </div>

        <button onClick={handleAdjust}
          disabled={submitting || !qtyInput || parseInt(qtyInput) <= 0}
          className="btn-primary w-full text-lg py-4 disabled:opacity-40">
          {submitting
            ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
            : `${TX_TYPE_CONFIG[txType].sign} Simpan Perubahan`}
        </button>

        <button onClick={() => openHistory(selectedItem)} className="w-full mt-3 py-3 text-sm text-gray-500 hover:text-gray-700">
          Lihat Riwayat Stok →
        </button>
      </div>
    )
  }

  // ── View: History ─────────────────────────────────────────
  if (view === 'history' && selectedItem) {
    return (
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('list')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold leading-tight">{selectedItem.name}</h1>
            <p className="text-xs text-gray-500">Riwayat Transaksi</p>
          </div>
        </div>
        {histLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : txHistory.length === 0 ? (
          <div className="text-center py-16 text-gray-400">Belum ada transaksi</div>
        ) : (
          <div className="space-y-2">
            {txHistory.map(tx => {
              const cfg = TX_TYPE_CONFIG[tx.type as TxType]
              const isIn = tx.qty_change > 0
              return (
                <div key={tx.id} className="card">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{cfg?.icon ?? '📄'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm">{cfg?.label ?? tx.type}</p>
                        <p className={`text-sm font-bold ${isIn ? 'text-green-700' : 'text-red-600'}`}>
                          {isIn ? '+' : ''}{tx.qty_change} {selectedItem.unit}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {tx.qty_before} → {tx.qty_after} {selectedItem.unit}
                      </p>
                      {tx.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{tx.notes}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(tx.created_at).toLocaleDateString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── View: Tambah Item ─────────────────────────────────────
  if (view === 'add_item') {
    return (
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('list')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-lg">←</button>
          <h1 className="text-xl font-bold">Tambah Item Baru</h1>
        </div>
        <div className="space-y-4">
          <div className="card">
            <label className="text-sm font-medium text-gray-700 block mb-2">Nama Item *</label>
            <input type="text" placeholder="Contoh: Mie Kuning" value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-gray-900 outline-none" />
          </div>
          <div className="card">
            <label className="text-sm font-medium text-gray-700 block mb-2">Satuan *</label>
            <select value={newUnit} onChange={e => setNewUnit(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-gray-900 outline-none bg-white">
              {['pcs','kg','gr','liter','ml','dus','bungkus','porsi','lembar','butir','pasang'].map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="card">
            <label className="text-sm font-medium text-gray-700 block mb-2">Kategori</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <button key={k} onClick={() => setNewCategory(k)}
                  className={`py-2 rounded-xl border-2 text-sm font-medium transition-all
                    ${newCategory === k ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="card">
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Min Stok</label>
              <input type="tel" inputMode="numeric" value={newMinStock}
                onChange={e => setNewMinStock(e.target.value.replace(/\D/g,''))}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-lg font-bold focus:border-gray-900 outline-none" />
            </div>
            <div className="card">
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Stok Awal</label>
              <input type="tel" inputMode="numeric" value={newInitQty}
                onChange={e => setNewInitQty(e.target.value.replace(/\D/g,''))}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-lg font-bold focus:border-gray-900 outline-none" />
            </div>
          </div>
          <button onClick={handleAddItem}
            disabled={submitting || !newName.trim()}
            className="btn-primary w-full py-4 text-lg disabled:opacity-40">
            {submitting
              ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
              : '+ Tambah Item'}
          </button>
        </div>
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

  const lowStockCount = items.filter(i => (i.stock?.current_qty ?? 0) <= i.min_stock).length

  return (
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Inventory & Stok</h1>
          {lowStockCount > 0 && (
            <p className="text-xs text-red-600 font-medium mt-0.5">
              ⚠️ {lowStockCount} item {lowStockCount === 1 ? 'perlu' : 'perlu'} restock
            </p>
          )}
        </div>
        {isOwnerOrSup && (
          <button onClick={() => setView('add_item')}
            className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-3 py-2 rounded-xl active:bg-gray-700">
            <span className="text-base">+</span> Item
          </button>
        )}
      </div>

      {/* Kategori filter */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto">
        <button onClick={() => setCategory('all')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
            ${activeCategory === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
          Semua ({items.length})
        </button>
        {categories.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${activeCategory === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {CATEGORY_LABEL[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Item list */}
      <div className="px-4 pb-4 space-y-2">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📦</p>
            <p>Belum ada item</p>
            {isOwnerOrSup && (
              <button onClick={() => setView('add_item')} className="mt-4 text-sm text-gray-900 underline">
                + Tambah Item
              </button>
            )}
          </div>
        ) : filteredItems.map(item => {
          const qty = item.stock?.current_qty ?? 0
          const stockColorClass = getStockColor(item)
          const isLow = qty <= item.min_stock
          return (
            <div key={item.id} className={`card ${isLow ? 'border-l-4 border-l-yellow-400' : ''} ${qty === 0 ? 'border-l-red-500' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{item.name}</p>
                    {qty === 0 && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">HABIS</span>}
                    {qty > 0 && isLow && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">LOW</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{CATEGORY_LABEL[item.category] ?? item.category}</p>
                </div>
                {/* Qty badge */}
                <div className={`px-3 py-1.5 rounded-xl font-bold text-sm min-w-[60px] text-center ${stockColorClass}`}>
                  {qty} <span className="font-normal text-xs">{item.unit}</span>
                </div>
                {/* Action buttons */}
                <div className="flex gap-1.5">
                  <button onClick={() => openHistory(item)}
                    className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg text-base active:bg-gray-200"
                    title="Riwayat">
                    📋
                  </button>
                  <button onClick={() => openAdjust(item)}
                    className="w-9 h-9 flex items-center justify-center bg-gray-900 text-white rounded-lg text-base active:bg-gray-700"
                    title="Adjust stok">
                    ✏️
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Min: {item.min_stock} {item.unit}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
