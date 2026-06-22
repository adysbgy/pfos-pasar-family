// POST /api/orders — Buat order baru
// Flow: validasi → next_order_sequence → insert order → items → payment → kitchen_queue
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SessionPayload, OrderChannel, PaymentMethod } from '@/types'

interface OrderItem {
  menuItemId: string
  quantity: number
  unitPrice: number
  notes?: string
}

interface CreateOrderBody {
  tenantId: string
  channel: OrderChannel
  items: OrderItem[]
  paymentMethod: PaymentMethod
  amountReceived?: number   // untuk cash
  qrisReference?: string    // opsional dari GoPay
  customerName?: string
  tableNumber?: string      // Sprint 3: nomor meja untuk dine_in
  voucherCode?: string      // Sprint 4: kode voucher
  notes?: string
}

export async function POST(request: Request) {
  // Baca session
  const cookieStore = cookies()
  const raw = cookieStore.get('pfos_session')?.value
  if (!raw) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }
  const session = JSON.parse(raw) as SessionPayload

  try {
    const body = await request.json() as CreateOrderBody
    const { tenantId, channel, items, paymentMethod, amountReceived, qrisReference, customerName, tableNumber, voucherCode, notes } = body

    if (!tenantId || !channel || !items?.length || !paymentMethod) {
      return NextResponse.json({ error: 'Data order tidak lengkap' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Generate nomor order
    const today = new Date().toISOString().split('T')[0]
    const { data: seqData, error: seqError } = await supabase
      .rpc('next_order_sequence', { p_tenant_id: tenantId, p_date: today })

    if (seqError || !seqData) {
      console.error('next_order_sequence error:', seqError)
      return NextResponse.json({ error: 'Gagal generate nomor order' }, { status: 500 })
    }

    // Ambil prefix tenant
    const { data: tenant } = await supabase
      .from('tenants').select('slug').eq('id', tenantId).single()

    const PREFIXES: Record<string, string> = {
      'bagia-kopitiam': 'BG', 'tujuh-legenda': 'TL', hibiro: 'HB', 'ramen-family': 'RF', 'tjan-kopitiam': 'TJ'
    }
    const prefix = PREFIXES[tenant?.slug ?? ''] ?? 'XX'
    const dateStr = today.replace(/-/g, '')
    const seq = String(seqData).padStart(3, '0')
    const orderNumber = `${prefix}-${dateStr}-${seq}`

    // 2. Hitung total + validasi voucher (re-validasi server-side, jangan percaya nilai dari client)
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
    let discount = 0
    let voucher: { id: string; code: string; used_count: number } | null = null

    if (voucherCode) {
      const { data: v } = await supabase
        .from('vouchers')
        .select('*')
        .eq('code', voucherCode.trim().toUpperCase())
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .single()

      const now = new Date()
      const isValid = v
        && v.status === 'active'
        && (!v.valid_from || now >= new Date(v.valid_from))
        && (!v.valid_until || now <= new Date(v.valid_until))
        && (v.usage_limit === null || v.used_count < v.usage_limit)
        && subtotal >= v.min_purchase

      if (isValid) {
        discount = v.type === 'percent' ? Math.round(subtotal * v.value / 100) : v.value
        if (v.max_discount) discount = Math.min(discount, v.max_discount)
        discount = Math.min(discount, subtotal)
        voucher = v
      }
    }

    const total = subtotal - discount

    // 3. Insert order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        tenant_id: tenantId,
        order_number: orderNumber,
        channel,
        status: 'pending',
        payment_method: paymentMethod,
        payment_status: 'paid',
        subtotal,
        discount,
        total,
        customer_name: customerName,
        table_number: tableNumber || null,
        voucher_id: voucher?.id ?? null,
        voucher_code: voucher?.code ?? null,
        notes,
        kasir_id: session.userId,
      })
      .select('id')
      .single()

    if (orderError || !order) {
      console.error('insert order error:', orderError)
      return NextResponse.json({ error: 'Gagal membuat order' }, { status: 500 })
    }

    // 4. Insert order items
    const orderItems = items.map(item => ({
      order_id: order.id,
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      notes: item.notes,
    }))

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
    if (itemsError) {
      console.error('insert order_items error:', itemsError)
    }

    // 5. Insert payment
    const changeGiven = paymentMethod === 'cash' && amountReceived
      ? Math.max(0, (amountReceived ?? 0) - total)
      : 0

    await supabase.from('payments').insert({
      order_id: order.id,
      method: paymentMethod === 'platform' ? 'qris' : paymentMethod,
      amount_received: amountReceived ?? total,
      amount_expected: total,
      change_given: changeGiven,
      qris_reference: qrisReference,
      created_by: session.userId,
    })

    // 6. Update cash_session.cash_sales jika cash
    if (paymentMethod === 'cash') {
      const { data: cashSession } = await supabase
        .from('cash_sessions')
        .select('id, cash_sales')
        .eq('tenant_id', tenantId)
        .eq('date', today)
        .eq('status', 'open')
        .single()

      if (cashSession) {
        await supabase
          .from('cash_sessions')
          .update({ cash_sales: cashSession.cash_sales + total })
          .eq('id', cashSession.id)
      }
    }

    // 7. Insert kitchen_queue
    await supabase.from('kitchen_queue').insert({
      order_id: order.id,
      tenant_id: tenantId,
      status: 'waiting',
    })

    // 8. Update status order → cooking (langsung karena sudah masuk kitchen)
    await supabase
      .from('orders')
      .update({ status: 'cooking' })
      .eq('id', order.id)

    // 9. Activity log
    await supabase.from('activity_log').insert({
      user_id: session.userId,
      tenant_id: tenantId,
      action: 'order_input',
      reference_id: order.id,
    })

    // 10. Auto-deduct inventory berdasarkan resep (Sprint 3)
    supabase.rpc('deduct_inventory_for_order', { p_order_id: order.id })
      .then(({ error }) => { if (error) console.error('deduct_inventory error:', error) })

    // 11. Increment used_count voucher (Sprint 4)
    if (voucher) {
      supabase.from('vouchers').update({ used_count: voucher.used_count + 1 }).eq('id', voucher.id)
        .then(({ error }) => { if (error) console.error('voucher used_count error:', error) })
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber,
      total,
      changeGiven,
    })

  } catch (err) {
    console.error('POST /api/orders error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
