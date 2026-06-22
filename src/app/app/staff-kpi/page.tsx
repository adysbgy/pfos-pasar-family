'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatRupiah } from '@/types'

// ============================================================
// Halaman Staff Performance Dashboard (KPI)
// Role: owner
// Lintas-tenant — kasir & qa_checker bisa kerja di tenant manapun
// ============================================================

interface KasirKpi { userId: string; name: string; orders: number; revenue: number; avgOrder: number }
interface QaKpi { userId: string; name: string; total: number; pass: number; passRate: number }

const RANGE_OPTIONS = [
  { label: '7 Hari', days: 7 },
  { label: '30 Hari', days: 30 },
]

export default function StaffKpiPage() {
  const [days, setDays]       = useState(7)
  const [kasirKpi, setKasirKpi] = useState<KasirKpi[]>([])
  const [qaKpi, setQaKpi]     = useState<QaKpi[]>([])
  const [loading, setLoading] = useState(true)

  const loadKpi = useCallback(async (d: number) => {
    setLoading(true)
    const res = await fetch(`/api/staff-kpi?days=${d}`)
    const data = await res.json()
    setKasirKpi(data.kasirKpi ?? [])
    setQaKpi(data.qaKpi ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadKpi(days) }, [days, loadKpi])

  return (
    <div className="max-w-md mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Staff KPI</h1>
        <div className="flex gap-1.5">
          {RANGE_OPTIONS.map(opt => (
            <button key={opt.days} onClick={() => setDays(opt.days)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${days === opt.days ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Penjualan per Kasir</p>
          {kasirKpi.length === 0 ? (
            <p className="text-sm text-gray-400 mb-4">Belum ada data</p>
          ) : (
            <div className="space-y-2 mb-5">
              {kasirKpi.map((k, i) => (
                <div key={k.userId} className="card flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-400 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{k.name}</p>
                    <p className="text-xs text-gray-500">{k.orders} order · avg {formatRupiah(k.avgOrder)}</p>
                  </div>
                  <p className="text-sm font-bold">{formatRupiah(k.revenue)}</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">QA Pass Rate</p>
          {qaKpi.length === 0 ? (
            <p className="text-sm text-gray-400">Belum ada data</p>
          ) : (
            <div className="space-y-2">
              {qaKpi.map(q => (
                <div key={q.userId} className="card flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{q.name}</p>
                    <p className="text-xs text-gray-500">{q.pass}/{q.total} lulus</p>
                  </div>
                  <span className={`text-sm font-bold px-2.5 py-1 rounded-full
                    ${q.passRate >= 90 ? 'bg-green-100 text-green-700' : q.passRate >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                    {q.passRate}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
