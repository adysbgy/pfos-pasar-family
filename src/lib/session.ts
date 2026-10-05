// Utilitas session cookie DENGAN TANDA TANGAN (HMAC-SHA256)
// Format token: <base64url(payload)>.<base64url(hmac)>
// Kompatibel Edge Runtime (middleware) & Node Runtime (API routes) — pakai Web Crypto.
import { cookies } from 'next/headers'
import type { SessionPayload } from '@/types'

const COOKIE_NAME = 'pfos_session'
const MAX_AGE = 60 * 60 * 8 // 8 jam

// --- base64url helpers ---
function toB64url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// Salin ke ArrayBuffer baru (hindari isu TS: Uint8Array<ArrayBufferLike> vs BufferSource)
function buf(bytes: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(ab).set(bytes)
  return ab
}

function enc(s: string): ArrayBuffer {
  return buf(new TextEncoder().encode(s))
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET tidak diset (butuh string acak ≥16 karakter)')
  }
  return crypto.subtle.importKey(
    'raw',
    enc(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** Buat token bertanda tangan dari payload sesi. */
export async function signSession(payload: SessionPayload): Promise<string> {
  const body = toB64url(new TextEncoder().encode(JSON.stringify(payload)))
  const key = await getKey()
  const sig = await crypto.subtle.sign('HMAC', key, enc(body))
  return `${body}.${toB64url(new Uint8Array(sig))}`
}

/** Verifikasi token + cek expiry. Kembalikan payload atau null. */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const [body, sig] = parts
    const key = await getKey()
    // crypto.subtle.verify = perbandingan konstan-waktu (aman timing attack)
    const ok = await crypto.subtle.verify('HMAC', key, buf(fromB64url(sig)), enc(body))
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionPayload
    if (typeof payload.loginAt !== 'number') return null
    if (Date.now() - payload.loginAt > MAX_AGE * 1000) return null // expired
    return payload
  } catch {
    return null
  }
}

/**
 * Simpan session ke cookie (dipanggil dari API route setelah PIN berhasil).
 * Sekarang async karena menandatangani payload.
 */
export async function setSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload)
  const cookieStore = cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: MAX_AGE,
    path: '/',
  })
}

/**
 * Baca + verifikasi session dari cookie (Server Component / API route).
 * Pakai ini, JANGAN JSON.parse cookie mentah.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const raw = cookies().get(COOKIE_NAME)?.value
  if (!raw) return null
  return verifySession(raw)
}

/**
 * Versi untuk middleware (NextRequest) — Edge-safe, tanpa next/headers.
 */
export async function getSessionFromRequest(request: {
  cookies: { get: (name: string) => { value: string } | undefined }
}): Promise<SessionPayload | null> {
  const raw = request.cookies.get(COOKIE_NAME)?.value
  if (!raw) return null
  return verifySession(raw)
}

/** Hapus session (logout). */
export function clearSession(): void {
  cookies().delete(COOKIE_NAME)
}

/** Cek apakah session masih valid (belum expired 8 jam). */
export function isSessionValid(session: SessionPayload): boolean {
  return Date.now() - session.loginAt < MAX_AGE * 1000
}
