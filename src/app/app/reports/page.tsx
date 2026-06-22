'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatRupiah } from '@/types'
import type { SessionPayload } from '@/types'

// ============================================================
// Halaman Laporan Harian
// Role: owner, supervisor, marketing_admin
// ============================================================

interface TenantReport {
  tenantId: string
  tenantName: string
  tenantColor: string
  totalOrders: number
  totalRevenue: number
  cashRevenue: number
  qrisRevenue: number
  openingCash: number | null
  closingCashActual: number | null
  selisih: number | null
  qrisReported: number | null
  sessionStatus: 'open' | 'closed' | 'not_opened'
  closedAt: string | null
  topItems: { name: string; total_qty: number }[]
}

interface DailyReport {
  date: string
  grandTotal: number
  grandOrders: number
  tenants: TenantReport[]
}

function selisihLabel(selisih: number | null) {
  if (selisih === null) return null
  if (selisih === 0) return { label: 'Pas', color: 'text-green-700 bg-green-50' }
  if (Math.abs(selisih) <= 10000) return { label: `Selisih ${formatRupiah(selisih)}`, color: 'text-yellow-700 bg-yellow-50' }
  return { label: `⚠️ Selisih ${formatRupiah(selisih)}`, color: 'text-red-700 bg-red-50' }
}

export default function ReportsPage() {
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local
  const [session, setSession]   = useState<SessionPayload | null>(null)
  const [date, setDate]         = useState(today)
  const [report, setReport]     = useState<DailyReport | null>(null)
  const [loading, setLoading]   = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => setSession(d.session))
  }, [])

  const loadReport = useCallback(async (d: string) => {
    setLoading(true)
    setReport(null)
    try {
      const res = await fetch(`/api/reports/daily?date=${d}`)
      const data = await res.json()
      setReport(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadReport(date) }, [date, loadReport])

  function handleExportCSV() {
    window.open(`/api/reports/export-csv?date=${date}`, '_blank')
  }

  function handlePrint() {
    window.print()
  }

  const dateFormatted = new Date(date + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="max-w-md mx-auto px-4 py-4 print:px-0 print:py-0">
      {/* Header — hidden saat print */}
      <div className="print:hidden mb-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">Laporan Harian</h1>
          <a href="/app/analytics" className="text-xs font-medium bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full active:bg-gray-200">
            📊 Analytics →
          </a>
        </div>
        {/* Date picker */}
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => {
            const d = new Date(date); d.setDate(d.getDate()-1)
            setDate(d.toLocaleDateString('en-CA'))
          }} className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-xl text-lg active:bg-gray-200">‹</button>
          <input type="date" value={date} max={today}
            onChange={e => setDate(e.target.value)}
            className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:border-gray-900 outline-none" />
          <button onClick={() => {
            const d = new Date(date); d.setDate(d.getDate()+1)
            const next = d.toLocaleDateString('en-CA')
            if (next <= today) setDate(next)
          }} disabled={date >= today}
            className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-xl text-lg active:bg-gray-200 disabled:opacity-30">›</button>
        </div>
        {/* Export buttons */}
        {report && !loading && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleExportCSV}
              className="flex items-center justify-center gap-2 py-2.5 bg-green-700 text-white rounded-xl text-sm font-medium active:bg-green-800">
              📊 Export Excel
            </button>
            <button onClick={handlePrint}
              className="flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium active:bg-gray-700">
              🖨️ Cetak / PDF
            </button>
          </div>
        )}
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-4 text-center border-b pb-3">
        <h1 className="text-xl font-bold">Laporan Harian PFOS</h1>
        <p className="text-sm text-gray-600">{dateFormatted}</p>
        <p className="text-xs text-gray-400">Dicetak: {new Date().toLocaleString('id-ID')}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !report ? null : (
        <>
          {/* Ringkasan total */}
          <div className="card bg-gray-900 text-white mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{dateFormatted}</p>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-3xl font-bold">{formatRupiah(report.grandTotal)}</p>
                <p className="text-sm text-gray-400 mt-1">{report.grandOrders} order total</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">{report.tenants.length} tenant</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {report.tenants.filter(t => t.sessionStatus === 'closed').length} sudah tutup
                </p>
              </div>
            </div>
          </div>

          {/* Per tenant */}
          {report.tenants.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📭</p>
              <p>Tidak ada data untuk tanggal ini</p>
            </div>
          ) : report.tenants.map(t => {
            const sl = selisihLabel(t.selisih)
            const isExpanded = expanded === t.tenantId
            return (
              <div key={t.tenantId} className="card mb-3 print:mb-2 print:break-inside-avoid">
                {/* Tenant header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.tenantColor }} />
                  <h2 className="font-bold text-base flex-1">{t.tenantName}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                    ${t.sessionStatus === 'closed' ? 'bg-green-100 text-green-700' :
                      t.sessionStatus === 'open' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'}`}>
                    {t.sessionStatus === 'closed' ? '✓ Tutup' : t.sessionStatus === 'open' ? 'Buka' : 'Belum Buka'}
                  </span>
                </div>

                {/* Revenue row */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="text-center bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="font-bold text-sm">{formatRupiah(t.totalRevenue)}</p>
                  </div>
                  <div className="text-center bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500">Cash</p>
                    <p className="font-bold text-sm">{formatRupiah(t.cashRevenue)}</p>
                  </div>
                  <div className="text-center bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-500">QRIS</p>
                    <p className="font-bold text-sm">{formatRupiah(t.qrisRevenue)}</p>
                  </div>
                </div>

                {/* Selisih kas */}
                {sl && (
                  <div className={`rounded-lg px-3 py-1.5 text-xs font-medium mb-2 ${sl.color}`}>
                    {sl.label}
                  </div>
                )}

                {/* Toggle detail */}
                <button onClick={() => setExpanded(isExpanded ? null : t.tenantId)}
                  className="print:hidden w-full text-xs text-gray-400 hover:text-gray-700 text-left mt-1">
                  {isExpanded ? '▲ Sembunyikan detail' : '▼ Lihat detail kas & menu'}
                </button>

                {/* Detail kas (expandable) */}
                {(isExpanded || true) && t.openingCash !== null && (
                  <div className="hidden print:block mt-2 space-y-1 text-xs text-gray-600 border-t pt-2">
                    <div className="flex justify-between"><span>Kas Awal:</span><span>{formatRupiah(t.openingCash)}</span></div>
                    {t.closingCashActual !== null && <div className="flex justify-between"><span>Kas Aktual:</span><span>{formatRupiah(t.closingCashActual)}</span></div>}
                    {t.qrisReported !== null && <div className="flex justify-between"><span>QRIS (laporan):</span><span>{formatRupiah(t.qrisReported)}</span></div>}
                    {t.selisih !== null && <div className={`flex justify-between font-semibold ${Math.abs(t.selisih) > 10000 ? 'text-red-600' : ''}`}><span>Selisih:</span><span>{formatRupiah(t.selisih)}</span></div>}
                  </div>
                )}

                {isExpanded && (
                  <div className="print:hidden mt-3 space-y-2">
                    {/* Detail kas */}
                    {t.openingCash !== null && (
                      <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
                        <p className="font-semibold text-xs text-gray-500 uppercase tracking-wide mb-2">Detail Kas</p>
                        <div className="flex justify-between"><span className="text-gray-600">Kas Awal</span><span className="font-medium">{formatRupiah(t.openingCash)}</span></div>
                        {t.closingCashActual !== null && <div className="flex justify-between"><span className="text-gray-600">Kas Aktual</span><span className="font-medium">{formatRupiah(t.closingCashActual)}</span></div>}
                        {t.qrisReported !== null && <div className="flex justify-between"><span className="text-gray-600">QRIS (laporan)</span><span className="font-medium">{formatRupiah(t.qrisReported)}</span></div>}
                        {t.selisih !== null && (
                          <div className={`flex justify-between font-bold border-t pt-1.5 mt-1.5 ${Math.abs(t.selisih) > 10000 ? 'text-red-600' : 'text-gray-900'}`}>
                            <span>Selisih</span>
                            <span>{formatRupiah(t.selisih)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Top items */}
                    {t.topItems.length > 0 && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="font-semibold text-xs text-gray-500 uppercase tracking-wide mb-2">Menu Terlaris</p>
                        {t.topItems.map((item, i) => (
                          <div key={item.name} className="flex items-center gap-2 py-1">
                            <span className="text-xs text-gray-400 w-4">{i+1}.</span>
                            <span className="text-sm flex-1 truncate">{item.name}</span>
                            <span className="text-sm font-semibold">{item.total_qty}×</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-gray-400 text-center">{t.totalOrders} order · {t.closedAt ? `Ditutup ${new Date(t.closedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
                  </div>
                )}

                {/* Print: top items */}
                {t.topItems.length > 0 && (
                  <div className="hidden print:block mt-2 text-xs border-t pt-2">
                    <p className="font-semibold text-gray-500 mb-1">Menu Terlaris:</p>
                    {t.topItems.map((item, i) => (
                      <span key={item.name} className="mr-3">{i+1}. {item.name} ({item.total_qty}×)</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Print footer */}
          <div className="hidden print:block mt-4 text-center text-xs text-gray-400">
            Laporan ini dibuat otomatis oleh PFOS · pasarfamily.my.id
          </div>
        </>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { font-size: 12px; }
          nav, header { display: none !important; }
          .print\\:break-inside-avoid { break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}
