const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  // 1. Check for Gmail configuration
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
    console.log('📧 Email Service: Menggunakan Gmail SMTP (' + process.env.GMAIL_USER + ')');
    return transporter;
  }

  // 2. Check for Custom SMTP (cPanel / Hosting / SendGrid / etc.)
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log(`📧 Email Service: Menggunakan Custom SMTP (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587})`);
    return transporter;
  }

  // 3. Fallback: No SMTP configured (Development Mode)
  return null;
}

/**
 * Send Verification OTP to user email
 */
async function sendVerificationEmail(email, name, otpCode) {
  const mail = getTransporter();

  // HTML Template for OTP Email
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Kode Verifikasi Akun App Database</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f1117; margin: 0; padding: 20px; color: #e4e6eb; }
        .container { max-width: 520px; margin: 0 auto; background: #1a1d24; border: 1px solid #2d3139; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { background: linear-gradient(135deg, #6C5CE7, #a29bfe); padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
        .body { padding: 30px 25px; }
        .greeting { font-size: 16px; margin-bottom: 15px; color: #e4e6eb; }
        .description { font-size: 14px; color: #a0a4b8; line-height: 1.6; margin-bottom: 25px; }
        .code-box { background: #13151a; border: 2px dashed #6C5CE7; border-radius: 10px; padding: 20px; text-align: center; margin: 25px 0; }
        .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #a29bfe; font-family: monospace; display: inline-block; }
        .alert-box { background: rgba(255, 171, 0, 0.1); border-left: 4px solid #ffab00; padding: 12px 15px; border-radius: 4px; font-size: 13px; color: #ffab00; margin: 20px 0; }
        .footer { background: #13151a; padding: 20px; text-align: center; font-size: 12px; color: #6c7280; border-top: 1px solid #252830; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚡ App Database</h1>
          <p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.85); font-size: 13px;">Verifikasi Keamanan Akun</p>
        </div>
        <div class="body">
          <div class="greeting">Halo, <strong>${name || 'Pengguna'}</strong>!</div>
          <p class="description">
            Terima kasih telah mendaftar di <strong>App Database</strong>. Untuk melanjutkan dan mengaktifkan akun Anda, silakan gunakan kode verifikasi sekali pakai (OTP) berikut:
          </p>

          <div class="code-box">
            <span class="otp-code">${otpCode}</span>
          </div>

          <div class="alert-box">
            ⚠️ <strong>Penting:</strong> Kode ini hanya berlaku selama <strong>10 menit</strong>. Jangan pernah membagikan kode ini kepada siapa pun demi keamanan akun Anda.
          </div>

          <p class="description" style="margin-top: 20px; font-size: 12px;">
            Jika Anda tidak merasa mendaftar di App Database, abaikan email ini. Akun tidak akan aktif tanpa verifikasi kode ini.
          </p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} App Database • Sistem Keamanan Terenkripsi AES-256 & Multi-Tenant
        </div>
      </div>
    </body>
    </html>
  `;

  if (!mail) {
    console.log('\n==========================================================');
    console.log('📬 [SIMULASI PENGIRIMAN EMAIL OTP]');
    console.log(`➜ Kepada     : ${email} (${name})`);
    console.log(`➜ Kode OTP   : 🔑 ${otpCode} 🔑`);
    console.log('➜ Status     : SMTP belum diset di .env — Menampilkan kode di console');
    console.log('==========================================================\n');
    return {
      success: true,
      simulated: true,
      otp: otpCode,
      message: 'Email disimulasikan (SMTP belum dikonfigurasi di .env). Cek terminal server.',
    };
  }

  try {
    const fromAddress = process.env.MAIL_FROM || process.env.GMAIL_USER || process.env.SMTP_USER || 'no-reply@app-database.local';
    const info = await mail.sendMail({
      from: `"App Database Security" <${fromAddress}>`,
      to: email,
      subject: `[${otpCode}] Kode Verifikasi Akun App Database Anda`,
      text: `Halo ${name},\n\nKode verifikasi Anda adalah: ${otpCode}\n\nKode ini berlaku selama 10 menit.\nJangan bagikan kode ini kepada siapa pun.`,
      html: htmlContent,
    });
    console.log(`✅ Email verifikasi OTP berhasil terkirim ke ${email} (Message ID: ${info.messageId})`);
    return { success: true, simulated: false, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Gagal mengirim email OTP ke ${email}:`, err.message);
    // Fallback in dev if SMTP fails
    return {
      success: true,
      simulated: true,
      otp: otpCode,
      error: err.message,
      message: 'SMTP Error: Kode ditampilkan untuk sementara. ' + err.message,
    };
  }
}

/**
 * Send Password Reset OTP email
 */
async function sendPasswordResetEmail(email, name, otpCode) {
  const mail = getTransporter();

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Kata Sandi Akun</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .container { max-width: 500px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
        .header { background: #4f46e5; padding: 25px 20px; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; }
        .body { padding: 30px 25px; }
        .greeting { font-size: 16px; margin-bottom: 12px; color: #0f172a; }
        .description { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 20px; }
        .code-box { background: #f1f5f9; border: 2px dashed #4f46e5; border-radius: 10px; padding: 18px; text-align: center; margin: 20px 0; }
        .otp-code { font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #4f46e5; font-family: monospace; display: inline-block; }
        .alert-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 14px; border-radius: 4px; font-size: 13px; color: #b45309; margin: 20px 0; }
        .footer { background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚡ App Database</h1>
          <p style="margin: 4px 0 0 0; color: rgba(255,255,255,0.85); font-size: 13px;">Permintaan Reset Kata Sandi</p>
        </div>
        <div class="body">
          <div class="greeting">Halo, <strong>${name || 'Pengguna'}</strong>!</div>
          <p class="description">
            Kami menerima permintaan untuk mengatur ulang kata sandi akun App Database Anda. Gunakan kode verifikasi 6 digit berikut untuk melanjutkan:
          </p>

          <div class="code-box">
            <span class="otp-code">${otpCode}</span>
          </div>

          <div class="alert-box">
            ⚠️ <strong>Perhatian:</strong> Kode ini hanya berlaku selama <strong>10 menit</strong>. Jika Anda tidak meminta reset kata sandi, abaikan email ini dan akun Anda tetap aman.
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} App Database • Sistem Keamanan Terenkripsi
        </div>
      </div>
    </body>
    </html>
  `;

  if (!mail) {
    console.log('\n==========================================================');
    console.log('📬 [SIMULASI PENGIRIMAN EMAIL RESET KATA SANDI]');
    console.log(`➜ Kepada     : ${email} (${name})`);
    console.log(`➜ Kode Reset : 🔑 ${otpCode} 🔑`);
    console.log('➜ Status     : SMTP belum diset di .env — Menampilkan kode di console');
    console.log('==========================================================\n');
    return {
      success: true,
      simulated: true,
      otp: otpCode,
      message: 'Kode reset ditampilkan di terminal console (Mode Dev).',
    };
  }

  try {
    const fromAddress = process.env.MAIL_FROM || process.env.GMAIL_USER || process.env.SMTP_USER || 'no-reply@app-database.local';
    const info = await mail.sendMail({
      from: `"App Database Security" <${fromAddress}>`,
      to: email,
      subject: `[${otpCode}] Kode Reset Kata Sandi App Database Anda`,
      text: `Halo ${name},\n\nKode verifikasi reset kata sandi Anda adalah: ${otpCode}\n\nKode ini berlaku selama 10 menit.`,
      html: htmlContent,
    });
    console.log(`✅ Email reset kata sandi berhasil terkirim ke ${email}`);
    return { success: true, simulated: false, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Gagal mengirim email reset ke ${email}:`, err.message);
    return {
      success: true,
      simulated: true,
      otp: otpCode,
      error: err.message,
    };
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
