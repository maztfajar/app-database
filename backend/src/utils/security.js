const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'app_database_super_secret_jwt_key_2026_change_in_production!';
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'app_db_aes256_encryption_master_key_32bytes!';

// Ensure key is exactly 32 bytes for AES-256
function getMasterKey() {
  return crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
}

/**
 * Hash user password with bcrypt (12 salt rounds)
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

/**
 * Compare plain password with stored hash
 */
async function comparePassword(password, hash) {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

/**
 * Generate cryptographically secure 6-digit verification OTP
 */
function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Encrypt sensitive data (e.g. database passwords) using AES-256-GCM
 * Output format: iv:authTag:ciphertext (hex)
 */
function encryptData(text) {
  if (!text) return '';
  const key = getMasterKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt data encrypted with AES-256-GCM
 */
function decryptData(encryptedData) {
  if (!encryptedData) return '';
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return encryptedData; // fallback if plain text

    const [ivHex, authTagHex, encryptedText] = parts;
    const key = getMasterKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption error:', err.message);
    return '';
  }
}

/**
 * Issue JWT token for authenticated user
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      auth_provider: user.auth_provider || 'local',
      is_verified: !!user.is_verified,
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  generateOTP,
  encryptData,
  decryptData,
  generateToken,
  verifyToken,
};
