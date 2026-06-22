'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { SessionPayload } from '@/types'

// ============================================================
// Ganti PIN — self-service, staff bisa ganti PIN sendiri
// ============================================================

export default function ChangePinPage() {
  const router = useRouter()
  const [session, setSession] = useState<SessionPayload | null>(null)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin]         = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess]       = useState(false)

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => setSession(d.session))
  }, [])

  const newPinValid = /^\d{4,6}$/.test(newPin)
  const canSubmit = currentPin.length >= 4 && newPinValid && newPin === confirmPin

  async function handleSubmit() {
    setError('')
    if (!newPinValid) { setError('PIN baru harus 4-6 digit angka'); return }
    if (newPin !== confirmPin) { setError('Konfirmasi PIN tidak cocok'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(true)
      } else {
        setError(data.error ?? 'Gagal ganti PIN')
      }
    } catch { setError('Koneksi bermasalah.') }
    finally { setSubmitting(false) }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold">PIN Berhasil Diganti!</h2>
        <p className="text-gray-500 mt-2">Gunakan PIN baru untuk login berikutnya.</p>
        <button onClick={() => router.back()} className="mt-8 btn-primary w-full max-w-xs">
          Kembali
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-lg">←</button>
        <div>
          <h1 className="text-xl font-bold">Ganti PIN</h1>
          {session && <p className="text-sm text-gray-500">{session.name}</p>}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="card mb-4">
        <label className="text-sm font-medium text-gray-700 block mb-2">PIN Saat Ini</label>
        <input type="password" inputMode="numeric" maxLength={6} value={currentPin}
          onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
          placeholder="••••" className="w-full text-2xl font-bold tracking-widest border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-gray-900 outline-none" />
      </div>

      <div className="card mb-4">
        <label className="text-sm font-medium text-gray-700 block mb-2">PIN Baru (4-6 digit)</label>
        <input type="password" inputMode="numeric" maxLength={6} value={newPin}
          onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
          placeholder="••••" className="w-full text-2xl font-bold tracking-widest border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-gray-900 outline-none" />
      </div>

      <div className="card mb-6">
        <label className="text-sm font-medium text-gray-700 block mb-2">Ulangi PIN Baru</label>
        <input type="password" inputMode="numeric" maxLength={6} value={confirmPin}
          onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
          placeholder="••••" className="w-full text-2xl font-bold tracking-widest border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-gray-900 outline-none" />
        {confirmPin && newPin !== confirmPin && (
          <p className="text-xs text-red-600 mt-2">Tidak cocok dengan PIN baru</p>
        )}
      </div>

      <button onClick={handleSubmit} disabled={submitting || !canSubmit}
        className="btn-primary w-full text-lg py-4 disabled:opacity-40">
        {submitting ? '...' : '🔒 Simpan PIN Baru'}
      </button>
    </div>
  )
}
