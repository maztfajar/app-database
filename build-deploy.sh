#!/bin/bash
# ==============================================================================
#  SCRIPT PEMBUAT PAKET DEPLOYMENT UNTUK cPANEL HOSTING
#  Jalankan: bash build-deploy.sh
#  Output: app-database-deploy.zip (siap upload ke cPanel File Manager)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
OUTPUT_ZIP="$PROJECT_DIR/app-database-deploy.zip"
TEMP_DIR="$PROJECT_DIR/.deploy_temp"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  🚀 App Database — Build Deploy Package untuk cPanel ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── STEP 1: Build Frontend ──────────────────────────────────────────────────
echo "📦 [1/4] Building frontend React (Vite)..."
cd "$PROJECT_DIR/frontend"
npm install --silent
npm run build
echo "✅ Frontend berhasil di-build → frontend/dist/"

# ── STEP 2: Bersihkan temp dir ───────────────────────────────────────────────
echo ""
echo "🗂️  [2/4] Menyiapkan folder sementara..."
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# ── STEP 3: Salin file yang diperlukan ──────────────────────────────────────
echo ""
echo "📋 [3/4] Menyalin file ke paket deployment..."

# Root files
cp "$PROJECT_DIR/app.js"                "$TEMP_DIR/"
cp "$PROJECT_DIR/package.json"          "$TEMP_DIR/"
if [ -f "$PROJECT_DIR/.env.example" ]; then
  cp "$PROJECT_DIR/.env.example"        "$TEMP_DIR/.env.example"
fi
if [ -f "$PROJECT_DIR/HOSTING_DEPLOYMENT_GUIDE.md" ]; then
  cp "$PROJECT_DIR/HOSTING_DEPLOYMENT_GUIDE.md" "$TEMP_DIR/"
fi

# Salin node_modules siap pakai (Pure JS, tanpa perlu npm install di cPanel!)
echo "📦 Menyertakan node_modules produksi (siap pakai tanpa npm install di hosting)..."
mkdir -p "$TEMP_DIR/node_modules"
cp -r "$PROJECT_DIR/node_modules/"* "$TEMP_DIR/node_modules/"
# Hapus better-sqlite3 native binary agar 100% pure JavaScript dan portabel di semua hosting
rm -rf "$TEMP_DIR/node_modules/better-sqlite3" "$TEMP_DIR/node_modules/node-addon-api"

# Backend - salin file backend
mkdir -p "$TEMP_DIR/backend"
cp "$PROJECT_DIR/backend/server.js"      "$TEMP_DIR/backend/"
cp "$PROJECT_DIR/backend/package.json"   "$TEMP_DIR/backend/"

# Backend src (routes, middleware, db, utils) — salin langsung
cp -r "$PROJECT_DIR/backend/src"         "$TEMP_DIR/backend/src"

# Frontend dist (file hasil build)
mkdir -p "$TEMP_DIR/frontend"
cp -r "$PROJECT_DIR/frontend/dist/"     "$TEMP_DIR/frontend/dist/"

# ── STEP 4: Buat ZIP ─────────────────────────────────────────────────────────
echo ""
echo "🗜️  [4/4] Membuat file ZIP (termasuk node_modules siap pakai)..."
rm -f "$OUTPUT_ZIP"
cd "$TEMP_DIR"
zip -r "$OUTPUT_ZIP" . -x "*.DS_Store" "*.gitkeep"
cd "$PROJECT_DIR"

# Bersihkan temp
rm -rf "$TEMP_DIR"

# ── Selesai! ─────────────────────────────────────────────────────────────────
ZIP_SIZE=$(du -sh "$OUTPUT_ZIP" | cut -f1)
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✅ PAKET DEPLOY SIAP PAKAI BERHASIL DIBUAT!         ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  📁 File: app-database-deploy.zip ($ZIP_SIZE)        ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  🎉 ANDA TIDAK PERLU KLIK 'RUN NPM INSTALL' LAGI!   ║"
echo "║                                                      ║"
echo "║  📌 LANGKAH DI CPANEL:                               ║"
echo "║  1. Upload ZIP ke File Manager cPanel                ║"
echo "║  2. Extract ke folder aplikasi                       ║"
echo "║  3. Edit/rename .env.example → .env                  ║"
echo "║  4. Buka cPanel → Setup Node.js App                  ║"
echo "║  5. Klik tombol 'Restart' (atau Start Application)   ║"
echo "║  ✨ APLIKASI LANGSUNG BERJALAN 100%!                 ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
