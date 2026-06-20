// ============================================================
// PFOS — TypeScript Types
// ============================================================

// --- Enums / Union Types ---

export type TenantStatus = 'active' | 'pause' | 'inactive'
export type UserStatus = 'active' | 'evaluation' | 'inactive'
export type RoleName =
  | 'owner'
  | 'supervisor'
  | 'kasir'
  | 'kitchen'
  | 'qa_checker'
  | 'marketing_admin'
  | 'viewer'

export type OrderStatus = 'pending' | 'cooking' | 'qa_pending' | 'ready' | 'completed' | 'cancelled'
export type OrderChannel = 'dine_in' | 'takeaway' | 'whatsapp' | 'gofood' | 'grabfood' | 'shopeefood'
export type PaymentMethod = 'cash' | 'qris' | 'platform'
export type AlertSeverity = 'red' | 'yellow' | 'green'


// --- Database Models ---

export interface Tenant {
  id: string
  slug: string
  name: string
  status: TenantStatus
  color: string
  sort_order: number
  opening_time: string
  closing_time: string
  created_at: string
}

export interface User {
  id: string
  name: string
  phone?: string
  home_tenant_id?: string
  status: UserStatus
  notes?: string
  created_at: string
}

export interface Role {
  id: string
  name: RoleName
}

export interface UserRole {
  id: string
  user_id: string
  role_id: string
  tenant_id?: string
  role?: Role
  tenant?: Tenant
}

export interface MenuItem {
  id: string
  tenant_id: string
  category_id?: string
  name: string
  price: number
  status: 'active' | 'inactive'
  sort_order: number
  created_at: string
  category?: Category
}

export interface Category {
  id: string
  tenant_id: string
  name: string
  sort_order: number
}

export interface Order {
  id: string
  tenant_id: string
  order_number: string
  channel: OrderChannel
  status: OrderStatus
  payment_method?: PaymentMethod
  payment_status: 'unpaid' | 'paid'
  subtotal: number
  discount: number
  total: number
  customer_name?: string
  notes?: string
  kasir_id?: string
  created_at: string
  completed_at?: string
  order_items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string
  quantity: number
  unit_price: number
  notes?: string
  menu_item?: MenuItem
}

export interface CashSession {
  id: string
  tenant_id: string
  date: string
  opener_id?: string
  opening_cash: number
  cash_sales: number
  closer_id?: string
  closing_cash_expected?: number
  closing_cash_actual?: number
  selisih?: number
  selisih_notes?: string
  qris_total_reported?: number
  status: 'open' | 'closed'
  opened_at: string
  closed_at?: string
}

export interface DashboardAlert {
  id: string
  tenant_id?: string
  type: string
  severity: AlertSeverity
  message: string
  reference_id?: string
  is_read: boolean
  is_resolved: boolean
  created_at: string
}

export interface StaffTask {
  id: string
  tenant_id?: string
  assigned_to?: string
  assigned_by?: string
  title: string
  description?: string
  type: 'manual' | 'floating' | 'daily_routine'
  status: 'pending' | 'done' | 'skipped'
  due_time?: string
  completed_at?: string
  created_at: string
}


// --- API / Session Types ---

/** Data user untuk layar login (dari fungsi get_active_users_for_login) */
export interface LoginUser {
  id: string
  name: string
  status: UserStatus
  home_tenant_id?: string
  home_tenant?: {
    name: string
    color: string
    slug: string
  }
  primary_role: RoleName
}

/** Session yang disimpan di cookie setelah login PIN berhasil */
export interface SessionPayload {
  userId: string
  name: string
  primaryRole: RoleName
  homeTenantId: string | null
  selectedTenantId: string | null   // tenant yang dipilih saat shift ini
  loginAt: number                   // Unix timestamp
}

/** Response dari POST /api/auth/pin */
export interface PinAuthResponse {
  success: boolean
  user?: SessionPayload
  error?: string
  redirectTo?: string
}


// --- UI Helper Types ---

/** Mapping role → halaman utama setelah login */
export const ROLE_HOME: Record<RoleName, string> = {
  owner:           '/app/dashboard',
  supervisor:      '/app/qa',
  kasir:           '/app/pos',
  kitchen:         '/app/kitchen',
  qa_checker:      '/app/qa',
  marketing_admin: '/app/dashboard',
  viewer:          '/app/dashboard',
}

/** Label Bahasa Indonesia untuk channel */
export const CHANNEL_LABEL: Record<OrderChannel, string> = {
  dine_in:    'Makan di Tempat',
  takeaway:   'Bawa Pulang',
  whatsapp:   'WhatsApp',
  gofood:     'GoFood',
  grabfood:   'GrabFood',
  shopeefood: 'ShopeeFood',
}

/** Label Bahasa Indonesia untuk status order */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending:    'Menunggu',
  cooking:    'Dimasak',
  qa_pending: 'QA',
  ready:      'Siap',
  completed:  'Selesai',
  cancelled:  'Dibatalkan',
}

/** Format Rupiah */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Prefix kode tenant untuk nomor order — support slug pendek & panjang */
export const TENANT_PREFIX: Record<string, string> = {
  bagia:           'BG',
  'bagia-kopitiam':'BG',
  tl:              'TL',
  'tujuh-legenda': 'TL',
  hibiro:          'HB',
  ramen:           'RF',
  'ramen-family':  'RF',
  tjan:            'TJ',
  'tjan-kopitiam': 'TJ',
}
