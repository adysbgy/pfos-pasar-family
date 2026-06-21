'use client'

interface Tenant { id: string; name: string; color: string }

interface TenantPickerProps {
  tenants: Tenant[]
  selected: string
  onChange?: (id: string) => void
  onSelect?: (id: string) => void  // alias untuk onChange
  className?: string
}

export default function TenantPicker({ tenants, selected, onChange, onSelect, className = '' }: TenantPickerProps) {
  if (tenants.length <= 1) return null
  const handleClick = (id: string) => { onChange?.(id); onSelect?.(id) }
  return (
    <div className={`flex gap-2 overflow-x-auto pb-1 ${className}`}>
      {tenants.map(t => (
        <button key={t.id} onClick={() => handleClick(t.id)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
            ${selected === t.id ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
          style={selected === t.id ? { background: t.color } : {}}>
          {t.name}
        </button>
      ))}
    </div>
  )
}
