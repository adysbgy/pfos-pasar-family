# PFOS Sprint 3 — Claude Code Prompt

> Baca CLAUDE.md dulu sebelum mulai. File ini adalah instruksi kerja Sprint 3.

---

## Konteks Sprint 3

Sprint 1 & 2 sudah live di pasarfamily.my.id. Sprint 3 menutup lubang anti-bocor yang tersisa dan menambah fitur operasional kritis.

**Yang harus dibangun Sprint 3 (urutan prioritas):**

1. **Resep / BOM** — auto-deduct inventory saat order masuk ← PALING PENTING
2. **Complaint & Insiden UI** — tabel DB sudah ada, tinggal UI
3. **PWA** — install di homescreen HP staff
4. **Nomor Meja** — dine_in order harus ada nomor meja
5. **Laporan Mingguan** — extend halaman laporan yang sudah ada

---

## FITUR 1: Resep / BOM (Bill of Materials)

### Mengapa ini kritis
Tanpa resep, inventory bisa diisi palsu. Dengan resep: 1 order Mie Goreng = sistem otomatis kurangi 200gr mie + 2 butir telur dari stok. Kalau stok aktual berkurang lebih dari yang seharusnya = ada kebocoran.

### Database (jalankan di Supabase SQL Editor)

Buat file `database/sprint3_recipes.sql`:

```sql
-- Tabel resep: link menu_item → inventory_item + qty per porsi
CREATE TABLE recipes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id  UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  qty_per_portion NUMERIC(10,3) NOT NULL, -- bisa desimal, misal 0.2 kg
  unit          TEXT NOT NULL,            -- harus sama dengan inventory_items.unit
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(menu_item_id, inventory_item_id)
);

CREATE INDEX idx_recipes_menu_item ON recipes(menu_item_id);
CREATE INDEX idx_recipes_inv_item  ON recipes(inventory_item_id);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON recipes FOR ALL TO authenticated USING (true);

-- RPC: deduct_inventory_for_order
-- Dipanggil setelah order berhasil dibuat
-- Loop semua order_items → cari resep → panggil adjust_inventory_stock
CREATE OR REPLACE FUNCTION deduct_inventory_for_order(p_order_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item      RECORD;
  v_recipe    RECORD;
  v_deducted  INT := 0;
  v_errors    TEXT[] := '{}';
BEGIN
  -- Loop semua item dalam order
  FOR v_item IN
    SELECT oi.menu_item_id, oi.quantity
      FROM order_items oi
     WHERE oi.order_id = p_order_id
  LOOP
    -- Loop semua resep untuk menu item ini
    FOR v_recipe IN
      SELECT r.inventory_item_id, r.qty_per_portion, r.unit
        FROM recipes r
       WHERE r.menu_item_id = v_item.menu_item_id
    LOOP
      BEGIN
        PERFORM adjust_inventory_stock(
          v_recipe.inventory_item_id,
          'usage',
          -ROUND(v_recipe.qty_per_portion * v_item.quantity)::INT,
          'Auto-deduct dari order #' || p_order_id::TEXT,
          NULL
        );
        v_deducted := v_deducted + 1;
      EXCEPTION WHEN OTHERS THEN
        -- Stok habis tapi order tetap jalan — catat error saja
        v_errors := array_append(v_errors, SQLERRM);
      END;
    END LOOP;
  END LOOP;

  RETURN json_build_object(
    'deducted', v_deducted,
    'errors', v_errors
  );
END;
$$;
```

### API Routes

**`src/app/api/recipes/route.ts`**
- `GET ?menuItemId=xxx` → list resep untuk 1 menu item
- `GET ?tenantId=xxx` → list semua resep untuk 1 tenant (untuk halaman manajemen)
- `POST` → tambah resep baru `{ menuItemId, inventoryItemId, qtyPerPortion, unit, notes }`
- `DELETE ?id=xxx` → hapus resep

### Update POST /api/orders

Di `src/app/api/orders/route.ts`, **setelah** insert kitchen_queue (langkah 7), tambahkan:

```typescript
// 10. Auto-deduct inventory berdasarkan resep
const { error: deductErr } = await supabase.rpc('deduct_inventory_for_order', {
  p_order_id: order.id,
})
if (deductErr) {
  // Log error tapi jangan gagalkan order
  console.error('deduct_inventory_for_order error:', deductErr)
}
```

### UI: src/app/app/recipes/page.tsx

Halaman manajemen resep untuk owner. Flow:
1. Pilih tenant → tampil daftar menu item aktif
2. Tap menu item → tampil daftar bahan (resep) untuk item itu
3. Tombol "+ Tambah Bahan" → form: pilih inventory item dari dropdown, isi qty per porsi
4. Swipe/tombol hapus untuk remove bahan dari resep

Layout setiap menu item di list:
```
[Nama Menu]                    [2 bahan] →
Mie Goreng                     Mie 200gr, Telur 2 butir
```

Warna indikator:
- ✅ Hijau: ada resep
- ⚪ Abu: belum ada resep (manual)

**Tambah ke nav owner** di `src/app/app/layout.tsx`:
```typescript
{ href: '/app/recipes', icon: '📋', label: 'Resep' },
```

---

## FITUR 2: Complaint & Insiden UI

### Tabel DB yang sudah ada (schema.sql)

Cek dulu struktur tabel `complaints` di Supabase. Kemungkinan kolom:
- `id`, `tenant_id`, `reported_by`, `type`, `description`, `severity` (low/medium/high), `status` (open/resolved), `created_at`

Kalau kolom berbeda, sesuaikan. Jangan ubah struktur DB — sesuaikan kode ke DB.

### API: src/app/api/complaints/route.ts
- `GET ?tenantId=xxx&status=open` → list komplain
- `POST` → buat komplain baru `{ tenantId, type, description, severity }`
- `PATCH` → update status (resolve)

### UI: src/app/app/complaints/page.tsx

**Penting: Om Tommy (supervisor, 75 tahun) adalah user utama halaman ini.**

Design khusus Om Tommy:
- 3 tombol besar di atas (min-h-20, text-xl):
  - 🍽️ **Piring Kotor/Kotor** (type: `cleanliness`, severity: `medium`)
  - 😤 **Komplain Tamu** (type: `complaint`, severity: `high`)
  - ❌ **Menu Salah** (type: `wrong_order`, severity: `high`)
- Tap salah satu → langsung ke form simpel: textarea catatan + tombol KIRIM LAPORAN besar
- List komplain hari ini di bawah (collapsed by default)
- Owner bisa resolve dari dashboard

**Tambah ke nav supervisor dan owner:**
```typescript
{ href: '/app/complaints', icon: '🚨', label: 'Insiden' },
```

---

## FITUR 3: PWA

### src/app/manifest.ts

```typescript
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PFOS — Pasar Family',
    short_name: 'PFOS',
    description: 'Sistem Operasional Pasar Family',
    start_url: '/app/login',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#111111',
    orientation: 'portrait',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
```

### public/icon-192.png dan public/icon-512.png

Buat ikon sederhana dengan canvas atau gunakan placeholder. Ikon harus ada file fisiknya agar PWA valid. Buat dengan Node.js script:

```bash
# Jalankan sekali untuk generate ikon
node -e "
const { createCanvas } = require('canvas');
// Kalau canvas tidak ada, buat manual atau skip dulu
"
```

Kalau `canvas` tidak tersedia, buat file SVG sebagai icon sementara dan convert, atau buat ikon dengan cara berikut menggunakan pure Node:

```javascript
// scripts/generate-icons.js
const fs = require('fs')

// SVG sederhana untuk ikon PFOS
const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192">
  <rect width="192" height="192" fill="#111111" rx="24"/>
  <text x="96" y="120" font-family="Arial" font-size="72" font-weight="bold" 
        fill="white" text-anchor="middle">PF</text>
</svg>`

fs.writeFileSync('public/icon-192.svg', svg192)
// Untuk PNG, gunakan icon-192.svg sebagai fallback atau generate via browser
```

Alternatif termudah: simpan file PNG placeholder 192x192 dan 512x512 di `public/`.

### src/app/layout.tsx (root layout)

Tambahkan meta tags PWA:
```tsx
export const metadata: Metadata = {
  // ... existing
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PFOS',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}
```

### Install Banner Component

Buat `src/components/InstallBanner.tsx` — banner muncul di login page kalau belum install PWA:

```
┌─────────────────────────────────────┐
│ 📱 Install PFOS di HP kamu          │
│ Buka lebih cepat, tanpa browser     │
│                    [Install] [Nanti] │
└─────────────────────────────────────┘
```

Gunakan `beforeinstallprompt` event. Simpan prompt di state, tampilkan banner, tombol Install trigger prompt.

---

## FITUR 4: Nomor Meja

### Database

```sql
-- Tambah kolom table_number ke orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number TEXT;
```

Jalankan di Supabase SQL Editor (simpan di `database/sprint3_table_number.sql`).

### Update POS (src/app/app/pos/page.tsx)

Setelah channel selector, kalau channel = `dine_in`, tampilkan input nomor meja:

```tsx
{channel === 'dine_in' && (
  <div className="px-4 py-2 bg-white border-b border-gray-100">
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">Meja:</span>
      <div className="flex gap-2">
        {['1','2','3','4','5','6','7','8'].map(n => (
          <button key={n} onClick={() => setTableNumber(n)}
            className={`w-9 h-9 rounded-lg text-sm font-bold border-2 transition-all
              ${tableNumber === n ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200'}`}>
            {n}
          </button>
        ))}
        <input type="tel" placeholder="..." value={tableNumber}
          onChange={e => setTableNumber(e.target.value)}
          className="w-12 h-9 border-2 border-gray-200 rounded-lg text-center text-sm font-bold focus:border-gray-900 outline-none" />
      </div>
    </div>
  </div>
)}
```

Tambah state: `const [tableNumber, setTableNumber] = useState('')`

Kirim ke API: tambahkan `tableNumber` di body POST /api/orders.

### Update Kitchen KDS (src/app/app/kitchen/page.tsx)

Di setiap card order, tampilkan nomor meja prominently:
```tsx
{order.channel === 'dine_in' && order.table_number && (
  <div className="bg-yellow-400 text-yellow-900 font-bold text-lg px-3 py-1 rounded-lg">
    Meja {order.table_number}
  </div>
)}
```

### Update API orders/route.ts

Terima dan simpan `tableNumber` dari body:
```typescript
const { ..., tableNumber } = body
// Di insert orders:
table_number: tableNumber || null,
```

---

## FITUR 5: Laporan Mingguan

### Update src/app/app/reports/page.tsx

Tambah toggle mode di header:
```
[Harian] [Mingguan] [Bulanan]
```

Untuk **mingguan**: tampilkan 7 hari terakhir, bar chart sederhana per hari (CSS bars, tanpa library).

Untuk **bulanan**: tampilkan 30 hari, total per tenant.

### API baru: src/app/api/reports/range/route.ts

```
GET /api/reports/range?from=2026-06-01&to=2026-06-21
```

Response: array per tanggal dengan `{ date, totalRevenue, totalOrders }` untuk semua tenant.

---

## Urutan Pengerjaan

1. Jalankan SQL di Supabase: `sprint3_recipes.sql` dan `sprint3_table_number.sql`
2. Build Fitur 1 (Resep): API → update orders → UI
3. Build Fitur 2 (Complaint): API → UI
4. Build Fitur 3 (PWA): manifest + meta + install banner
5. Build Fitur 4 (Meja): SQL sudah jalan → update POS + KDS + API
6. Build Fitur 5 (Laporan range): API + UI update

---

## Hal-hal Penting

**Jangan lupa:**
- Update `CLAUDE.md` setelah selesai — tambahkan tabel `recipes`, `complaints` ke section database, dan semua route baru ke struktur file
- Commit setiap fitur terpisah: `git commit -m "Sprint 3: Resep BOM"`, dst
- Test di localhost dulu sebelum push

**Yang JANGAN dilakukan:**
- Jangan ubah struktur tabel yang sudah ada (`orders`, `menu_items`, dll) kecuali yang disebutkan di atas
- Jangan tampilkan Nikudon di tenant Tujuh Legenda
- Jangan commit `.env.local`
- Jangan install npm package baru — gunakan built-in atau Tailwind

**Cek error TypeScript sebelum push:**
```bash
npm run build
```
Kalau ada error, fix dulu. Jangan push kode yang build-nya gagal.

---

## Setelah Sprint 3 Selesai

Sprint 4 (Marketing):
- Voucher & Diskon (kode promo per tenant)
- Analytics: menu terlaris, jam tersibuk, tren penjualan
- COGS per menu item (biaya bahan vs harga jual)
- Staff performance dashboard (KPI per orang)
