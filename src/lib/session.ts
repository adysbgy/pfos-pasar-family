// Utilitas untuk membaca dan menulis session cookie
// Session disimpan sebagai JSON dalam cookie httpOnly

import { cookies } from 'next/headers'
import type { SessionPayload } from '@/types'

const COOKIE_NAME = 'pfos_session'
const MAX_AGE = 60 * 60 * 8 // 8 jam

/**
 * Simpan session ke cookie (dipanggil dari API route setelah PIN berhasil)
 */
export function setSession(payload: SessionPayload) {
  const cookieStore = cookies()
  cookieStore.set(COOKIE_NAME, JSON.stringify(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: MAX_AGE,
    path: '/',
  })
}

/**
 * Baca session dari cookie (Server Component / API route)
 */
export function getSession(): SessionPayload | null {
  const cookieStore = cookies()
  const raw = cookieStore.get(COOKIE_NAME)?.value
  if (!raw) return null

  try {
    return JSON.parse(raw) as SessionPayload
  } catch {
    return null
  }
}

/**
 * Hapus session (logout)
 */
export function clearSession() {
  const cookieStore = cookies()
  cookieStore.delete(COOKIE_NAME)
}

/**
 * Cek apakah session masih valid (belum expired 8 jam)
 */
export function isSessionValid(session: SessionPayload): boolean {
  const now = Date.now()
  const ageMs = now - session.loginAt
  return ageMs < MAX_AGE * 1000
}
