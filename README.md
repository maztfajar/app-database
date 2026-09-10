# ⚡ App Database

Aplikasi Database Client berbasis Web yang terinspirasi dari **Beekeeper Studio**, mendukung PostgreSQL dan demo SQLite lokal dengan tema antarmuka modern yang cepat, rapi, dan responsif.

> **Dibuat oleh Fajar Wahyudi**

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi ini terdiri dari dua bagian: **Backend (Node.js/Express)** dan **Frontend (React/Ant Design/Vite)**. Anda dapat menjalankannya dengan satu perintah mudah:

### Opsi 1: Menggunakan Shell Script (Rekomendasi Linux / macOS)
Buka terminal di folder ini, lalu jalankan:
```bash
./start.sh
```
*atau:*
```bash
bash start.sh
```

### Opsi 2: Menggunakan NPM
```bash
npm start
```

### Opsi 3: Di Windows
Cukup klik ganda file:
```cmd
start.bat
```

---

## 🌐 Alamat Akses

- **Frontend (Antarmuka Web)**: [http://localhost:5173](http://localhost:5173)
- **Backend API (Proxy)**: [http://localhost:3001](http://localhost:3001)

---

## ✨ Fitur Utama

1. **Dua Mode Koneksi**:
   - **Connection String Mode**: Cukup tempelkan URI (misal `postgresql://user:pass@host:port/dbname`), sistem otomatis memecah (*auto-split*) komponennya dengan tombol *Parse & Connect*.
   - **Manual Mode**: Input terpisah untuk host, port, database, username, dan password.
   - Tersedia Preset cepat: **SumoPod PG** dan **Demo SQLite**.
2. **Ingat Login & Auto-Reconnect**:
   - Sesi tersimpan aman di browser.
   - Saat browser di-refresh (`F5`), aplikasi otomatis tersambung kembali dan memulihkan tab tabel yang sedang dibuka tanpa berkedip ke halaman login.
   - Riwayat koneksi tersimpan untuk akses 1-klik.
3. **Manajemen Data & Struktur Sinkron**:
   - Urutan kolom pada bagian **Structure** dan **Data Records** tersinkronisasi dan tersimpan permanen di penyimpanan lokal browser.
   - Tombol geser kolom langsung: `⬆ / ⬇` di tabel struktur dan `⬅ / ➡` di judul kolom data.
   - Modal **Columns & Order** untuk mengatur tampilan dan visibilitas kolom.
4. **Operasi Data yang Aman & Cepat (CRUD)**:
   - Tambah baris (`+ Insert Row`), Edit baris (pensil), Hapus baris (tong sampah).
   - Atomic update yang aman untuk berbagai tipe data PostgreSQL (numeric, text, boolean, json, date/timestamp).
   - Urutan data deterministik stabil berpatokan pada Primary Key.
5. **SQL Query Editor & Ekspor CSV**:
   - Query editor interaktif dengan pintasan keyboard `Ctrl + Enter`.
   - Pencarian cepat tabel dengan pintasan keyboard `Ctrl + P`.
   - Ekspor tabel atau hasil query langsung ke format `.csv`.
