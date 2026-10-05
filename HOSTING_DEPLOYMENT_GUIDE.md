# 🌐 Panduan Lengkap Deployment & Hosting: App Database

Dokumentasi ini menjelaskan langkah demi langkah cara meng-upload dan menjalankan aplikasi **App Database** di berbagai jenis layanan hosting (cPanel, VPS Linux, atau Cloud PaaS), menghubungkannya dengan database pengguna (**PostgreSQL** atau **MySQL**), serta mengonfigurasi pengiriman kode verifikasi OTP melalui akun Google (Gmail).

---

## 📑 Daftar Isi
1. [Arsitektur Keamanan Siber (Cybersecurity)](#1-arsitektur-keamanan-siber)
2. [Menyiapkan Database Pengguna (PostgreSQL / MySQL)](#2-menyiapkan-database-pengguna)
3. [Menyiapkan Pengiriman Kode OTP via Google (Gmail)](#3-menyiapkan-pengiriman-kode-otp-via-google)
4. [Panduan Deploy di cPanel / Shared Hosting](#4-panduan-deploy-di-cpanel--shared-hosting)
5. [Panduan Deploy di VPS Linux (Ubuntu + Nginx + PM2)](#5-panduan-deploy-di-vps-linux-ubuntu--nginx--pm2)
6. [Panduan Deploy di Cloud PaaS (Railway / Render / Supabase)](#6-panduan-deploy-di-cloud-paas-railway--render)
7. [Checklist Keamanan Sebelum Go-Live](#7-checklist-keamanan-sebelum-go-live)

---

## 1. Arsitektur Keamanan Siber

Aplikasi ini telah dilengkapi lapisan keamanan tingkat enterprise:
- **Hashing Password (Bcrypt 12 Rounds)**: Kata sandi pengguna dienkripsi dengan salt dinamis, aman dari serangan *rainbow tables* dan *offline dictionary attacks*.
- **Enkripsi Kredensial Database (AES-256-GCM)**: Password koneksi database eksternal yang disimpan pengguna dienkripsi di level kolom basis data dengan *Initialization Vector (IV)* acak dan *Authentication Tag*. Bahkan jika database pengguna bocor, password database eksternal tetap tidak dapat dibaca tanpa *master key*.
- **Isolasi Data Per-Akun (Multi-Tenant)**: Setiap kueri data koneksi, riwayat, dan query tersimpan difilter secara ketat dengan `user_id` dari JWT token yang diverifikasi di server (`WHERE user_id = $1`). User A tidak akan pernah bisa mengakses atau melihat data User B.
- **Anti-Brute Force & Rate Limiting**:
  - Batas percobaan login salah (maksimal 10x per 15 menit per IP).
  - Batas verifikasi OTP salah (maksimal 5x salah sebelum kode verifikasi otomatis hangus dan dikunci).
  - Masa berlaku kode OTP adalah 10 menit dengan angka acak kriptografis (`crypto.randomInt`).
- **Keamanan Header HTTP (Helmet)**: Dilengkapi proteksi CSP, X-Frame-Options (anti-clickjacking), X-Content-Type-Options (anti-sniffing), dan HSTS (wajib HTTPS).
- **Audit Trail Log**: Setiap upaya login, pendaftaran, dan verifikasi dicatat secara rapi di tabel `user_audit_logs` bersama alamat IP dan *user-agent*.

---

## 2. Menyiapkan Database Pengguna (Pilih Salah Satu)

Aplikasi ini dilengkapi **fitur otomatisasi penuh**: semua tabel yang dibutuhkan (`users`, `user_connections`, `user_saved_queries`, `user_settings`, `user_audit_logs`) serta indeks akan **dibuat otomatis** saat pertama kali server dijalankan.

### 🌟 Opsi A: Otomatis (Zero-Config / SQLite) — Paling Mudah!
**Tidak perlu membuat database apapun di hosting!**
- Biarkan konfigurasi database di `.env` kosong atau gunakan nilai default.
- Aplikasi akan otomatis membuat file database lokal (`users_data.db`) dan seluruh tabelnya.
- Jika hosting Anda memiliki keterbatasan kompilasi modul C++ (native), sistem secara cerdas beralih ke penyimpanan file JSON lokal murni (`users_data.json`) sehingga aplikasi dijamin **tidak pernah crash**.

### ⚡ Opsi B: Supabase (Cloud PostgreSQL) — Sangat Direkomendasikan
Jika Anda ingin database cloud gratis dan aman:
1. Buat proyek baru di [Supabase](https://supabase.com).
2. Buka **Project Settings** ➔ **Database** ➔ bagian **Connection string (URI)**.
3. Salin URI koneksi PostgreSQL (tersedia mode Direct port `5432` atau Transaction Pooler port `6543`).
4. Tempelkan ke file `.env` di server hosting Anda:
```env
DATABASE_URL=postgresql://postgres:[PASSWORD-ANDA]@db.[PROJECT-REF].supabase.co:5432/postgres
```
> **Catatan**: SSL akan dideteksi dan diaktifkan secara otomatis. Seluruh skema tabel pengguna akan dibuat secara otomatis ke Supabase Anda saat pertama kali aplikasi dijalankan! Tidak perlu menjalankan script SQL manual di dashboard Supabase.

### 🐬 Opsi C: MySQL (Bawaan cPanel Hosting)
Jika Anda lebih suka menggunakan MySQL lokal cPanel:
1. Buka cPanel ➔ **MySQL Databases**.
2. Buat database baru (mis. `user_appdatabase`) dan pengguna MySQL baru.
3. Hubungkan pengguna tersebut ke database dengan hak akses **ALL PRIVILEGES**.
4. Isi file `.env`:
```env
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=user_appdatabase
DB_USER=user_dbuser
DB_PASSWORD=PasswordMySQLAnda
DB_SSL=false
```
> Seluruh tabel MySQL akan dibuatkan secara otomatis oleh server saat startup.

---

## 3. Menyiapkan Pengiriman Kode OTP via Google (Gmail)

Agar sistem dapat mengirimkan kode verifikasi 6 digit langsung ke email Google/Gmail pengguna:

1. Buka akun Google Anda di [https://myaccount.google.com/](https://myaccount.google.com/).
2. Masuk ke menu **Keamanan (Security)**.
3. Pastikan **Verifikasi 2 Langkah (2-Step Verification)** sudah aktif.
4. Buka halaman pembuatan **Sandi Aplikasi (App Passwords)** di: [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
5. Masukkan nama aplikasi (misalnya `App Database`), lalu klik **Buat (Create)**.
6. Google akan memberikan **16 karakter kode sandi** (contoh: `abcd efgh ijkl mnop`).
7. Salin kode tersebut ke file `.env`:
```env
GMAIL_USER=alamat_email_anda@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
```

> **Catatan Mode Development:** Jika Anda belum mengisi `GMAIL_USER` dan `GMAIL_APP_PASSWORD`, aplikasi akan tetap berjalan lancar. Di mode development, kode OTP akan disimulasikan di terminal konsol agar Anda dapat langsung menguji login dan pendaftaran tanpa hambatan.

---

## 4. Panduan Deploy di cPanel / Shared Hosting

Jika hosting Anda menggunakan cPanel dengan fitur **Setup Node.js App** (atau Node.js App Manager):

### Langkah 1: Buat Paket Siap Deploy
Di komputer lokal Anda, jalankan skrip pembuat paket otomatis:
```bash
bash build-deploy.sh
```
Skrip ini akan mengompilasi frontend dan membuat file arsip **`app-database-deploy.zip`** (~1.2 MB) yang bersih, teruji, dan siap upload.

### Langkah 2: Upload & Ekstrak File di cPanel
1. Masuk ke **cPanel File Manager**.
2. Masuk ke folder aplikasi Anda (misalnya `/home/username/app-database/` atau folder root domain Anda).
3. Upload file `app-database-deploy.zip` lalu klik kanan dan pilih **Extract**.
4. Salin/rename file `.env.example` menjadi `.env` lalu sesuaikan pengaturannya (kosongkan database untuk otomatis SQLite, atau tempel URL Supabase).

### Langkah 3: Konfigurasi Node.js di cPanel
1. Di cPanel, buka menu **Setup Node.js App** (atau *Node.js Selector*).
2. Klik tombol **Create Application**.
3. Isi konfigurasi berikut:
   - **Node.js version**: Pilih versi **18.x** atau **20.x** (LTS).
   - **Application mode**: `Production`.
   - **Application root**: `app-database` (nama folder tempat Anda mengekstrak ZIP).
   - **Application URL**: Pilih domain atau subdomain Anda.
   - **Application startup file**: `app.js`.
4. Klik tombol **Create**.

### Langkah 4: Install Dependencies & Jalankan
1. Di panel aplikasi cPanel yang baru dibuat, klik tombol **Run NPM Install**. Seluruh modul backend akan diinstall secara otomatis.
2. Klik tombol **Start Application** (atau **Restart**).
3. Buka domain/subdomain Anda di browser. Halaman App Database akan langsung termuat sempurna!

---

## 5. Panduan Deploy di VPS Linux (Ubuntu + Nginx + PM2)

Panduan ini untuk server VPS mandiri (DigitalOcean, Linode, AWS EC2, IDCloudHost, Biznet Gio, dll.):

### Langkah 1: Persiapan Server
```bash
# Update sistem
sudo apt update && sudo apt upgrade -y

# Install Node.js (v20 LTS) & Git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx

# Install PM2 Process Manager global
sudo npm install -g pm2
```

### Langkah 2: Clone & Build Proyek
```bash
cd /var/www
sudo git clone https://github.com/username/app-database.git
sudo chown -R $USER:$USER /var/www/app-database
cd /var/www/app-database

# Install dependencies backend & frontend
cd backend && npm install --production
cd ../frontend && npm install && npm run build
cd ..
```

### Langkah 3: Siapkan File `.env`
```bash
cp .env.example .env
nano .env
# Masukkan konfigurasi database, JWT secret, dan Gmail SMTP Anda. Simpan (Ctrl+O) lalu keluar (Ctrl+X).
```

### Langkah 4: Jalankan Server dengan PM2
```bash
# Jalankan backend
pm2 start backend/server.js --name "app-database"
pm2 save
pm2 startup
```

### Langkah 5: Konfigurasi Nginx Reverse Proxy
Buat file konfigurasi Nginx:
```bash
sudo nano /etc/nginx/sites-available/app-database
```
Tempelkan konfigurasi berikut (ganti `yourdomain.com` dengan domain Anda):
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Aktifkan konfigurasi dan restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/app-database /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Langkah 6: Pasang Sertifikat SSL Gratis (HTTPS)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 6. Panduan Deploy di Cloud PaaS (Railway / Render)

### Railway
1. Buat akun di [Railway.app](https://railway.app/).
2. Klik **New Project** -> **Provision PostgreSQL** (Railway akan otomatis menyediakan database PostgreSQL gratis).
3. Klik **New** -> **GitHub Repo** -> pilih repositori App Database Anda.
4. Di tab **Variables**, masukkan variabel lingkungan:
   - `DB_TYPE=postgres`
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
   - `JWT_SECRET=rahasia_anda`
   - `ENCRYPTION_SECRET=kunci_master_aes256_32karakter!`
   - `GMAIL_USER=...`
   - `GMAIL_APP_PASSWORD=...`
5. Railway akan otomatis mendeteksi Node.js, melakukan build frontend, dan meluncurkan aplikasi dengan HTTPS aktif!

---

## 7. Checklist Keamanan Sebelum Go-Live

- [x] Pastikan `JWT_SECRET` diganti dengan string acak yang sulit ditebak (minimal 32 karakter).
- [x] Pastikan `ENCRYPTION_SECRET` telah diganti dan disimpan di tempat aman (karena kunci ini digunakan untuk mendekripsi password database pengguna).
- [x] Pastikan HTTPS / SSL telah aktif di domain Anda (diwajibkan untuk keamanan cookie dan pengiriman data kredensial).
- [x] Uji pengiriman email kode OTP dengan mendaftarkan akun email asli Anda.
- [x] Cek menu **Keamanan** di pojok kanan atas aplikasi untuk melihat log audit trail dan status enkripsi AES-256 yang aktif.

---
*Dibuat untuk App Database — Aman, Modern, dan Siap Produksi.*
