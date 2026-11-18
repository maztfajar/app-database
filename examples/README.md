# 📦 App Database — Example Databases (PostgreSQL & MySQL)

Folder ini berisi skema database dan data contoh (*sample data*) lengkap untuk **PostgreSQL** dan **MySQL / MariaDB**. Dirancang khusus untuk pengujian fitur, eksplorasi kueri analitik, pengujian performa, dan demonstrasi pada **App Database Client**.

---

## 🗂️ Isi Berkas

| File | Deskripsi |
| :--- | :--- |
| `postgres_example.sql` | Skrip DDL + DML lengkap untuk PostgreSQL (Mendukung `SERIAL`, `JSONB`, `TIMESTAMP WITH TIME ZONE`, Relasi Foreign Key). |
| `mysql_example.sql` | Skrip DDL + DML lengkap untuk MySQL / MariaDB (Mendukung `AUTO_INCREMENT`, `JSON`, `DATETIME`, `InnoDB`, `utf8mb4`). |
| `seed.js` | Skrip seeder otomatis berbasis Node.js untuk mengeksekusi data contoh ke database target secara langsung. |

---

## 🏗️ Struktur Tabel Contoh

Kedua skrip database berisi skema sistem bisnis & E-Commerce terintegrasi:

1. **`departments`** (Departemen perusahaan: Engineering, Product, Sales, Finance, HR)
2. **`employees`** (Data karyawan dengan relasi departemen, gaji, jabatan, status aktif)
3. **`customers`** (Data pelanggan, kontak, kota, preferensi belanja dalam format `JSON/JSONB`, status VIP)
4. **`product_categories`** (Kategori produk: Electronics, Office, Fashion, Smart Home)
5. **`products`** (Katalog produk, SKU unik, harga, stok, spesifikasi teknis `JSON/JSONB`)
6. **`orders`** (Data pesanan, nomor transaksi unik, status, kota pengiriman, metode pembayaran)
7. **`order_items`** (Rincian item produk dalam pesanan, jumlah, harga satuan, subtotal)
8. **`activity_logs`** (Log aktivitas audit sistem, event type, aktor, metadata `JSON`, alamat IP)

---

## 🚀 3 Cara Menggunakan Example Database

### Cara 1: Menggunakan Tombol di Web UI App Database (Paling Mudah)
1. Buka aplikasi **App Database** di peramban (`http://localhost:3001` atau `http://localhost:5173`).
2. Hubungkan ke database Anda (PostgreSQL, MySQL, atau SQLite).
3. Klik tombol **`Example DB`** di bagian atas (Header) atau menu sidebar.
4. Klik konfirmasi **"Ya, Buat Example Database"**.
5. Sistem akan otomatis mengeksekusi skema dan seluruh data contoh ke database Anda secara instan!

---

### Cara 2: Menggunakan Skrip Seeder Node.js (`seed.js`)

#### Untuk SQLite (Langsung Jalan Tanpa Perlu Server/Port):
```bash
node examples/seed.js --type sqlite --database demo.db
```

#### Untuk PostgreSQL:
```bash
# Menggunakan connection string URI
node examples/seed.js --type postgres --uri "postgresql://postgres:password@localhost:5432/my_database"

# Atau menggunakan parameter individual
node examples/seed.js --type postgres --host localhost --port 5432 --user postgres --password rahasia --database my_database
```

#### Untuk MySQL:
```bash
# Pastikan server MySQL lokal Anda sudah aktif di port 3306 terlebih dahulu:
node examples/seed.js --type mysql --host localhost --port 3306 --user root --password rahasia --database my_database
```

---

## ⚠️ Troubleshooting Error Port 3306 (ECONNREFUSED)

Jika Anda mendapatkan pesan:
`❌ Gagal terhubung ke port 3306 di localhost (ECONNREFUSED)`

**Penyebab:**
Layanan server MySQL belum aktif atau belum terinstall di komputer Anda. Perintah `seed.js` berfungsi untuk **mengisi data ke database yang sudah aktif**, bukan membuat server MySQL baru.

**Solusi:**
1. **Nyalakan MySQL:**
   - **XAMPP / Laragon:** Buka aplikasinya, klik **Start** pada modul MySQL.
   - **Docker:** Jalankan `docker run --name mysql-dev -e MYSQL_ROOT_PASSWORD=rahasia -p 3306:3306 -d mysql:8`
   - **Linux:** Jalankan `sudo systemctl start mysql`
2. **Gunakan Cloud Database Gratis:** Anda bisa menggunakan database MySQL gratis di cloud (seperti Aiven atau Clever Cloud) dan mengisinya dengan opsi `--uri "mysql://..."`.
3. **Gunakan SQLite (Tanpa Perlu Setup Port):** Jalankan `node examples/seed.js --type sqlite --database demo.db` untuk membuat database contoh secara instan tanpa perlu port server apa pun.

---

### Cara 3: Menggunakan Command Line Database (CLI)

#### Import ke PostgreSQL (`psql`):
```bash
# Membuat database baru (opsional)
createdb -U postgres example_ecommerce

# Menjalankan file SQL
psql -U postgres -d example_ecommerce -f examples/postgres_example.sql
```

#### Import ke MySQL (`mysql`):
```bash
# Membuat database baru (opsional)
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS example_ecommerce DEFAULT CHARACTER SET utf8mb4;"

# Menjalankan file SQL
mysql -u root -p example_ecommerce < examples/mysql_example.sql
```
