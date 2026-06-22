// Helper kirim Web Push — dipanggil dari API routes saat ada alert kritis
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

let configured = false
function ensureConfigured() {
  if (configured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  configured = true
}

// Kirim push ke semua user dengan role tertentu (default: owner)
export async function sendPushToRole(title: string, body: string, url = '/app/dashboard', roleNames: string[] = ['owner']) {
  ensureConfigured()
  const supabase = createAdminClient()

  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('user_id, role:roles(name)')

  const userIds = Array.from(new Set((userRoles ?? [])
    .filter((ur: any) => roleNames.includes(ur.role?.name))
    .map((ur: any) => ur.user_id)))

  if (userIds.length === 0) return

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)

  const payload = JSON.stringify({ title, body, url })

  await Promise.all((subs ?? []).map(async (sub) => {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, payload)
    } catch (err: any) {
      // Subscription expired/invalid — hapus dari DB
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        console.error('[push] gagal kirim:', err?.message)
      }
    }
  }))
}
