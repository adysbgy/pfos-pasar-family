'use client'

import { useState, useEffect } from 'react'

// Banner untuk aktifkan Web Push — alert kritis (komplain berat, stok habis) masuk
// walau app tidak dibuka. Ditaruh di Dashboard (Owner).

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(rawData.split('').map(c => c.charCodeAt(0)))
}

export default function PushNotificationToggle() {
  const [supported, setSupported] = useState(false)
  const [status, setStatus] = useState<'idle' | 'subscribed' | 'denied' | 'loading'>('idle')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setSupported(true)
    if (Notification.permission === 'denied') setStatus('denied')
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      if (sub) setStatus('subscribed')
    })
  }, [])

  async function handleEnable() {
    setStatus('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setStatus('denied'); return }

      const reg = await navigator.serviceWorker.register('/sw.js')
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      setStatus('subscribed')
    } catch (err) {
      console.error('Push subscribe error:', err)
      setStatus('idle')
    }
  }

  if (!supported || status === 'subscribed') return null

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-blue-900">🔔 Aktifkan Notifikasi</p>
        <p className="text-xs text-blue-700 mt-0.5">
          {status === 'denied' ? 'Notifikasi diblokir — aktifkan dari setting browser' : 'Tahu langsung kalau ada insiden/stok habis'}
        </p>
      </div>
      {status !== 'denied' && (
        <button onClick={handleEnable} disabled={status === 'loading'}
          className="flex-shrink-0 bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-xl active:bg-blue-700 disabled:opacity-50">
          {status === 'loading' ? '...' : 'Aktifkan'}
        </button>
      )}
    </div>
  )
}
