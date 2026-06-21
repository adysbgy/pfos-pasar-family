'use client'

// Dipakai di halaman yang butuh tenantId tapi user tidak punya home tenant tetap
// (Owner, supervisor/qa_checker dengan akses "semua tenant")

interface Tenant {
  id: string
  name: string
  color: string
}

export default function TenantPicker({
  tenants, selected, onSelect,
}: {
  tenants: Tenant[]
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="bg-white px-4 py-2 border-b border-gray-100 flex gap-2 overflow-x-auto">
      {tenants.map(t => (
        <button key={t.id} onClick={() => onSelect(t.id)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
            ${selected === t.id ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
          style={selected === t.id ? { background: t.color } : {}}>
          {t.name}
        </button>
      ))}
    </div>
  )
}
