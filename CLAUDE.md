# PFOS — Pasar Family Operating System

> Baca file ini dulu sebelum menyentuh kode apapun.

## Konteks Bisnis

Owner (AJ, adysjunior1@gmail.com) punya **beberapa tenant di dalam Pasar Family** (bukan seluruh Pasar Family). Masalah utama: operasional bocor — uang kas tidak terhitung, pesanan salah, QA tidak jalan, laporan tidak ada. PFOS adalah sistem operasional internal untuk menutup semua lubang itu.

Owner **tidak selalu di lokasi**. Semua kontrol via HP (owner dashboard). Staff login pakai **PIN 4-6 digit** (bukan email/password). Interface **100% Bahasa Indonesia**. **Paperless** — tidak ada printer struk.

## Tenant Aktif

| Slug | Nama | Warna | Catatan |
|------|------|-------|---------|
| `bagia` | Bagia | #D97706 | Menu = TL tapi tanpa makanan berat |
| `tl` | Tujuh Legenda | #DC2626 | Menu lengkap. GoFood aktif. TANPA Nikudon |
| `hibiro` | Hibiro | #1D4ED8 | Brand Nikudon/Jepang. Di TL, brand ini = Hibiro |
| `ramen` | Ramen Family | #16A34A | 2 SKU: Ramen Original 20K, Ramen Spicy 25K. Es Teh bundled |
| `tjan` | Tjan | #6B7280 | **PAUSE** — menu ada di DB tapi semua inactive |

**Jam operasional semua tenant: 06:30–12:30. Batas closing: 13:30.**

## Staff & Roles

| Nama | Role | Tenant | Status |
|------|------|--------|--------|
| Owner | owner | semua | active |
| Om Tommy | supervisor + qa_checker | semua | active — **75 thn, UI harus 3 tombol besar** |
| Seli | kasir | Bagia | active |
| Putra | kitchen | TL | active |
| Bu Een | kitchen | Ramen + float TL | active |
| Nina | kasir | Ramen | active |
| Ardan | kitchen | Hibiro | **evaluation** — risiko dipecat, owner bisa deactivate instant |

Kasir bersifat **fleksibel**: siapa yang jaga = siapa kasir. Staff bisa pilih tenant saat login.

## Tech Stack

- **Next.js 14** App Router + TypeScript
- **Tailwind CSS** — mobile-first, touch target min 44px
- **Supabase** (PostgreSQL + Auth + Realtime + Storage)
- **@supabase/ssr** untuk session management
- **Auth**: PIN-based untuk staff (cookie `pfos_session`), Supabase Auth untuk owner
- **Deploy**: Vercel + domain `pasarfamily.my.id`

## Struktur File Penting

```
pfos-app/
├── src/
│   ├── types/index.ts          ← Semua TypeScript types + ROLE_HOME + formatRupiah
│   ├── middleware.ts            ← Route protection by pfos_session cookie
│   ├── lib/
│   │   ├── supabase/client.ts  ← Browser client
│   │   ├── supabase/server.ts  ← Server component client
│   │   └── supabase/admin.ts   ← Admin (service_role) — hanya API routes
│   └── app/
│       ├── api/
│       │   ├── auth/pin/       ← POST: verifikasi PIN → set cookie
│       │   ├── auth/logout/    ← POST: hapus cookie
│       │   ├── auth/session/   ← GET: baca session dari cookie
│       │   ├── users/          ← GET: list staff aktif untuk login screen
│       │   └── orders/         ← POST: buat order baru
│       └── app/
│           ├── login/          ← Staff grid + PIN keypad
│           ├── pos/            ← Input order (kasir)
│           ├── kitchen/        ← KDS antrian (kitchen)
│           ├── qa/             ← QA checklist (qa_checker, supervisor)
│           ├── cash/           ← Sesi kas (kasir)
│           ├── closing/        ← Laporan penutupan
│           ├── tasks/          ← Tugas harian
│           └── dashboard/      ← Owner dashboard anti-bocor
└── database/
    ├── schema.sql              ← Semua tabel + RLS + indexes
    ├── seed.sql                ← Data awal (5 tenant, 7 staff, menu lengkap)
    ├── functions.sql           ← RPC: verify_pin, get_user_session_data, dll
    └── README.md               ← Panduan setup Supabase
```

## Database — Tabel Utama

```sql
tenants          -- 5 tenant
users            -- 7 staff (PIN bcrypt di kolom pin_hash)
roles            -- owner|supervisor|kasir|kitchen|qa_checker|marketing_admin|viewer
user_roles       -- many-to-many, tenant_id nullable (null = semua tenant)
categories       -- per tenant
menu_items       -- price integer (Rupiah), status active/inactive
orders           -- status: pending→cooking→qa_pending→ready→completed|cancelled
order_items      -- qty + unit_price (snapshot saat order)
order_sequences  -- counter nomor order per tenant per hari
payments         -- cash atau qris
cash_sessions    -- sesi kas per tenant per hari, track selisih
cash_expenses    -- pengeluaran dari laci kas
kitchen_queue    -- antrian masak per order
qa_checks        -- checklist 6 poin per order
complaints       -- insiden / komplain
closing_reports  -- laporan harian
staff_tasks      -- tugas dari supervisor/owner
daily_todos      -- checklist harian
dashboard_alerts -- alert anti-bocor (severity: red|yellow|green)
```

## Supabase RPC Functions (database/functions.sql)

| Fungsi | Dipanggil dari |
|--------|----------------|
| `verify_user_pin(user_id, pin)` | POST /api/auth/pin |
| `get_user_session_data(user_id)` | POST /api/auth/pin |
| `next_order_sequence(tenant_id, date)` | POST /api/orders |
| `get_active_users_for_login()` | GET /api/users |
| `get_dashboard_summary(date)` | GET /api/dashboard |

## Session Cookie

Cookie `pfos_session` (httpOnly, 8 jam) berisi:
```typescript
{
  userId: string
  name: string
  primaryRole: RoleName
  homeTenantId: string | null
  selectedTenantId: string | null
  loginAt: number
}
```

Baca di server: `cookies().get('pfos_session')` lalu JSON.parse.
Baca di client: `fetch('/api/auth/session')`.

## Konvensi Coding

- **Semua UI Bahasa Indonesia** — error msg, label, tombol
- **Rupiah**: selalu `formatRupiah(amount)` dari `@/types`
- **Admin client** (`createAdminClient()`) hanya di API routes — jangan di komponen
- **Realtime**: subscribe ke tabel `orders`, `kitchen_queue`, `dashboard_alerts`
- **Nomor order format**: `[PREFIX]-[YYYYMMDD]-[SEQ3]` contoh: `TL-20260620-001`
- **Anti-bocor threshold**: selisih kas > Rp10.000 = alert merah
- **Touch targets**: min-h-[44px] + min-w-[44px] selalu
- Gunakan `active:scale-95 transition-transform duration-75` untuk feedback tap

## Alert Anti-Bocor

Dashboard owner harus tampilkan alert merah jika:
1. Selisih kas > Rp10.000
2. Closing report belum masuk setelah jam 13:30
3. QA fail
4. Komplain severity = high

## QRIS

Semua tenant pakai 1 QRIS stiker (GoPay Merchant). Kasir dapat notif di HP via app GoPay Merchant. Tidak ada rekonsiliasi otomatis — kasir input manual total QRIS saat closing.

## Environment Variables (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=
```

## Sprint Progress

| Hari | Halaman | Status |
|------|---------|--------|
| 1-2  | Scaffold + Auth + Login | ✅ DONE |
| 3-4  | POS | ✅ DONE |
| 5    | Kitchen KDS | ✅ DONE |
| 6    | QA Gate | ✅ DONE |
| 7    | Cash Session | ✅ DONE |
| 8    | Closing Report | ✅ DONE |
| 9    | Owner Dashboard | ✅ DONE |
| 10   | Tasks | ✅ DONE |
| 11   | PWA + offline | 🔜 |
| 12-14| Testing + training + go live | 🔜 |

## Commands

```bash
npm run dev          # Development server → localhost:3000
npm run build        # Build production
npm run lint         # ESLint check
git add . && git commit -m "feat: ..."
git push origin main # Push ke GitHub → Vercel auto-deploy
```

## Yang JANGAN Dilakukan

- Jangan tampilkan Nikudon di tenant TL (Tujuh Legenda) — brand itu = Hibiro
- Jangan hardcode kasir per tenant — kasir bisa lintas tenant
- Jangan commit `.env.local` ke Git
- Jangan gunakan `createAdminClient()` di komponen browser
- Jangan install library baru tanpa cek dulu apakah Tailwind + built-in bisa handle
- Jangan buat halaman dengan scroll horizontal (HP sempit)
