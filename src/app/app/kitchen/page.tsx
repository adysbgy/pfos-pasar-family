'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SessionPayload } from '@/types'

// ============================================================
// Kitchen Display System (KDS)
// Role: kitchen, supervisor, owner
// Realtime: subscribe ke kitchen_queue + orders
// ============================================================

interface QueueItem {
  id: string
  order_id: string
  status: 'waiting' | 'cooking' | 'qa_pending' | 'done'
  started_at: string | null
  done_at: string | null
  order: {
    order_number: string
    channel: string
    notes: string | null
    created_at: string
    order_items: {
      quantity: number
      menu_item: { name: string }
    }[]
  }
}

function elapsedMinutes(since: string): number {
  return Math.floor((Date.now() - new Date(since).getTime()) / 60000)
}

function channelIcon(channel: string): string {
  const m: Record<string, string> = {
    dine_in: '🪑', takeaway: '🛍️', gofood: '🟢', whatsapp: '💬', grabfood: '🟡', shopeefood: '🟠'
  }
  return m[channel] ?? '📦'
}

export default function KitchenPage() {
  const supabase = createClient()
  const [session, setSession] = useState<SessionPayload | null>(null)
  const [queue, setQueue]     = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow]         = useState(Date.now())

  // Tick setiap menit untuk update timer
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => setSession(d.session))
  }, [])

  useEffect(() => {
    if (!session?.selectedTenantId) return
    loadQueue(session.selectedTenantId)
    // Realtime subscription
    const channel = supabase
      .channel('kitchen-queue')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'kitchen_queue',
        filter: `tenant_id=eq.${session.selectedTenantId}`
      }, () => loadQueue(session.selectedTenantId!))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session])

  async function loadQueue(tenantId: string) {
    const { data } = await supabase
      .from('kitchen_queue')
      .select(`
        id, order_id, status, started_at, done_at,
        order:orders(
          order_number, channel, notes, created_at,
          order_items(quantity, menu_item:menu_items(name))
        )
      `)
      .eq('tenant_id', tenantId)
      .in('status', ['waiting', 'cooking', 'qa_pending'])
      .order('done_at', { ascending: true, nullsFirst: true })

    setQueue((data as unknown as QueueItem[]) ?? [])
    setLoading(false)
  }

  async function updateStatus(queueId: string, orderId: string, newStatus: QueueItem['status']) {
    const updates: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'cooking') updates.started_at = new Date().toISOString()
    if (newStatus === 'qa_pending') updates.done_at = new Date().toISOString()

    await supabase.from('kitchen_queue').update(updates).eq('id', queueId)

    // Sync status order
    const orderStatus =
      newStatus === 'cooking'    ? 'cooking'    :
      newStatus === 'qa_pending' ? 'qa_pending' :
      newStatus === 'done'       ? 'ready'      : 'pending'
    await supabase.from('orders').update({ status: orderStatus }).eq('id', orderId)
  }

  const waiting  = queue.filter(q => q.status === 'waiting')
  const cooking  = queue.filter(q => q.status === 'cooking')
  const qaReady  = queue.filter(q => q.status === 'qa_pending')

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  function QueueCard({ item, actions }: { item: QueueItem; actions: React.ReactNode }) {
    const elapsed = item.started_at ? Math.floor((now - new Date(item.started_at).getTime()) / 60000) : null
    const waitElapsed = Math.floor((now - new Date(item.order.created_at).getTime()) / 60000)
    const isUrgent = (elapsed ?? waitElapsed) >= 15

    return (
      <div className={`card mb-3 ${isUrgent ? 'border-red-300 bg-red-50' : ''}`}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <span className="text-lg font-bold text-gray-900">{item.order.order_number}</span>
            <span className="ml-2 text-lg">{channelIcon(item.order.channel)}</span>
          </div>
          <span className={`text-sm font-medium ${isUrgent ? 'text-red-600' : 'text-gray-500'}`}>
            {elapsed !== null ? `⏱ ${elapsed} mnt` : `⏳ ${waitElapsed} mnt`}
          </span>
        </div>
        <div className="space-y-0.5 mb-3">
          {item.order.order_items?.map((oi, i) => (
            <p key={i} className="text-sm text-gray-700">
              <span className="font-semibold">×{oi.quantity}</span> {oi.menu_item?.name}
            </p>
          ))}
          {item.order.notes && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1 mt-1">
              📝 {item.order.notes}
            </p>
          )}
        </div>
        {actions}
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-4">
      {/* Header realtime indicator */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 bg-green-500 rounded-full pulse-dot" />
        <span className="text-sm text-gray-500">Live · {queue.length} order aktif</span>
      </div>

      {queue.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-3">✨</p>
          <p className="font-medium">Tidak ada order masuk</p>
          <p className="text-sm mt-1">Dapur aman!</p>
        </div>
      )}

      {/* Menunggu */}
      {waiting.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
            ⏳ Menunggu ({waiting.length})
          </h2>
          {waiting.map(item => (
            <QueueCard key={item.id} item={item} actions={
              <button onClick={() => updateStatus(item.id, item.order_id, 'cooking')}
                className="w-full bg-amber-500 text-white font-bold py-3 rounded-xl active:bg-amber-600 text-sm">
                🍳 Mulai Masak
              </button>
            } />
          ))}
        </div>
      )}

      {/* Sedang masak */}
      {cooking.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
            🍳 Sedang Masak ({cooking.length})
          </h2>
          {cooking.map(item => (
            <QueueCard key={item.id} item={item} actions={
              <button onClick={() => updateStatus(item.id, item.order_id, 'qa_pending')}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl active:bg-green-700 text-sm">
                ✅ Selesai → QA
              </button>
            } />
          ))}
        </div>
      )}

      {/* Menunggu QA */}
      {qaReady.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
            🔍 Menunggu QA ({qaReady.length})
          </h2>
          {qaReady.map(item => (
            <QueueCard key={item.id} item={item} actions={
              <div className="bg-blue-50 rounded-xl px-3 py-2 text-center text-sm text-blue-700 font-medium">
                Menunggu pemeriksaan QA...
              </div>
            } />
          ))}
        </div>
      )}
    </div>
  )
}
