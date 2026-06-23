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
│   │   ├── client.ts           ← Browser client (HINDARI dipakai di /app/* — kena RLS)
│   │   ├── server.ts           ← Server component client
│   │   └── admin.ts            ← Service role — HANYA di API routes
│   ├── components/
│   │   ├── TenantPicker.tsx    ← Dipakai semua halaman lintas-tenant
│   │   └── PushNotificationToggle.tsx ← Banner aktifkan Web Push di Dashboard (Sprint 5)
│   ├── lib/push.ts             ← sendPushToRole() kirim Web Push ke owner (Sprint 5)
│   ├── public/sw.js            ← Service worker: handle push + notificationclick (Sprint 5)
│   └── app/
│       ├── api/
│       │   ├── auth/pin/       ← POST: verifikasi PIN → set cookie (+ rate limit lock 5x gagal, Sprint 5)
│       │   ├── auth/change-pin/ ← POST: ganti PIN sendiri (verifikasi PIN lama, Sprint 5)
│       │   ├── auth/logout/    ← POST: hapus cookie
│       │   ├── auth/session/   ← GET: baca session
│       │   ├── users/          ← GET: list staff aktif (public, untuk login)
│       │   ├── orders/         ← POST: buat order (+ voucher, table_number, auto-deduct resep)
│       │   ├── menu/           ← GET/POST/PATCH/DELETE: manajemen menu
│       │   ├── tenants/        ← GET: daftar tenant aktif
│       │   ├── inventory/      ← GET/POST/PATCH: stok + adjust + harga bahan (cost_per_unit)
│       │   ├── inventory/history/ ← GET: riwayat transaksi stok
│       │   ├── reports/daily/  ← GET: aggregasi laporan harian
│       │   ├── reports/export-csv/ ← GET: download CSV (Excel-compatible)
│       │   ├── kitchen/        ← GET/PATCH: antrian dapur (Sprint 2 fix: admin client)
│       │   ├── qa/             ← GET/POST: QA gate
│       │   ├── cash/           ← GET/POST: sesi kas + pengeluaran
│       │   ├── closing/        ← GET/POST: laporan penutupan
│       │   ├── dashboard/      ← GET/PATCH: alert + summary semua tenant
│       │   ├── tasks/          ← GET/PATCH/POST: tugas harian
│       │   ├── recipes/        ← GET/POST/DELETE: resep + COGS/margin (Sprint 3)
│       │   ├── complaints/     ← GET/POST/PATCH: insiden (Sprint 3)
│       │   ├── vouchers/ + /validate + /report ← CRUD voucher + validasi POS + efektivitas (Sprint 4-5)
│       │   ├── analytics/      ← GET: terlaris, jam, tren, channel, day-of-week, menu engineering (Sprint 4-5)
│       │   ├── staff-kpi/      ← GET: KPI kasir + QA pass rate (Sprint 4)
│       │   ├── opening-checks/ ← GET/POST: checklist pra-buka (Sprint 5)
│       │   ├── suppliers/      ← GET/POST: supplier per tenant (Sprint 5)
│       │   └── push/subscribe/ ← POST/DELETE: simpan/hapus Web Push subscription (Sprint 5)
│       └── app/
│           ├── login/          ← Staff grid + PIN keypad
│           ├── pos/            ← Input order (kasir) — channel, meja, voucher, toggle "Habis" (Sprint 5)
│           ├── kitchen/        ← KDS antrian (kitchen) — badge meja
│           ├── qa/             ← QA checklist 6 poin
│           ├── cash/           ← Sesi kas
│           ├── closing/        ← Laporan penutupan
│           ├── tasks/          ← Tugas harian
│           ├── dashboard/      ← Owner dashboard anti-bocor
│           ├── inventory/      ← Manajemen stok + harga bahan
│           ├── reports/        ← Laporan harian + export + link Analytics
│           ├── menu/           ← Manajemen menu (owner)
│           ├── recipes/        ← Resep/BOM + COGS & margin (Sprint 3)
│           ├── complaints/     ← Insiden — 3 tombol besar utk Om Tommy (Sprint 3)
│           ├── vouchers/       ← Manajemen voucher + laporan efektivitas (Sprint 4-5)
│           ├── analytics/      ← Terlaris, jam, tren, channel, day-of-week, menu engineering (Sprint 4-5)
│           ├── staff-kpi/      ← Staff Performance Dashboard (Sprint 4)
│           ├── opening/        ← Opening Checklist pra-buka (Sprint 5)
│           └── change-pin/     ← Ganti PIN sendiri (Sprint 5)
└── database/   ← KOSONG, tidak dipakai sejak Sprint 3 — lihat catatan di "Database — Tabel Utama"
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
inventory_items       -- item stok per tenant (unit, min_stock, category, cost_per_unit)
inventory_stock       -- level stok saat ini (1 row per item)
inventory_transactions -- history semua perubahan stok

-- Sprint 3 (tidak ada file SQL lokal — dijalankan langsung ke Supabase via Management API)
recipes          -- BOM: menu_item_id + inventory_item_id + qty_per_portion + unit
complaints       -- insiden/komplain: reporter_id, type, severity, status, resolved_at
-- orders.table_number TEXT — nomor meja untuk dine_in

-- Sprint 4 (juga dijalankan langsung ke Supabase, bukan file lokal)
vouchers         -- code, type (percent|fixed), value, min_purchase, max_discount,
                 -- usage_limit, used_count, tenant_id nullable = semua tenant
-- orders.voucher_id, orders.voucher_code

-- Sprint 5 / hardening (post Sprint 4 — dijalankan langsung ke Supabase)
opening_checks      -- checklist pra-buka per tenant per hari (6 poin boolean), UNIQUE(tenant_id,date)
push_subscriptions  -- Web Push: user_id + endpoint + p256dh + auth (1 row per device)
suppliers           -- supplier per tenant (name, phone, is_active)
-- menu_items.is_available BOOLEAN — toggle "Habis" harian (beda dari status yg utk kurasi permanen)
-- inventory_transactions.supplier_id — audit trail pembelian (type=purchase wajib supplier)
-- users.failed_pin_attempts INT + locked_until TIMESTAMPTZ — rate limit PIN (5x gagal = lock 5 menit)
-- tenants.status: 'active' | 'pause' (Tjan = pause, tampil "TUTUP" di dashboard owner)
```

⚠️ **Tidak ada folder `database/` di repo ini.** Semua migration SQL (Sprint 1-4) dijalankan langsung ke Supabase lewat SQL Editor atau Management API, bukan disimpan sebagai file di repo. Kalau butuh ubah skema, cek dulu struktur tabel asli via Supabase sebelum nulis query (gunakan `information_schema.columns`) — JANGAN asumsikan nama kolom.

## Supabase RPC Functions

| Fungsi | Dipanggil dari |
|--------|----------------|
| `verify_user_pin(user_id, pin)` | POST /api/auth/pin |
| `get_user_session_data(user_id)` | POST /api/auth/pin |
| `next_order_sequence(tenant_id, date)` | POST /api/orders |
| `get_active_users_for_login()` | GET /api/users |
| `get_dashboard_summary(date)` | GET /api/dashboard |
| `adjust_inventory_stock(item_id, type, qty_change, notes, user_id, supplier_id)` | POST /api/inventory (param `p_supplier_id` ditambah Sprint 5 — versi lama 5-arg sudah di-drop, jangan bikin overload) |
| `deduct_inventory_for_order(order_id)` | POST /api/orders (fire-and-forget, Sprint 3) |

⚠️ Staff login pakai **PIN cookie custom**, BUKAN Supabase Auth — `auth.uid()` selalu kosong di browser. Semua baca/tulis tabel HARUS lewat API route dengan `createAdminClient()` (admin/service-role), jangan pakai `@/lib/supabase/client` di komponen browser — RLS akan selalu menolak (pernah jadi bug besar berulang kali, lihat git log "fix: ... RLS").

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

| Role | Tab di bottom nav |
|------|-----|
| owner | Dashboard📊, POS🛒, Stok📦, Laporan📈, Voucher🎟️, Insiden🚨 |
| supervisor | QA✅, Insiden🚨, Stok📦, Laporan📈, Tugas📋 |
| kasir | POS🛒, Kas💵, Tugas📋 |
| kitchen | Dapur🍳, Tugas📋 |
| qa_checker | QA✅, Insiden🚨, Tugas📋 |

Halaman yang **tidak** ada di bottom nav (supaya nav tidak penuh) tapi tetap bisa diakses via link dari halaman lain atau URL langsung:
- `/app/menu` (Resep Menu) — link dari... *(belum ada link, akses via URL)*
- `/app/recipes` (Resep & BOM, COGS) — link dari... *(belum ada link, akses via URL)*
- `/app/analytics` (menu terlaris, jam tersibuk, tren, channel split, day-of-week, menu engineering) — link dari header halaman Laporan
- `/app/staff-kpi` (KPI kasir + QA pass rate) — link dari header halaman Analytics
- `/app/opening` (Opening Checklist pra-buka, 6 poin ala QA) — link dari header halaman QA
- `/app/change-pin` (ganti PIN sendiri) — link dari tap nama user di header layout

Semua halaman lintas-tenant (POS, Kitchen, QA, Cash, Closing, Inventory, Recipes, Vouchers list, Insiden, Analytics) pakai `<TenantPicker>` (`@/components/TenantPicker`) yang HANYA muncul kalau `session.selectedTenantId` kosong (Owner & supervisor tidak punya home tenant tetap). Kalau bikin halaman baru yang butuh tenantId, JANGAN cuma pakai `session.selectedTenantId` — pasti macet di loading untuk Owner.

## Konvensi Coding

- **Bahasa Indonesia** di semua UI — label, error, tombol
- **Rupiah**: `formatRupiah(amount)` dari `@/types` (jangan format manual)
- **Admin client** hanya di API routes: `createAdminClient()` dari `@/lib/supabase/admin`
- **Tabel kategori**: nama tabelnya `categories` (bukan `menu_categories`)
- **Nomor order**: `[PREFIX]-[YYYYMMDD]-[SEQ3]` → contoh `TL-20260621-001`
- **Selisih kas > Rp10.000** = alert merah wajib
- **Touch targets**: min 44px (gunakan `min-h-[44px]`)
- Feedback tap: `active:scale-95 transition-transform duration-75`
- **Live update = POLLING, bukan Supabase Realtime** — Realtime tunduk RLS yg sama (auth.uid() kosong), jadi tidak jalan utk session PIN. Kitchen/QA poll 5 dtk, Dashboard 15 dtk via `setInterval` + fetch ke API route.
- **Push notification kritis**: `sendPushToRole()` dari `@/lib/push` dipanggil saat insert alert merah (QA fail, selisih kas, komplain high, stok habis). Owner subscribe via banner di Dashboard. Service worker: `public/sw.js`.

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
| 3 | Resep/BOM + auto-deduct inventory | ✅ LIVE |
| 3 | Complaint & Insiden UI | ✅ LIVE |
| 3 | PWA (manifest + install banner) | ✅ LIVE (manifest/icon ada, install banner belum dibuat) |
| 3 | Nomor Meja (dine_in) | ✅ LIVE |
| 3 | Laporan Mingguan/Bulanan | ⚠️ Tergantikan oleh Analytics (tren harian 7/30 hari) |
| 4 | Voucher & Diskon | ✅ LIVE |
| 4 | Analytics (menu terlaris, jam tersibuk, tren) | ✅ LIVE |
| 4 | COGS per menu (margin profit) | ✅ LIVE |
| 4 | Staff Performance Dashboard (KPI) | ✅ LIVE |
| 5 | Toggle "Habis" di POS + soft-block order stok 0 (server 409) | ✅ LIVE |
| 5 | Opening Checklist pra-buka | ✅ LIVE |
| 5 | Push Notification ke owner (Web Push/VAPID) | ✅ LIVE (perlu tes device asli — headless tak bisa verifikasi delivery) |
| 5 | Purchase Receiving (supplier wajib + audit trail) | ✅ LIVE |
| 5 | Staff PIN Change (self-service) + rate limit PIN | ✅ LIVE |
| 5 | Analytics lanjutan (channel split, day-of-week, menu engineering, voucher report) | ✅ LIVE |
| 5 | Tenant pause/"TUTUP" eksplisit di dashboard | ✅ LIVE |

> ⚠️ **Keamanan:** kredensial Supabase (service_role key, DB password, sbp token) sempat tampil plaintext di transkrip chat saat dev sesi Sprint 5 → WAJIB di-rotate di dashboard. Format API key baru `sb_publishable_`/`sb_secret_` sudah dikonfirmasi kompatibel (key tidak pernah di-decode sbg JWT, cuma diteruskan sbg header `apikey`).

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
