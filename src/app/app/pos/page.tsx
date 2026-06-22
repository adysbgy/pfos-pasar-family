'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatRupiah } from '@/types'
import TenantPicker from '@/components/TenantPicker'
import type { MenuItem, Category, SessionPayload, OrderChannel } from '@/types'

interface Tenant { id: string; name: string; color: string }

// ============================================================
// Halaman POS — Input Order
// Role: kasir (utama), owner, supervisor
// ============================================================

interface CartItem {
  menuItem: MenuItem
  quantity: number
}

type View = 'menu' | 'cart' | 'payment'
type PaymentMethod = 'cash' | 'qris'

const CHANNELS: { value: OrderChannel; label: string; icon: string }[] = [
  { value: 'dine_in',  label: 'Di Sini', icon: '🪑' },
  { value: 'takeaway', label: 'Bawa',    icon: '🛍️' },
  { value: 'gofood',   label: 'GoFood',  icon: '🟢' },
  { value: 'whatsapp', label: 'WA',      icon: '💬' },
]

export default function POSPage() {
  const [session, setSession]               = useState<SessionPayload | null>(null)
  const [tenants, setTenants]               = useState<Tenant[]>([])
  const [selectedTenant, setSelectedTenant] = useState('')
  const [categories, setCategories]         = useState<Category[]>([])
  const [menuItems, setMenuItems]           = useState<MenuItem[]>([])
  const [loading, setLoading]               = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [cart, setCart]                     = useState<CartItem[]>([])
  const [channel, setChannel]               = useState<OrderChannel>('dine_in')
  const [tableNumber, setTableNumber]       = useState<string>('')
  const [view, setView]                     = useState<View>('menu')
  const [paymentMethod, setPaymentMethod]   = useState<PaymentMethod>('cash')
  const [cashInput, setCashInput]           = useState('')
  const [voucherInput, setVoucherInput]     = useState('')
  const [voucher, setVoucher]               = useState<{ code: string; discount: number } | null>(null)
  const [voucherError, setVoucherError]     = useState('')
  const [voucherChecking, setVoucherChecking] = useState(false)
  const [submitting, setSubmitting]         = useState(false)
  const [successOrder, setSuccessOrder]     = useState<{ number: string; change: number } | null>(null)

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
    loadMenu(selectedTenant)
  }, [selectedTenant])

  async function loadMenu(tenantId: string) {
    setLoading(true)
    const res = await fetch(`/api/menu?tenantId=${tenantId}`)
    const data = await res.json()
    setCategories(data.categories ?? [])
    setMenuItems(data.menuItems ?? [])
    setLoading(false)
  }

  const cartTotal = cart.reduce((s, c) => s + c.menuItem.price * c.quantity, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)
  const payableTotal = Math.max(0, cartTotal - (voucher?.discount ?? 0))
  const cashReceived = parseInt(cashInput.replace(/\D/g, '')) || 0
  const change = Math.max(0, cashReceived - payableTotal)

  async function applyVoucher() {
    if (!voucherInput.trim() || !selectedTenant) return
    setVoucherChecking(true)
    setVoucherError('')
    try {
      const res = await fetch('/api/vouchers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: voucherInput.trim(), tenantId: selectedTenant, subtotal: cartTotal }),
      })
      const data = await res.json()
      if (data.valid) {
        setVoucher({ code: data.code, discount: data.discount })
        setVoucherInput('')
      } else {
        setVoucherError(data.error ?? 'Voucher tidak valid')
      }
    } catch { setVoucherError('Koneksi bermasalah.') }
    finally { setVoucherChecking(false) }
  }

  const addToCart = useCallback((item: MenuItem) => {
    setCart(prev => {
      const ex = prev.find(c => c.menuItem.id === item.id)
      if (ex) return prev.map(c => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { menuItem: item, quantity: 1 }]
    })
  }, [])

  const decreaseQty = useCallback((itemId: string) => {
    setCart(prev => prev.map(c => c.menuItem.id === itemId ? { ...c, quantity: c.quantity - 1 } : c).filter(c => c.quantity > 0))
  }, [])

  const getQty = useCallback((itemId: string) => cart.find(c => c.menuItem.id === itemId)?.quantity ?? 0, [cart])

  const filteredMenu = activeCategory === 'all' ? menuItems : menuItems.filter(m => m.category_id === activeCategory)

  async function handleSubmit() {
    if (!selectedTenant || cart.length === 0) return
    if (paymentMethod === 'cash' && cashReceived < payableTotal) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedTenant,
          channel,
          items: cart.map(c => ({ menuItemId: c.menuItem.id, quantity: c.quantity, unitPrice: c.menuItem.price })),
          paymentMethod,
          tableNumber: channel === 'dine_in' ? tableNumber : undefined,
          voucherCode: voucher?.code,
          amountReceived: paymentMethod === 'cash' ? cashReceived : payableTotal,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccessOrder({ number: data.orderNumber, change: data.changeGiven })
        setCart([])
        setCashInput('')
        setVoucher(null)
        setView('menu')
      } else {
        alert('Gagal: ' + (data.error ?? 'Error'))
      }
    } catch { alert('Koneksi bermasalah.') }
    finally { setSubmitting(false) }
  }

  // ── Success ──────────────────────────────────────────────
  if (successOrder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold">Order Masuk!</h2>
        <div className="mt-4 bg-gray-900 text-white px-8 py-4 rounded-2xl">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Nomor Order</p>
          <p className="text-3xl font-bold tracking-wider">{successOrder.number}</p>
        </div>
        {successOrder.change > 0 && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-2xl px-6 py-3 w-full max-w-xs">
            <p className="text-sm text-green-700">Kembalian</p>
            <p className="text-2xl font-bold text-green-800">{formatRupiah(successOrder.change)}</p>
          </div>
        )}
        <button onClick={() => setSuccessOrder(null)} className="mt-8 btn-primary w-full max-w-xs">
          Order Berikutnya
        </button>
      </div>
    )
  }

  // ── Pilih tenant dulu (owner/supervisor tanpa home tenant tetap) ──
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

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── View: Payment ─────────────────────────────────────────
  if (view === 'payment') {
    return (
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('cart')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-lg">←</button>
          <h1 className="text-xl font-bold">Pembayaran</h1>
        </div>
        <div className="card mb-4 text-center">
          <p className="text-sm text-gray-500">Total Tagihan</p>
          {voucher ? (
            <>
              <p className="text-lg text-gray-400 line-through mt-1">{formatRupiah(cartTotal)}</p>
              <p className="text-4xl font-bold text-green-700">{formatRupiah(payableTotal)}</p>
            </>
          ) : (
            <p className="text-4xl font-bold mt-1">{formatRupiah(cartTotal)}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">{cartCount} item</p>
        </div>

        {/* Voucher */}
        <div className="card mb-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">Kode Voucher</label>
          {voucher ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <div>
                <p className="font-bold text-green-800">{voucher.code}</p>
                <p className="text-xs text-green-700">Hemat {formatRupiah(voucher.discount)}</p>
              </div>
              <button onClick={() => setVoucher(null)} className="text-sm text-red-500 font-medium">Hapus</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input type="text" value={voucherInput} onChange={e => setVoucherInput(e.target.value.toUpperCase())}
                placeholder="Masukkan kode" className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-gray-900 outline-none" />
              <button onClick={applyVoucher} disabled={voucherChecking || !voucherInput.trim()}
                className="bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40">
                {voucherChecking ? '...' : 'Pakai'}
              </button>
            </div>
          )}
          {voucherError && <p className="text-xs text-red-600 mt-2">{voucherError}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {(['cash','qris'] as PaymentMethod[]).map(m => (
            <button key={m} onClick={() => setPaymentMethod(m)}
              className={`py-4 rounded-2xl border-2 font-semibold text-lg transition-all
                ${paymentMethod === m ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700'}`}>
              {m === 'cash' ? '💵 Cash' : '📱 QRIS'}
            </button>
          ))}
        </div>
        {paymentMethod === 'cash' ? (
          <div className="card mb-4">
            <label className="text-sm font-medium text-gray-700 block mb-2">Uang Diterima</label>
            <input type="tel" inputMode="numeric" placeholder="0" value={cashInput}
              onChange={e => setCashInput(e.target.value)}
              className="w-full text-2xl font-bold border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-gray-900 outline-none" />
            {cashReceived >= payableTotal && cashReceived > 0 && (
              <div className="mt-3 flex justify-between bg-green-50 rounded-xl px-4 py-3">
                <span className="text-sm text-green-700">Kembalian</span>
                <span className="font-bold text-green-800">{formatRupiah(change)}</span>
              </div>
            )}
            {cashReceived > 0 && cashReceived < payableTotal && (
              <div className="mt-3 flex justify-between bg-red-50 rounded-xl px-4 py-3">
                <span className="text-sm text-red-700">Kurang</span>
                <span className="font-bold text-red-800">{formatRupiah(payableTotal - cashReceived)}</span>
              </div>
            )}
            <div className="grid grid-cols-4 gap-2 mt-3">
              {[5000,10000,20000,50000].map(v => (
                <button key={v} onClick={() => setCashInput(String(Math.ceil(payableTotal/v)*v))}
                  className="text-xs py-2 bg-gray-100 rounded-lg font-medium active:bg-gray-200">
                  {Math.ceil(payableTotal/v)*v/1000}K
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="card mb-4 text-center bg-blue-50 border-blue-100">
            <p className="text-4xl mb-2">📱</p>
            <p className="font-semibold text-blue-900">Arahkan ke stiker QRIS</p>
            <p className="text-sm text-blue-700 mt-1">Notif masuk via GoPay Merchant</p>
          </div>
        )}
        <button onClick={handleSubmit} disabled={submitting || (paymentMethod==='cash' && cashReceived<payableTotal)} className="btn-primary w-full text-lg py-4">
          {submitting ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> : `✓ Konfirmasi ${formatRupiah(payableTotal)}`}
        </button>
      </div>
    )
  }

  // ── View: Cart ────────────────────────────────────────────
  if (view === 'cart') {
    return (
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setView('menu')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-lg">←</button>
          <h1 className="text-xl font-bold">Keranjang</h1>
          {cart.length > 0 && <button onClick={() => setCart([])} className="ml-auto text-sm text-red-500">Hapus Semua</button>}
        </div>
        {cart.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🛒</p><p>Keranjang kosong</p>
            <button onClick={() => setView('menu')} className="mt-4 text-sm text-gray-900 underline">Pilih Menu</button>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {cart.map(c => (
                <div key={c.menuItem.id} className="card flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.menuItem.name}</p>
                    <p className="text-sm text-gray-500">{formatRupiah(c.menuItem.price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => decreaseQty(c.menuItem.id)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold">−</button>
                    <span className="w-5 text-center font-bold">{c.quantity}</span>
                    <button onClick={() => addToCart(c.menuItem)} className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold">+</button>
                  </div>
                  <p className="text-sm font-semibold w-20 text-right">{formatRupiah(c.menuItem.price * c.quantity)}</p>
                </div>
              ))}
            </div>
            <div className="card bg-gray-900 text-white mb-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Total</span>
                <span className="text-2xl font-bold">{formatRupiah(cartTotal)}</span>
              </div>
            </div>
            <button onClick={() => setView('payment')} className="btn-primary w-full text-lg py-4">Bayar →</button>
          </>
        )}
      </div>
    )
  }

  // ── View: Menu ────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 7.5rem)' }}>
      {!session?.selectedTenantId && <TenantPicker tenants={tenants} selected={selectedTenant} onSelect={id => { setLoading(true); setSelectedTenant(id) }} />}
      {/* Channel */}
      <div className="bg-white px-4 py-2 border-b border-gray-100 flex gap-2 overflow-x-auto">
        {CHANNELS.map(ch => (
          <button key={ch.value} onClick={() => setChannel(ch.value)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${channel===ch.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {ch.icon} {ch.label}
          </button>
        ))}
      </div>
      {/* Nomor Meja — hanya untuk dine_in */}
      {channel === 'dine_in' && (
        <div className="bg-white px-4 py-2 border-b border-gray-100 flex items-center gap-2">
          <span className="text-sm text-gray-500 flex-shrink-0">Meja:</span>
          <div className="flex gap-1.5 overflow-x-auto">
            {['1','2','3','4','5','6','7','8'].map(n => (
              <button key={n} onClick={() => setTableNumber(tableNumber === n ? '' : n)}
                className={`flex-shrink-0 w-9 h-9 rounded-lg text-sm font-bold border-2 transition-all
                  ${tableNumber === n ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-700'}`}>
                {n}
              </button>
            ))}
            <input type="tel" inputMode="numeric" placeholder="?" value={tableNumber}
              onChange={e => setTableNumber(e.target.value.replace(/\D/g,''))}
              className="flex-shrink-0 w-12 h-9 border-2 border-gray-200 rounded-lg text-center text-sm font-bold focus:border-gray-900 outline-none" />
          </div>
        </div>
      )}

      {/* Kategori */}
      <div className="bg-white px-4 py-2 border-b border-gray-100 flex gap-2 overflow-x-auto">
        <button onClick={() => setActiveCategory('all')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
            ${activeCategory==='all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
          Semua
        </button>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${activeCategory===cat.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {cat.name}
          </button>
        ))}
      </div>
      {/* Menu grid */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="grid grid-cols-2 gap-3">
          {filteredMenu.map(item => {
            const qty = getQty(item.id)
            return (
              <button key={item.id} onClick={() => addToCart(item)}
                className={`text-left p-3 rounded-2xl border-2 transition-all active:scale-95
                  ${qty>0 ? 'border-gray-900 bg-gray-50' : 'border-gray-100 bg-white'}`}>
                <p className="font-semibold text-sm leading-tight line-clamp-2">{item.name}</p>
                <p className="text-sm font-bold mt-1">{formatRupiah(item.price)}</p>
                {qty>0 && (
                  <div className="mt-1.5 flex justify-between">
                    <span className="text-xs text-gray-500">×{qty}</span>
                    <span className="text-xs font-semibold">{formatRupiah(item.price*qty)}</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
      {/* Cart bar */}
      {cart.length > 0 && (
        <div className="bg-white border-t border-gray-100 px-4 py-3">
          <button onClick={() => setView('cart')}
            className="w-full bg-gray-900 text-white rounded-2xl px-4 py-3.5 flex items-center justify-between active:bg-gray-700">
            <span className="bg-white/20 text-sm font-bold px-2.5 py-0.5 rounded-full">{cartCount}</span>
            <span className="font-semibold">Lihat Keranjang</span>
            <span className="font-bold">{formatRupiah(cartTotal)}</span>
          </button>
        </div>
      )}
    </div>
  )
}
