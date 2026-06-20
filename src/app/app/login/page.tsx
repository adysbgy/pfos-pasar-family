'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { LoginUser } from '@/types'

// ============================================================
// Halaman Login — Pilih nama + input PIN
// ============================================================

const PIN_LENGTH = 6

export default function LoginPage() {
  const router = useRouter()

  const [users, setUsers]               = useState<LoginUser[]>([])
  const [loading, setLoading]           = useState(true)
  const [selectedUser, setSelectedUser] = useState<LoginUser | null>(null)
  const [pin, setPin]                   = useState('')
  const [error, setError]               = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [shake, setShake]               = useState(false)

  // Ambil daftar staff dari API
  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(data => {
        setUsers(data.users ?? [])
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  // Handle klik angka di keypad
  const handleDigit = useCallback((digit: string) => {
    setError('')
    setPin(prev => {
      if (prev.length >= PIN_LENGTH) return prev
      return prev + digit
    })
  }, [])

  // Handle backspace
  const handleBackspace = useCallback(() => {
    setError('')
    setPin(prev => prev.slice(0, -1))
  }, [])

  // Reset state saat tutup modal PIN
  const handleClose = useCallback(() => {
    setSelectedUser(null)
    setPin('')
    setError('')
    setSubmitting(false)
  }, [])

  // Trigger shake animation
  const triggerShake = useCallback(() => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }, [])

  // Submit PIN
  const handleSubmit = useCallback(async () => {
    if (!selectedUser || pin.length < 4) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, pin }),
      })

      const data = await res.json()

      if (data.success && data.redirectTo) {
        // Login berhasil — arahkan ke halaman sesuai role
        router.push(data.redirectTo)
        router.refresh()
      } else {
        setError(data.error ?? 'PIN salah. Coba lagi.')
        setPin('')
        triggerShake()
        setSubmitting(false)
      }
    } catch {
      setError('Koneksi bermasalah. Cek internet dan coba lagi.')
      setPin('')
      triggerShake()
      setSubmitting(false)
    }
  }, [selectedUser, pin, router, triggerShake])

  // Auto-submit saat PIN sudah 6 digit
  useEffect(() => {
    if (pin.length === PIN_LENGTH && !submitting) {
      handleSubmit()
    }
  }, [pin, submitting, handleSubmit])

  // Label role Bahasa Indonesia
  function roleLabel(role: string): string {
    const map: Record<string, string> = {
      owner:           'Owner',
      supervisor:      'Supervisor',
      kasir:           'Kasir',
      kitchen:         'Dapur',
      qa_checker:      'QA',
      marketing_admin: 'Marketing',
      viewer:          'Viewer',
    }
    return map[role] ?? role
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="pt-safe bg-white border-b border-gray-100 px-4 py-5">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">PF</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">PFOS</h1>
              <p className="text-xs text-gray-500">Pasar Family Operating System</p>
            </div>
          </div>
        </div>
      </div>

      {/* Konten utama */}
      <div className="flex-1 max-w-md mx-auto w-full px-4 py-6">
        <p className="text-gray-500 text-sm mb-4 font-medium uppercase tracking-wide">
          Pilih nama kamu
        </p>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl h-24 animate-pulse border border-gray-100"
              />
            ))}
          </div>
        )}

        {/* Error load */}
        {!loading && users.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">⚠️</p>
            <p className="mt-2 text-sm">Gagal memuat daftar staff.</p>
            <button
              className="mt-4 text-sm text-blue-600 underline"
              onClick={() => {
                setLoading(true)
                fetch('/api/users')
                  .then(r => r.json())
                  .then(data => { setUsers(data.users ?? []); setLoading(false) })
                  .catch(() => setLoading(false))
              }}
            >
              Coba lagi
            </button>
          </div>
        )}

        {/* Grid nama staff */}
        {!loading && users.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {users.map(user => (
              <button
                key={user.id}
                onClick={() => {
                  setSelectedUser(user)
                  setPin('')
                  setError('')
                }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4
                           text-left active:scale-95 transition-transform duration-75
                           hover:border-gray-300"
              >
                {/* Strip warna tenant di atas */}
                <div
                  className="w-8 h-1.5 rounded-full mb-3"
                  style={{ backgroundColor: user.home_tenant?.color ?? '#9CA3AF' }}
                />
                <p className="font-semibold text-gray-900 text-base leading-tight">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {roleLabel(user.primary_role)}
                </p>
                {user.home_tenant && (
                  <p className="text-xs mt-0.5" style={{ color: user.home_tenant.color }}>
                    {user.home_tenant.name}
                  </p>
                )}
                {user.status === 'evaluation' && (
                  <span className="inline-block mt-2 text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-200">
                    Evaluasi
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Versi app */}
        <p className="text-center text-[11px] text-gray-300 mt-8">
          PFOS v0.1 · Pasar Family · {new Date().getFullYear()}
        </p>
      </div>

      {/* ============================================================
          Modal PIN Input
          ============================================================ */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Card PIN */}
          <div className="relative w-full max-w-xs mx-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl pb-safe">
            {/* Handle bar (mobile) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="px-6 pt-4 pb-6">
              {/* Tombol tutup */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center
                           text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                ✕
              </button>

              {/* Salam */}
              <div className="text-center mb-5">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: selectedUser.home_tenant?.color ?? '#6B7280' }}
                >
                  <span className="text-white font-bold text-xl">
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Halo, {selectedUser.name}!
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">Masukkan PIN kamu</p>
              </div>

              {/* Indikator PIN (titik-titik) */}
              <div className={`flex justify-center gap-3 mb-2 ${shake ? 'shake' : ''}`}>
                {[...Array(PIN_LENGTH)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                      i < pin.length
                        ? 'bg-gray-900 border-gray-900 scale-110'
                        : 'bg-transparent border-gray-300'
                    }`}
                  />
                ))}
              </div>

              {/* Pesan error */}
              <div className="h-6 flex items-center justify-center mb-4">
                {error && (
                  <p className="text-sm text-red-500 font-medium">{error}</p>
                )}
              </div>

              {/* Keypad angka */}
              <div className="grid grid-cols-3 gap-2">
                {['1','2','3','4','5','6','7','8','9'].map(digit => (
                  <button
                    key={digit}
                    onClick={() => handleDigit(digit)}
                    disabled={submitting}
                    className="h-14 rounded-xl bg-gray-50 border border-gray-200
                               text-xl font-semibold text-gray-800
                               active:bg-gray-200 active:scale-95
                               transition-all duration-75
                               disabled:opacity-40"
                  >
                    {digit}
                  </button>
                ))}

                {/* Baris bawah: backspace — 0 — submit */}
                <button
                  onClick={handleBackspace}
                  disabled={submitting || pin.length === 0}
                  className="h-14 rounded-xl bg-gray-50 border border-gray-200
                             text-xl font-medium text-gray-500
                             active:bg-gray-200 active:scale-95
                             transition-all duration-75
                             disabled:opacity-30"
                  aria-label="Hapus"
                >
                  ⌫
                </button>

                <button
                  onClick={() => handleDigit('0')}
                  disabled={submitting}
                  className="h-14 rounded-xl bg-gray-50 border border-gray-200
                             text-xl font-semibold text-gray-800
                             active:bg-gray-200 active:scale-95
                             transition-all duration-75
                             disabled:opacity-40"
                >
                  0
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={submitting || pin.length < 4}
                  className="h-14 rounded-xl bg-gray-900 border border-gray-900
                             text-xl font-medium text-white
                             active:bg-gray-700 active:scale-95
                             transition-all duration-75
                             disabled:opacity-30 flex items-center justify-center"
                  aria-label="Masuk"
                >
                  {submitting ? (
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    '→'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
