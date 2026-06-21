# PFOS — Pasar Family Operating System

> Baca file ini dulu sebelum menyentuh kode apapun.

## Konteks Bisnis

Owner (AJ, adysjunior1@gmail.com) punya **beberapa tenant di dalam Pasar Family** (bukan seluruh Pasar Family). Masalah utama: operasional bocor — uang kas tidak terhitung, pesanan salah, QA tidak jalan, laporan tidak ada. PFOS adalah sistem operasional internal untuk menutup semua lubang itu.

Owner **tidak selalu di lokasi**. Semua kontrol via HP (owner dashboard). Staff login pakai **PIN 4-6 digit** (bukan email/password). Interface **100% Bahasa Indonesia**. **Paperless** — tidak ada printer struk.

## Tenant Aktif

| Slug DB | Nama | Warna | Catatan |
|---------|------|-------|---------|
| `bagia-kopitiam` | Bagia | #D97706 | Menu = TL tapi tanpa makanan berat |
| `tujuh-legenda` | Tujuh Legenda | #DC2626 | Menu lengkap. GoFood aktif. **TANPA Nikudon** |
| `hibiro` | Hibiro | #1D4ED8 | Brand Nikudon/Jepang. Di TL, brand ini = Hibiro |
| `ramen-family` | Ramen Family | #16A34A | 2 SKU: Ramen Original 20K, Ramen Spicy 25K |
| `tjan-kopitiam` | Tjan | #6B7280 | **PAUSE** — semua menu inactive |

**Jam operasional: 06:30–12:30. Batas closing: 13:30.**

⚠️ Slug DB berbeda dari kode lama. TENANT_PREFIX di `src/types/index.ts` support keduanya.

## Staff & Roles

| Nama | Role | Tenant | Status |
|------|------|--------|--------|
| Owner | owner | semua | active |
| Om Tommy | supervisor + qa_checker | semua | active — **75 thn, UI harus 3 tombol besar** |
| Seli | kasir | Bagia | active |
| Putra | kitchen | TL | active |
| Bu Een | kitchen | Ramen + float TL | active |
| Nina | kasir | Ramen | active |
| Ardan | kitchen | Hibiro | **evaluation** — owner bisa deactivate instant |

Kasir **fleksibel**: siapa yang jaga = siapa kasir. Staff bisa pilih tenant saat login.

## Tech Stack

- **Next.js 14** App Router + TypeScript
- **Tailwind CSS** — mobile-first, touch target min 44px
- **Supabase** (PostgreSQL + Realtime + Storage) di `ueronwrodyzhwmarizvs.supabase.co`
- **@supabase/ssr** untuk cookie-based session
- **Auth**: PIN-based, cookie `pfos_session` (httpOnly, 8 jam)
- **Deploy**: Vercel + `pasarfamily.my.id`

## Struktur File

```
pfos-app/
├── src/
│   ├── types/index.ts          ← Semua TS types + ROLE_HOME + TENANT_PREFIX + formatRupiah
│   ├── middleware.ts            ← Route protection via pfos_session cookie
│   ├── lib/supabase/
│   │   ├── client.ts           ← Browser client
│   │   ├── server.ts           ← Server component client
│   │   └── admin.ts            ← Service role — HANYA di API routes
│   └── app/
│       ├── api/
│       │   ├── auth/pin/       ← POST: verifikasi PIN → set cookie
│       │   ├── auth/logout/    ← POST: hapus cookie
│       │   ├── auth/session/   ← GET: baca session
│       │   ├── users/          ← GET: list staff aktif (public, untuk login)
│       │   ├── orders/         ← POST: buat order
│       │   ├── menu/           ← GET/POST/PATCH/DELETE: manajemen menu
│       │   ├── tenants/        ← GET: daftar tenant aktif
│       │   ├── inventory/      ← GET/POST: stok + adjust
│       │   ├── inventory/history/ ← GET: riwayat transaksi stok
│       │   ├── reports/daily/  ← GET: aggregasi laporan harian
│       │   └── reports/export-csv/ ← GET: download CSV (Excel-compatible)
│       └── app/
│           ├── login/          ← Staff grid + PIN keypad
│           ├── pos/            ← Input order (kasir)
│           ├── kitchen/        ← KDS antrian (kitchen)
│           ├── qa/             ← QA checklist 6 poin
│           ├── cash/           ← Sesi kas
│           ├── closing/        ← Laporan penutupan
│           ├── tasks/          ← Tugas harian
│           ├── dashboard/      ← Owner dashboard anti-bocor
│           ├── inventory/      ← Manajemen stok
│           ├── reports/        ← Laporan harian + export
│           └── menu/           ← Manajemen menu (owner)
└── database/
    ├── schema.sql              ← Semua tabel + RLS + indexes
    ├── seed.sql                ← Data awal (5 tenant, 7 staff, menu)
    ├── functions.sql           ← RPC functions (sudah di-run di Supabase)
    ├── sprint2_inventory.sql   ← Tabel inventory (sudah di-run di Supabase)
    └── README.md
```

## Database — Tabel Utama

```sql
-- Sprint 1
tenants          -- 5 tenant (slug: bagia-kopitiam, tujuh-legenda, hibiro, ramen-family, tjan-kopitiam)
users            -- 7 staff (PIN bcrypt $2a$ di kolom pin_hash)
roles            -- owner|supervisor|kasir|kitchen|qa_checker|marketing_admin|viewer
user_roles       -- many-to-many, tenant_id nullable = akses semua tenant
categories       -- per tenant (bukan menu_categories!)
menu_items       -- price integer Rupiah, status active/inactive
orders           -- status: pending→cooking→qa_pending→ready→completed|cancelled
order_items      -- qty + unit_price (snapshot)
order_sequences  -- counter nomor order per tenant per hari
payments         -- method: cash|qris
cash_sessions    -- sesi kas per tenant per hari
cash_expenses    -- pengeluaran dari laci
kitchen_queue    -- antrian masak
qa_checks        -- 6 poin QA per order
dashboard_alerts -- severity: red|yellow|green
staff_tasks      -- tugas dari owner/supervisor

-- Sprint 2 (sprint2_inventory.sql)
inventory_items       -- item stok per tenant (unit, min_stock, category)
inventory_stock       -- level stok saat ini (1 row per item)
inventory_transactions -- history semua perubahan stok
```

## Supabase RPC Functions

| Fungsi | Dipanggil dari |
|--------|----------------|
| `verify_user_pin(user_id, pin)` | POST /api/auth/pin |
| `get_user_session_data(user_id)` | POST /api/auth/pin |
| `next_order_sequence(tenant_id, date)` | POST /api/orders |
| `get_active_users_for_login()` | GET /api/users |
| `get_dashboard_summary(date)` | GET /api/dashboard |
| `adjust_inventory_stock(item_id, type, qty_change, notes, user_id)` | POST /api/inventory |

## Session Cookie

Cookie `pfos_session` (httpOnly, 8 jam):
```typescript
{
  userId: string
  name: string
  primaryRole: RoleName      // 'owner'|'supervisor'|'kasir'|'kitchen'|'qa_checker'|...
  homeTenantId: string | null
  selectedTenantId: string | null
  loginAt: number            // Unix ms
}
```

Baca di server: `cookies().get('pfos_session')` → JSON.parse  
Baca di client: `fetch('/api/auth/session')`

## Nav Per Role (layout.tsx)

| Role | Tab |
|------|-----|
| owner | Dashboard, POS, Menu🍽️, Stok📦, Laporan📈 |
| supervisor | QA, Stok📦, Laporan📈, Tugas |
| kasir | POS, Kas, Tugas |
| kitchen | Dapur, Tugas |
| qa_checker | QA, Tugas |

## Konvensi Coding

- **Bahasa Indonesia** di semua UI — label, error, tombol
- **Rupiah**: `formatRupiah(amount)` dari `@/types` (jangan format manual)
- **Admin client** hanya di API routes: `createAdminClient()` dari `@/lib/supabase/admin`
- **Tabel kategori**: nama tabelnya `categories` (bukan `menu_categories`)
- **Nomor order**: `[PREFIX]-[YYYYMMDD]-[SEQ3]` → contoh `TL-20260621-001`
- **Selisih kas > Rp10.000** = alert merah wajib
- **Touch targets**: min 44px (gunakan `min-h-[44px]`)
- Feedback tap: `active:scale-95 transition-transform duration-75`
- Realtime: subscribe ke `orders`, `kitchen_queue`, `dashboard_alerts`

## Inventory — Tipe Transaksi

| type | Arah | Kapan |
|------|------|-------|
| `purchase` | + masuk | Beli/terima dari supplier |
| `usage` | − keluar | Dipakai untuk order |
| `waste` | − keluar | Terbuang/rusak |
| `adjustment` | ±  | Koreksi manual |
| `opening` | + masuk | Stok awal setup |

qty_change positif = masuk, negatif = keluar. RPC `adjust_inventory_stock` otomatis buat dashboard_alert jika stok ≤ min_stock.

## Sprint Progress

| Sprint | Fitur | Status |
|--------|-------|--------|
| 1 | Login PIN | ✅ LIVE |
| 1 | POS | ✅ LIVE |
| 1 | Kitchen KDS | ✅ LIVE |
| 1 | QA Gate | ✅ LIVE |
| 1 | Cash Session | ✅ LIVE |
| 1 | Closing Report | ✅ LIVE |
| 1 | Owner Dashboard | ✅ LIVE |
| 1 | Tasks | ✅ LIVE |
| 2 | Inventory & Stok | ✅ LIVE |
| 2 | Laporan Harian + Export CSV | ✅ LIVE |
| 2 | Manajemen Menu | ✅ LIVE |
| 2 | PWA (install di homescreen) | 🔜 |
| 2 | Voucher & Diskon | 🔜 |

## Commands

```bash
npm run dev          # Dev server → localhost:3000
npm run build        # Build production (cek error dulu sebelum push)
npm run lint         # ESLint
git add . && git commit -m "feat: ..."
git push origin main # Auto-deploy ke Vercel
```

## Yang JANGAN Dilakukan

- ❌ Jangan tampilkan Nikudon di tenant `tujuh-legenda` — brand itu = Hibiro
- ❌ Jangan hardcode kasir per tenant — kasir lintas tenant
- ❌ Jangan commit `.env.local` ke Git
- ❌ Jangan `createAdminClient()` di komponen browser/client
- ❌ Jangan install npm package baru tanpa cek dulu (sandbox npm sering diblokir)
- ❌ Jangan buat scroll horizontal — layar HP sempit
- ❌ Jangan pakai nama tabel `menu_categories` — yang benar adalah `categories`
- ❌ Jangan assume slug tenant — selalu cek DB, slug pakai format panjang (`bagia-kopitiam`, bukan `bagia`)
