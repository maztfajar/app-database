const express = require('express');
const router = express.Router();
const userDb = require('../db/userDb');
const {
  hashPassword,
  comparePassword,
  generateOTP,
  generateToken,
} = require('../utils/security');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');
const {
  requireAuth,
  loginLimiter,
  registerLimiter,
  otpVerifyLimiter,
  resendOtpLimiter,
} = require('../middleware/auth');

const isDev = process.env.NODE_ENV !== 'production';

// Helper to record security audit logs
async function logAudit(userId, action, details, req) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    await userDb.query(
      'INSERT INTO user_audit_logs (user_id, action, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
      [userId || null, action, details, String(ip).slice(0, 100), String(userAgent).slice(0, 500)]
    );
  } catch (err) {
    console.error('Audit Log Error:', err.message);
  }
}

// -----------------------------------------------------------------------------
// REGISTER (Akun Lokal Langsung Aktif — Username/Email & Password)
// -----------------------------------------------------------------------------
router.post('/register', registerLimiter, async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nama lengkap, username/email, dan kata sandi wajib diisi.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanName = String(name).trim();

  // Validasi username atau email sederhana (minimal 3 karakter, tanpa spasi)
  if (cleanEmail.length < 3 || /\s/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Username atau email minimal 3 karakter dan tidak boleh mengandung spasi.' });
  }

  // Minimal 6 karakter untuk kenyamanan akun lokal
  if (password.length < 6) {
    return res.status(400).json({ error: 'Kata sandi minimal terdiri dari 6 karakter.' });
  }

  try {
    // Check if user already exists
    const existing = await userDb.query('SELECT id, email FROM users WHERE email = ?', [cleanEmail]);

    if (existing.rows && existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username atau email ini sudah terdaftar. Silakan masuk menggunakan akun Anda.' });
    }

    // Create local account directly (langsung aktif tanpa verifikasi OTP / Google)
    const passwordHash = await hashPassword(password);
    const nowIso = new Date().toISOString();

    const insertResult = await userDb.query(
      `INSERT INTO users (name, email, password_hash, auth_provider, is_verified, last_login_at)
       VALUES (?, ?, ?, 'local', 1, ?)`,
      [cleanName, cleanEmail, passwordHash, nowIso]
    );

    const newUserId = insertResult.insertId;
    await logAudit(newUserId, 'REGISTER', `Pendaftaran akun lokal baru untuk ${cleanEmail}`, req);

    const newUser = {
      id: newUserId,
      name: cleanName,
      email: cleanEmail,
      auth_provider: 'local',
      is_verified: true,
    };

    const token = generateToken(newUser);

    return res.json({
      success: true,
      needsVerification: false,
      message: `Akun lokal "${cleanName}" berhasil dibuat!`,
      token,
      user: newUser,
    });
  } catch (err) {
    console.error('Register Error:', err);
    return res.status(500).json({ error: 'Gagal memproses pendaftaran. Silakan coba beberapa saat lagi.' });
  }
});

// -----------------------------------------------------------------------------
// VERIFY OTP (6-digit code verification with Anti-Brute-Force)
// -----------------------------------------------------------------------------
router.post('/verify-otp', otpVerifyLimiter, async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email dan kode verifikasi 6 digit wajib diisi.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanCode = String(code).trim();

  try {
    const result = await userDb.query(
      'SELECT id, name, email, is_verified, verification_code, verification_code_expires_at, verification_attempts FROM users WHERE email = ?',
      [cleanEmail]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Akun tidak ditemukan. Silakan lakukan pendaftaran terlebih dahulu.' });
    }

    const user = result.rows[0];

    if (user.is_verified) {
      const token = generateToken(user);
      return res.json({
        success: true,
        message: 'Akun Anda sudah terverifikasi sebelumnya. Mengalihkan...',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          is_verified: true,
        },
      });
    }

    // Check brute force attempts limit (Max 5 failed attempts)
    const currentAttempts = user.verification_attempts || 0;
    if (currentAttempts >= 5) {
      // Invalidate code
      await userDb.query('UPDATE users SET verification_code = NULL WHERE id = ?', [user.id]);
      await logAudit(user.id, 'OTP_LOCKED', 'Kode OTP dikunci karena salah melebihi batas 5 kali', req);
      return res.status(429).json({
        error: 'Batas percobaan salah terlampaui (maksimal 5 kali). Kode verifikasi dinonaktifkan demi keamanan siber. Silakan klik "Kirim Ulang Kode".',
      });
    }

    // Check expiration (10 minutes)
    if (!user.verification_code_expires_at || new Date() > new Date(user.verification_code_expires_at)) {
      return res.status(400).json({
        error: 'Kode verifikasi telah kedaluwarsa (masa berlaku 10 menit). Silakan minta kode baru.',
      });
    }

    // Compare code
    if (user.verification_code !== cleanCode) {
      const newAttempts = currentAttempts + 1;
      await userDb.query('UPDATE users SET verification_attempts = ? WHERE id = ?', [newAttempts, user.id]);
      await logAudit(user.id, 'OTP_FAILED', `Percobaan kode salah ke-${newAttempts}`, req);

      const sisa = 5 - newAttempts;
      return res.status(400).json({
        error: `Kode verifikasi salah. Sisa kesempatan: ${sisa > 0 ? sisa : 0} kali lagi.`,
        remainingAttempts: sisa,
      });
    }

    // Verification SUCCESS! Activate account
    const nowIso = new Date().toISOString();
    await userDb.query(
      `UPDATE users SET is_verified = 1, verification_code = NULL, verification_attempts = 0, last_login_at = ? WHERE id = ?`,
      [nowIso, user.id]
    );

    await logAudit(user.id, 'VERIFY_SUCCESS', 'Akun berhasil diverifikasi melalui kode OTP', req);

    const verifiedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      is_verified: true,
      auth_provider: 'local',
    };

    const token = generateToken(verifiedUser);

    return res.json({
      success: true,
      message: 'Selamat! Akun Anda berhasil diverifikasi dan aktif.',
      token,
      user: verifiedUser,
    });
  } catch (err) {
    console.error('Verify OTP Error:', err);
    return res.status(500).json({ error: 'Gagal memverifikasi kode. Silakan coba kembali.' });
  }
});

// -----------------------------------------------------------------------------
// RESEND OTP
// -----------------------------------------------------------------------------
router.post('/resend-otp', resendOtpLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email wajib diisi.' });

  const cleanEmail = String(email).trim().toLowerCase();

  try {
    const result = await userDb.query('SELECT id, name, email, is_verified FROM users WHERE email = ?', [cleanEmail]);
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Akun dengan email tersebut tidak ditemukan.' });
    }

    const user = result.rows[0];
    if (user.is_verified) {
      return res.status(400).json({ error: 'Akun sudah terverifikasi. Anda dapat langsung login.' });
    }

    const newOtp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await userDb.query(
      'UPDATE users SET verification_code = ?, verification_code_expires_at = ?, verification_attempts = 0 WHERE id = ?',
      [newOtp, expiresAt, user.id]
    );

    const mailResult = await sendVerificationEmail(cleanEmail, user.name, newOtp);
    await logAudit(user.id, 'RESEND_OTP', 'Permintaan kirim ulang kode OTP', req);

    return res.json({
      success: true,
      message: `Kode verifikasi baru telah dikirim ke ${cleanEmail}.`,
      devOtp: isDev && mailResult.simulated ? newOtp : undefined,
    });
  } catch (err) {
    console.error('Resend OTP Error:', err);
    return res.status(500).json({ error: 'Gagal mengirim ulang kode verifikasi.' });
  }
});

// -----------------------------------------------------------------------------
// FORGOT PASSWORD (Kirim Kode OTP Reset ke Email Google / Terdaftar)
// -----------------------------------------------------------------------------
router.post('/forgot-password', resendOtpLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Alamat email wajib diisi.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();

  try {
    const result = await userDb.query(
      'SELECT id, name, email FROM users WHERE email = ?',
      [cleanEmail]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.json({
        success: true,
        message: `Jika email terdaftar, kode verifikasi reset 6-digit telah dikirimkan ke ${cleanEmail}.`,
      });
    }

    const user = result.rows[0];
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await userDb.query(
      'UPDATE users SET verification_code = ?, verification_code_expires_at = ?, verification_attempts = 0 WHERE id = ?',
      [otp, expiresAt, user.id]
    );

    const mailResult = await sendPasswordResetEmail(cleanEmail, user.name, otp);
    await logAudit(user.id, 'FORGOT_PASSWORD_REQUEST', `Permintaan reset password untuk ${cleanEmail}`, req);

    return res.json({
      success: true,
      message: `Kode verifikasi reset telah dikirim ke ${cleanEmail}.`,
      email: cleanEmail,
      devOtp: isDev && mailResult.simulated ? otp : undefined,
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Gagal memproses permintaan reset kata sandi.' });
  }
});

// -----------------------------------------------------------------------------
// RESET PASSWORD (Verifikasi OTP & Atur Sandi Baru)
// -----------------------------------------------------------------------------
router.post('/reset-password', otpVerifyLimiter, async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Email, kode verifikasi 6 digit, dan kata sandi baru wajib diisi.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Kata sandi baru minimal terdiri dari 8 karakter.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanCode = String(code).trim();

  try {
    const result = await userDb.query(
      'SELECT id, name, email, verification_code, verification_code_expires_at, verification_attempts FROM users WHERE email = ?',
      [cleanEmail]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }

    const user = result.rows[0];

    // Cek batas percobaan salah (anti brute force)
    const attempts = user.verification_attempts || 0;
    if (attempts >= 5) {
      await userDb.query('UPDATE users SET verification_code = NULL WHERE id = ?', [user.id]);
      await logAudit(user.id, 'RESET_PASSWORD_LOCKED', 'Kode reset dinonaktifkan karena salah melebihi 5x', req);
      return res.status(429).json({
        error: 'Batas percobaan salah terlampaui. Kode reset telah dinonaktifkan demi keamanan. Silakan minta kode baru.',
      });
    }

    // Cek kadaluwarsa
    if (!user.verification_code_expires_at || new Date() > new Date(user.verification_code_expires_at)) {
      return res.status(400).json({ error: 'Kode verifikasi telah kedaluwarsa. Silakan minta kode baru.' });
    }

    // Cek kecocokan kode
    if (user.verification_code !== cleanCode) {
      const newAttempts = attempts + 1;
      await userDb.query('UPDATE users SET verification_attempts = ? WHERE id = ?', [newAttempts, user.id]);
      const sisa = 5 - newAttempts;
      return res.status(400).json({
        error: `Kode verifikasi salah. Sisa kesempatan: ${sisa > 0 ? sisa : 0} kali.`,
        remainingAttempts: sisa,
      });
    }

    // Hash kata sandi baru dan perbarui akun
    const passwordHash = await hashPassword(newPassword);
    const nowIso = new Date().toISOString();

    await userDb.query(
      'UPDATE users SET password_hash = ?, is_verified = 1, verification_code = NULL, verification_attempts = 0, updated_at = ? WHERE id = ?',
      [passwordHash, nowIso, user.id]
    );

    await logAudit(user.id, 'PASSWORD_RESET_SUCCESS', 'Kata sandi berhasil diatur ulang', req);

    return res.json({
      success: true,
      message: 'Kata sandi berhasil diperbarui! Silakan masuk menggunakan kata sandi baru Anda.',
    });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Gagal mengatur ulang kata sandi.' });
  }
});

// -----------------------------------------------------------------------------
// RESET PASSWORD LOKAL (Langsung atur ulang sandi tanpa OTP email eksternal)
// -----------------------------------------------------------------------------
router.post('/reset-password-local', loginLimiter, async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Username/email dan kata sandi baru wajib diisi.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Kata sandi baru minimal terdiri dari 6 karakter.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();

  try {
    let result = await userDb.query(
      'SELECT id, name, email FROM users WHERE email = ?',
      [cleanEmail]
    );

    if ((!result.rows || result.rows.length === 0) && !cleanEmail.includes('@')) {
      result = await userDb.query(
        'SELECT id, name, email FROM users WHERE email = ?',
        [`${cleanEmail}@local`]
      );
    }

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Akun lokal dengan username/email tersebut tidak ditemukan.' });
    }

    const user = result.rows[0];
    const passwordHash = await hashPassword(newPassword);
    const nowIso = new Date().toISOString();

    await userDb.query(
      "UPDATE users SET password_hash = ?, auth_provider = 'local', is_verified = 1, verification_code = NULL, verification_attempts = 0, updated_at = ? WHERE id = ?",
      [passwordHash, nowIso, user.id]
    );

    await logAudit(user.id, 'PASSWORD_RESET_LOCAL', 'Kata sandi akun lokal diatur ulang secara langsung', req);

    return res.json({
      success: true,
      message: 'Kata sandi akun lokal berhasil diperbarui! Silakan masuk menggunakan kata sandi baru Anda.',
    });
  } catch (err) {
    console.error('Local reset password error:', err);
    return res.status(500).json({ error: 'Gagal mengatur ulang kata sandi.' });
  }
});

// -----------------------------------------------------------------------------
// LOGIN (Akun Lokal — Username/Email & Password)
// -----------------------------------------------------------------------------
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Username/email dan kata sandi wajib diisi.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();

  try {
    let result = await userDb.query(
      'SELECT id, name, email, password_hash, avatar_url, auth_provider, is_verified FROM users WHERE email = ?',
      [cleanEmail]
    );

    // Dukung shortcut username tanpa @local (misal ketik "admin" untuk "admin@local")
    if ((!result.rows || result.rows.length === 0) && !cleanEmail.includes('@')) {
      result = await userDb.query(
        'SELECT id, name, email, password_hash, avatar_url, auth_provider, is_verified FROM users WHERE email = ?',
        [`${cleanEmail}@local`]
      );
    }

    if (!result.rows || result.rows.length === 0) {
      await logAudit(null, 'LOGIN_FAILED', `Upaya login akun tidak terdaftar: ${cleanEmail}`, req);
      return res.status(401).json({ error: 'Username/email atau kata sandi yang Anda masukkan salah.' });
    }

    const user = result.rows[0];

    // Jika akun lama sebelumnya dibuat tanpa password lokal
    if (!user.password_hash) {
      return res.status(400).json({
        error: 'Akun lama ini belum memiliki kata sandi lokal. Silakan klik "Reset Kata Sandi?" untuk mengatur kata sandi lokal Anda.',
      });
    }

    // Verify Password
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      await logAudit(user.id, 'LOGIN_FAILED', 'Kata sandi salah', req);
      return res.status(401).json({ error: 'Username/email atau kata sandi yang Anda masukkan salah.' });
    }

    // Login successful (langsung aktif untuk akun lokal)
    const nowIso = new Date().toISOString();
    await userDb.query('UPDATE users SET is_verified = 1, last_login_at = ? WHERE id = ?', [nowIso, user.id]);
    await logAudit(user.id, 'LOGIN_SUCCESS', 'Login akun lokal berhasil', req);

    const token = generateToken({ ...user, is_verified: true });

    return res.json({
      success: true,
      message: `Selamat datang kembali, ${user.name}!`,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        auth_provider: 'local',
        is_verified: true,
      },
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ error: 'Gagal melakukan proses masuk. Silakan coba kembali.' });
  }
});

// -----------------------------------------------------------------------------
// GOOGLE AUTH (Sign-In / Sign-Up with Google)
// -----------------------------------------------------------------------------
router.post('/google', async (req, res) => {
  const { credential, profile } = req.body;

  let googleEmail = '';
  let googleName = '';
  let googleAvatar = '';
  let googleSub = '';

  // 1. If Google ID Token JWT (GIS credential) is provided, decode payload
  if (credential) {
    try {
      const parts = credential.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        googleEmail = payload.email;
        googleName = payload.name || payload.given_name || 'Pengguna Google';
        googleAvatar = payload.picture || '';
        googleSub = payload.sub || '';
      }
    } catch (e) {
      console.warn('Gagal mem-parsing Google credential JWT:', e.message);
    }
  }

  // 2. Direct profile payload (e.g. from client SDK or simulation mode)
  if (!googleEmail && profile) {
    googleEmail = profile.email;
    googleName = profile.name || 'Pengguna Google';
    googleAvatar = profile.picture || profile.avatar || '';
    googleSub = profile.sub || profile.id || '';
  }

  if (!googleEmail) {
    return res.status(400).json({ error: 'Data akun Google tidak lengkap atau tidak valid.' });
  }

  const cleanEmail = String(googleEmail).trim().toLowerCase();

  try {
    const existing = await userDb.query('SELECT id, name, email, avatar_url, auth_provider, is_verified FROM users WHERE email = ?', [cleanEmail]);

    let user;
    const nowIso = new Date().toISOString();

    if (existing.rows && existing.rows.length > 0) {
      user = existing.rows[0];
      // Update google ID, avatar, verification status, and last login
      await userDb.query(
        `UPDATE users SET is_verified = 1, last_login_at = ?, google_id = COALESCE(google_id, ?), avatar_url = COALESCE(avatar_url, ?) WHERE id = ?`,
        [nowIso, googleSub, googleAvatar, user.id]
      );
      await logAudit(user.id, 'LOGIN_GOOGLE', `Login via Google Account (${cleanEmail})`, req);
    } else {
      // Create new verified user via Google
      const insertResult = await userDb.query(
        `INSERT INTO users (name, email, avatar_url, auth_provider, google_id, is_verified, last_login_at)
         VALUES (?, ?, ?, 'google', ?, 1, ?)`,
        [googleName, cleanEmail, googleAvatar, googleSub, nowIso]
      );
      const newId = insertResult.insertId;
      user = {
        id: newId,
        name: googleName,
        email: cleanEmail,
        avatar_url: googleAvatar,
        auth_provider: 'google',
        is_verified: true,
      };
      await logAudit(newId, 'REGISTER_GOOGLE', `Pendaftaran otomatis via Google Account (${cleanEmail})`, req);
    }

    const token = generateToken({ ...user, is_verified: true });

    return res.json({
      success: true,
      message: `Berhasil masuk dengan akun Google: ${cleanEmail}`,
      token,
      user: {
        id: user.id,
        name: user.name || googleName,
        email: cleanEmail,
        avatar_url: user.avatar_url || googleAvatar,
        auth_provider: 'google',
        is_verified: true,
      },
    });
  } catch (err) {
    console.error('Google Auth Error:', err);
    return res.status(500).json({ error: 'Gagal autentikasi dengan akun Google.' });
  }
});

// -----------------------------------------------------------------------------
// GET ME (Current User Info)
// -----------------------------------------------------------------------------
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await userDb.query(
      'SELECT id, name, email, avatar_url, auth_provider, is_verified, created_at, last_login_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    // Also fetch saved connections count
    const connCountRes = await userDb.query('SELECT COUNT(*) as total FROM user_connections WHERE user_id = ?', [req.user.id]);
    const queryCountRes = await userDb.query('SELECT COUNT(*) as total FROM user_saved_queries WHERE user_id = ?', [req.user.id]);

    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        ...user,
        stats: {
          savedConnections: parseInt(connCountRes.rows[0]?.total || 0),
          savedQueries: parseInt(queryCountRes.rows[0]?.total || 0),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// GET SECURITY AUDIT LOGS (User Security Activity)
// -----------------------------------------------------------------------------
router.get('/security/logs', requireAuth, async (req, res) => {
  try {
    const logsResult = await userDb.query(
      'SELECT id, action, details, ip_address, created_at FROM user_audit_logs WHERE user_id = ? ORDER BY id DESC LIMIT 20',
      [req.user.id]
    );

    res.json({
      success: true,
      logs: logsResult.rows || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// LOGOUT
// -----------------------------------------------------------------------------
router.post('/logout', requireAuth, async (req, res) => {
  await logAudit(req.user.id, 'LOGOUT', 'Pengguna keluar dari sesi', req);
  res.json({ success: true, message: 'Berhasil keluar.' });
});

module.exports = router;
