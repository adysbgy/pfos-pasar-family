// TODO: Implementasi Hari berikutnya
export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="text-5xl mb-4">📊</div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">📊 Dashboard</h1>
      <p className="text-sm text-gray-500 mb-1">Ringkasan Operasional</p>
      <p className="text-xs text-gray-400">Diakses oleh: Owner / Supervisor</p>
      <div className="mt-8 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-xs text-amber-700 font-medium">🚧 Halaman ini sedang dikembangkan</p>
        <p className="text-xs text-amber-600 mt-0.5">Coming in next build</p>
      </div>
    </div>
  )
}
