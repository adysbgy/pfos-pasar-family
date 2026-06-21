// GET /api/reports/export-csv?date=2026-06-21
// Returns UTF-8 BOM CSV — bisa dibuka langsung di Excel
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type { SessionPayload } from '@/types'

export async function GET(request: Request) {
  const raw = cookies().get('pfos_session')?.value
  if (!raw) return new NextResponse('Unauthorized', { status: 401 })

  let session: SessionPayload
  try { session = JSON.parse(raw) } catch { return new NextResponse('Unauthorized', { status: 401 }) }

  if (!['owner', 'supervisor', 'marketing_admin'].includes(session.primaryRole)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  // Fetch data from daily report API
  const baseUrl = new URL(request.url).origin
  const reportRes = await fetch(`${baseUrl}/api/reports/daily?date=${date}`, {
    headers: { Cookie: `pfos_session=${raw}` },
  })
  const report = await reportRes.json()

  const fmt = (n: number | null) =>
    n !== null ? n.toLocaleString('id-ID') : '-'

  const dateFormatted = new Date(date + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const rows: string[][] = []

  rows.push([`LAPORAN HARIAN PFOS — ${dateFormatted}`])
  rows.push([`Dicetak: ${new Date().toLocaleString('id-ID')}`])
  rows.push([])
  rows.push(['RINGKASAN'])
  rows.push(['Total Order', String(report.grandOrders)])
  rows.push(['Total Pendapatan', `Rp ${fmt(report.grandTotal)}`])
  rows.push([])
  rows.push(['DETAIL PER TENANT'])
  rows.push([
    'Tenant', 'Jumlah Order',
    'Pendapatan Total', 'Cash', 'QRIS',
    'Buka Kas', 'Tutup Kas (Aktual)', 'Selisih', 'QRIS (Laporan)',
    'Status Sesi',
  ])

  for (const t of (report.tenants ?? [])) {
    rows.push([
      t.tenantName,
      String(t.totalOrders),
      `Rp ${fmt(t.totalRevenue)}`,
      `Rp ${fmt(t.cashRevenue)}`,
      `Rp ${fmt(t.qrisRevenue)}`,
      t.openingCash !== null ? `Rp ${fmt(t.openingCash)}` : '-',
      t.closingCashActual !== null ? `Rp ${fmt(t.closingCashActual)}` : '-',
      t.selisih !== null ? `Rp ${fmt(t.selisih)}` : '-',
      t.qrisReported !== null ? `Rp ${fmt(t.qrisReported)}` : '-',
      t.sessionStatus === 'closed' ? 'Tutup' : t.sessionStatus === 'open' ? 'Buka' : 'Belum Buka',
    ])
  }

  rows.push([])
  rows.push(['MENU TERLARIS'])
  rows.push(['Tenant', 'Menu', 'Qty Terjual'])
  for (const t of (report.tenants ?? [])) {
    for (const item of (t.topItems ?? [])) {
      rows.push([t.tenantName, item.name, String(item.total_qty)])
    }
  }

  // Escape CSV: wrap in quotes jika ada koma
  const escape = (v: string) => v.includes(',') || v.includes('"') || v.includes('\n')
    ? `"${v.replace(/"/g, '""')}"` : v

  // UTF-8 BOM agar Excel baca karakter Indonesia dengan benar
  const BOM = '﻿'
  const csv = BOM + rows.map(r => r.map(escape).join(',')).join('\r\n')

  const filename = `laporan-pfos-${date}.csv`
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
