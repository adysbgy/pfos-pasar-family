// POST   /api/push/subscribe — simpan subscription Web Push
// DELETE /api/push/subscribe — hapus subscription (unsubscribe)
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/session'


export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { endpoint, keys } = body as { endpoint?: string; keys?: { p256dh: string; auth: string } }

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'endpoint, keys wajib' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: session.userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }, { onConflict: 'endpoint' })

  if (error) {
    console.error('[/api/push/subscribe] error:', error)
    return NextResponse.json({ error: 'Gagal simpan subscription' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')
  if (!endpoint) return NextResponse.json({ error: 'endpoint wajib' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
