const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../utils/security');
const userDb = require('../db/userDb');

/**
 * Authentication Middleware: Verify JWT Bearer token and check user in DB
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Akses ditolak: Token autentikasi tidak ditemukan.' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Sesi kedaluwarsa atau token tidak valid. Silakan login kembali.' });
  }

  try {
    const result = await userDb.query('SELECT id, email, name, avatar_url, auth_provider, is_verified FROM users WHERE id = ?', [decoded.id]);
    if (!result.rows || result.rows.length === 0) {
      return res.status(401).json({ error: 'Pengguna tidak ditemukan di sistem.' });
    }

    const user = result.rows[0];
    if (!user.is_verified) {
      return res.status(403).json({
        error: 'Akun Anda belum diverifikasi. Silakan masukkan kode verifikasi yang dikirim ke email Anda.',
        needsVerification: true,
        email: user.email,
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth Middleware Error:', err);
    return res.status(500).json({ error: 'Kesalahan server saat memverifikasi sesi.' });
  }
}

/**
 * Optional Auth Middleware: If token provided, populates req.user
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (decoded) {
      try {
        const result = await userDb.query('SELECT id, email, name, avatar_url, auth_provider, is_verified FROM users WHERE id = ?', [decoded.id]);
        if (result.rows && result.rows.length > 0) {
          req.user = result.rows[0];
        }
      } catch (err) {
        // silent fail for optional auth
      }
    }
  }
  next();
}

// -----------------------------------------------------------------------------
// Rate Limiters for Cybersecurity
// -----------------------------------------------------------------------------

/**
 * Login Rate Limiter: Max 5 failed attempts per 15 minutes per IP
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Terlalu banyak percobaan login yang gagal. Demi keamanan siber, silakan coba lagi dalam 15 menit.',
    retryAfterMinutes: 15,
  },
});

/**
 * Registration Rate Limiter: Max 8 accounts per 1 hour per IP
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Batas pembuatan akun tercapai untuk alamat IP ini. Silakan coba lagi nanti.',
  },
});

/**
 * OTP Verification Rate Limiter: Max 10 attempts per 10 minutes per IP
 */
const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Terlalu banyak percobaan kode verifikasi yang salah. Akses ditangguhkan selama 10 menit demi keamanan.',
  },
});

/**
 * OTP Resend Rate Limiter: Max 4 requests per 15 minutes per IP
 */
const resendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Terlalu sering meminta kode verifikasi. Harap tunggu beberapa saat sebelum meminta lagi.',
  },
});

module.exports = {
  requireAuth,
  optionalAuth,
  loginLimiter,
  registerLimiter,
  otpVerifyLimiter,
  resendOtpLimiter,
};
