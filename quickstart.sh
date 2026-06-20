#!/bin/bash
# ============================================================
# PFOS Quickstart — Jalankan SEKALI di terminal laptop
# ============================================================
# Cara pakai:
#   chmod +x quickstart.sh
#   ./quickstart.sh

set -e
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   PFOS — Pasar Family Setup Script   ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# ─── Step 1: Cek Node.js ──────────────────────────────────
echo -e "${CYAN}[1/5] Cek Node.js...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js belum terinstall.${NC}"
  echo "   Download di: https://nodejs.org (pilih LTS)"
  exit 1
fi
NODE_VER=$(node -v)
echo -e "${GREEN}✅ Node.js $NODE_VER${NC}"

# ─── Step 2: npm install ──────────────────────────────────
echo ""
echo -e "${CYAN}[2/5] Install dependencies (npm install)...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies terinstall${NC}"

# ─── Step 3: Cek .env.local ───────────────────────────────
echo ""
echo -e "${CYAN}[3/5] Cek file .env.local...${NC}"
if [ ! -f ".env.local" ]; then
  cp .env.local.example .env.local
  echo -e "${YELLOW}⚠️  File .env.local dibuat dari template.${NC}"
  echo -e "${YELLOW}   Buka file .env.local dan isi 4 nilai ini:${NC}"
  echo ""
  echo "   NEXT_PUBLIC_SUPABASE_URL       → Supabase → Settings → Data API"
  echo "   NEXT_PUBLIC_SUPABASE_ANON_KEY  → Supabase → Settings → API Keys"
  echo "   SUPABASE_SERVICE_ROLE_KEY      → Supabase → Settings → API Keys → Legacy → service_role"
  echo "   SESSION_SECRET                 → Ketik bebas (contoh: pfos-rahasia-2026)"
  echo ""
  echo -e "${YELLOW}   Setelah diisi, jalankan script ini lagi.${NC}"
  exit 0
else
  # Cek apakah masih placeholder
  if grep -q "xxxxxxxxxxxxxxxxxxxx" .env.local; then
    echo -e "${RED}❌ .env.local masih berisi placeholder!${NC}"
    echo "   Isi dulu nilai Supabase URL, Anon Key, Service Role Key, dan Session Secret."
    exit 1
  fi
  echo -e "${GREEN}✅ .env.local ditemukan${NC}"
fi

# ─── Step 4: Git remote setup ─────────────────────────────
echo ""
echo -e "${CYAN}[4/5] Setup GitHub remote...${NC}"
if git remote | grep -q "origin"; then
  echo -e "${GREEN}✅ Remote origin sudah ada: $(git remote get-url origin)${NC}"
else
  echo -e "${YELLOW}⚠️  Belum ada GitHub remote.${NC}"
  echo ""
  echo "   Langkah:"
  echo "   1. Buka github.com → New Repository"
  echo "   2. Nama repo: pfos-pasar-family (Private)"
  echo "   3. Jangan centang 'Initialize this repository'"
  echo "   4. Jalankan perintah ini:"
  echo ""
  echo "      git remote add origin https://github.com/USERNAME/pfos-pasar-family.git"
  echo "      git push -u origin main"
  echo ""
  echo "   Ganti USERNAME dengan username GitHub kamu."
fi

# ─── Step 5: Jalankan dev server ──────────────────────────
echo ""
echo -e "${CYAN}[5/5] Menjalankan development server...${NC}"
echo -e "${GREEN}✅ Buka browser: http://localhost:3000${NC}"
echo -e "${YELLOW}   (Tekan Ctrl+C untuk stop)${NC}"
echo ""
npm run dev
