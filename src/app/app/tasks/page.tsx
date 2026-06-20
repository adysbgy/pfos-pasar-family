'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SessionPayload, StaffTask, RoleName } from '@/types'

export default function TasksPage() {
  const supabase = createClient()
  const [session, setSession]     = useState<SessionPayload | null>(null)
  const [tasks, setTasks]         = useState<StaffTask[]>([])
  const [loading, setLoading]     = useState(true)
  const [newTitle, setNewTitle]   = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(d => setSession(d.session))
  }, [])

  useEffect(() => {
    if (!session) return
    loadTasks()
  }, [session])

  async function loadTasks() {
    if (!session) return
    let query = supabase
      .from('staff_tasks')
      .select('*')
      .in('status', ['pending'])
      .order('due_time', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    // Owner & supervisor lihat semua; staff lain lihat tugas mereka sendiri
    const isManager = ['owner', 'supervisor'].includes(session.primaryRole as RoleName)
    if (!isManager) {
      query = query.or(`assigned_to.eq.${session.userId},assigned_to.is.null`)
    }
    if (session.selectedTenantId) {
      query = query.or(`tenant_id.eq.${session.selectedTenantId},tenant_id.is.null`)
    }

    const { data } = await query
    setTasks(data ?? [])
    setLoading(false)
  }

  async function markDone(taskId: string) {
    await supabase.from('staff_tasks').update({
      status: 'done',
      completed_at: new Date().toISOString(),
    }).eq('id', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  async function addTask() {
    if (!newTitle.trim() || !session) return
    setSubmitting(true)
    const { data } = await supabase.from('staff_tasks').insert({
      tenant_id:   session.selectedTenantId,
      assigned_by: session.userId,
      title:       newTitle.trim(),
      type:        'manual',
      status:      'pending',
    }).select().single()
    if (data) setTasks(prev => [data, ...prev])
    setNewTitle('')
    setSubmitting(false)
  }

  const isManager = ['owner', 'supervisor'].includes(session?.primaryRole as RoleName)

  // Tampilan khusus Om Tommy (supervisor, 75 thn) — 3 tombol besar
  const isOmTommy = session?.primaryRole === 'supervisor' || session?.primaryRole === 'qa_checker'

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-md mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Tugas Harian</h1>
        <span className="text-sm text-gray-500">{tasks.length} aktif</span>
      </div>

      {/* Tambah tugas (manager saja) */}
      {isManager && (
        <div className="flex gap-2 mb-5">
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="Tambah tugas baru..."
            className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-gray-900 outline-none"
          />
          <button onClick={addTask} disabled={submitting || !newTitle.trim()}
            className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40">
            + Tambah
          </button>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-3">📋</p>
          <p className="font-medium">Tidak ada tugas aktif</p>
          <p className="text-sm mt-1">Semua beres!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <div key={task.id} className={`card flex items-start gap-3 ${isOmTommy ? 'py-5' : ''}`}>
              {/* Checkbox besar untuk Om Tommy */}
              <button
                onClick={() => markDone(task.id)}
                className={`flex-shrink-0 rounded-full border-2 border-gray-300 flex items-center justify-center
                  transition-colors active:bg-green-100 active:border-green-500
                  ${isOmTommy ? 'w-12 h-12' : 'w-7 h-7 mt-0.5'}`}
              >
                <span className={isOmTommy ? 'text-xl' : 'text-sm'}>✓</span>
              </button>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-gray-900 ${isOmTommy ? 'text-lg' : 'text-sm'}`}>{task.title}</p>
                {task.description && (
                  <p className={`text-gray-500 mt-0.5 ${isOmTommy ? 'text-base' : 'text-xs'}`}>{task.description}</p>
                )}
                {task.due_time && (
                  <p className={`text-amber-600 mt-0.5 ${isOmTommy ? 'text-sm' : 'text-xs'}`}>
                    ⏰ {new Date(task.due_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                <span className={`inline-block mt-1 rounded-full font-medium capitalize
                  ${isOmTommy ? 'text-sm px-3 py-0.5' : 'text-[10px] px-2 py-0.5'}
                  ${task.type === 'daily_routine' ? 'bg-blue-50 text-blue-600' :
                    task.type === 'floating' ? 'bg-purple-50 text-purple-600' :
                    'bg-gray-100 text-gray-500'}`}>
                  {task.type === 'daily_routine' ? 'Rutin' : task.type === 'floating' ? 'Float' : 'Manual'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Shortcut insiden untuk Om Tommy */}
      {isOmTommy && (
        <div className="mt-6 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Shortcut Insiden</p>
          {[
            { icon: '🍽️', label: 'Piring Kotor / Benda Asing', type: 'piring_kotor' },
            { icon: '⚠️', label: 'Komplain Pelanggan', type: 'pelayanan' },
            { icon: '📦', label: 'Menu Salah / Kurang', type: 'menu_salah' },
          ].map(item => (
            <button key={item.type}
              onClick={async () => {
                if (!session?.selectedTenantId) return
                await supabase.from('complaints').insert({
                  tenant_id:   session.selectedTenantId,
                  reporter_id: session.userId,
                  type:        item.type,
                  description: `Dilaporkan oleh ${session.name}`,
                  severity:    'medium',
                })
                alert(`✅ Insiden "${item.label}" tercatat!`)
              }}
              className="w-full flex items-center gap-4 bg-white border-2 border-gray-100 rounded-2xl px-4 py-4 active:bg-gray-50 text-left">
              <span className="text-3xl">{item.icon}</span>
              <span className="text-lg font-semibold text-gray-900">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
