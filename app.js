/**
 * ==============================================================================
 *  APP DATABASE — Resilient Entry Point untuk cPanel Phusion Passenger
 * ==============================================================================
 *  File ini dirancang khusus untuk mencegah error 500 / "Application is
 *  inaccessible by its address" saat proses instalasi modul di cPanel Node.js.
 *
 *  Jika dependensi (node_modules) belum terinstall atau sedang diinstall:
 *  Server fallback berbasis Node.js standard library (tanpa npm external) akan
 *  otomatis aktif merespon HTTP 200 OK agar cPanel lolos pengecekan health check.
 * ==============================================================================
 */

const http = require('http');

function startEmergencyFallback(errorMessage) {
  const PORT = process.env.PORT || 3001;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>App Database — Menyiapkan Sistem</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 36px; max-width: 520px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          h1 { color: #818cf8; margin-top: 0; font-size: 22px; }
          p { color: #94a3b8; line-height: 1.6; font-size: 14px; }
          .badge { display: inline-block; background: #3b82f6; color: #fff; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
          .alert { background: #0f172a; border-left: 4px solid #f59e0b; padding: 12px; text-align: left; border-radius: 6px; font-size: 13px; color: #cbd5e1; margin-top: 16px; word-break: break-word; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">Sistem Sedang Disiapkan</div>
          <h1>⚡ App Database — Siap Diaktifkan</h1>
          <p>Aplikasi Node.js telah berhasil terhubung dengan cPanel web server. Jika modul baru saja di-install, silakan klik tombol <b>Restart</b> di cPanel Node.js Selector.</p>
          <div class="alert">
            <b>Status:</b> ${errorMessage || 'Menunggu instalasi modul selesai.'}
          </div>
          <p style="margin-top: 20px; font-size: 12px; color: #64748b;">App Database &copy; ${new Date().getFullYear()} • Dibuat oleh Fajar Wahyudi</p>
        </div>
      </body>
      </html>
    `);
  });

  server.listen(PORT, () => {
    console.log(`⚡ Emergency fallback server listening on port ${PORT}`);
  });
}

try {
  // 1. Coba load dotenv
  try {
    require('dotenv').config();
  } catch (e) {
    console.warn('ℹ️ dotenv belum tersedia, menggunakan environment bawaan host.');
  }

  // 2. Jalankan server backend utama
  require('./backend/server.js');
} catch (err) {
  console.error('⚠️ Gagal menjalankan server utama (modul belum terinstall atau error):', err.message);
  // Jalankan fallback HTTP server agar Passenger cPanel tidak crash (HTTP 200 OK)
  startEmergencyFallback(err.message);
}
