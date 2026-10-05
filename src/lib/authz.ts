import type { SessionPayload } from '@/types'

/**
 * Otorisasi tenant terpusat.
 *
 * Aturan:
 * - owner   → boleh semua tenant (dipakai laporan lintas-tenant).
 * - lainnya → HANYA tenant miliknya (homeTenantId) atau yang sedang dipilih (selectedTenantId).
 *
 * Pakai ini di setiap route yang menerima tenantId dari client,
 * JANGAN percaya tenantId mentah dari body/query.
 */
export function canAccessTenant(session: SessionPayload, tenantId: string): boolean {
  if (!tenantId) return false
  if (session.primaryRole === 'owner') return true
  return tenantId === session.homeTenantId || tenantId === session.selectedTenantId
}

/**
 * Daftar tenant yang boleh diakses. Untuk owner = null (artinya "semua").
 * Non-owner = tenant miliknya.
 */
export function allowedTenantIds(session: SessionPayload): string[] | null {
  if (session.primaryRole === 'owner') return null // semua
  return [session.homeTenantId, session.selectedTenantId].filter(
    (t): t is string => !!t,
  )
}
