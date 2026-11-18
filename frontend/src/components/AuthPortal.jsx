import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { message, Progress } from 'antd';
import AICircuitBackground from './AICircuitBackground';

export default function AuthPortal({ onAuthSuccess }) {
  // Modes: 'login' | 'register' | 'forgot'
  const [authMode, setAuthMode] = useState('login');
  const [loading, setLoading] = useState(false);

  // Login input states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register input states
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Local Reset password input states
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Floating Toast State (from logout or initial info toast)
  const [showToast, setShowToast] = useState(() => {
    return sessionStorage.getItem('appdb_logout_toast') === 'true' &&
      sessionStorage.getItem('appdb_toast_dismissed') !== 'true';
  });

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const handleDismissToast = () => {
    setShowToast(false);
    sessionStorage.setItem('appdb_toast_dismissed', 'true');
    sessionStorage.removeItem('appdb_logout_toast');
  };

  // Password strength calculation
  const handlePasswordStrength = (val) => {
    setRegisterPassword(val);
    let score = 0;
    if (!val) {
      setPasswordStrength(0);
      return;
    }
    if (val.length >= 6) score += 30;
    if (val.length >= 10) score += 20;
    if (/[A-Z]/.test(val)) score += 20;
    if (/[0-9]/.test(val)) score += 15;
    if (/[^A-Za-z0-9]/.test(val)) score += 15;
    setPasswordStrength(Math.min(100, score));
  };

  // ---------------------------------------------------------------------------
  // 1. LOCAL LOGIN HANDLER
  // ---------------------------------------------------------------------------
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      message.warning('Harap masukkan username/email dan kata sandi Anda.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', {
        email: loginEmail.trim(),
        password: loginPassword,
      });

      if (res.data.success && res.data.token) {
        localStorage.setItem('appdb_jwt_token', res.data.token);
        sessionStorage.removeItem('appdb_logout_toast');
        message.success(`Selamat datang kembali, ${res.data.user.name}!`);
        onAuthSuccess(res.data.user, res.data.token);
      }
    } catch (err) {
      const data = err.response?.data;
      message.error(data?.error || 'Gagal masuk. Periksa username/email dan kata sandi Anda.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 2. LOCAL REGISTER HANDLER (Langsung Aktif Tanpa OTP / Google)
  // ---------------------------------------------------------------------------
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!registerName.trim() || !registerEmail.trim() || !registerPassword) {
      message.warning('Harap lengkapi semua kolom pendaftaran.');
      return;
    }
    if (registerEmail.trim().length < 3 || /\s/.test(registerEmail.trim())) {
      message.error('Username atau email minimal 3 karakter dan tanpa spasi.');
      return;
    }
    if (registerPassword.length < 6) {
      message.error('Kata sandi minimal harus 6 karakter!');
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      message.error('Konfirmasi kata sandi tidak cocok!');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/register', {
        name: registerName.trim(),
        email: registerEmail.trim(),
        password: registerPassword,
      });

      if (res.data.success && res.data.token) {
        localStorage.setItem('appdb_jwt_token', res.data.token);
        sessionStorage.removeItem('appdb_logout_toast');
        message.success(res.data.message || 'Akun lokal berhasil dibuat!');
        onAuthSuccess(res.data.user, res.data.token);
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Pendaftaran gagal. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 3. LOCAL PASSWORD RESET HANDLER (Langsung Tanpa Email OTP)
  // ---------------------------------------------------------------------------
  const handleResetPasswordLocalSubmit = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      message.warning('Harap masukkan username atau email terdaftar Anda.');
      return;
    }
    if (resetPassword.length < 6) {
      message.error('Kata sandi baru minimal 6 karakter!');
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      message.error('Konfirmasi kata sandi baru tidak cocok!');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/reset-password-local', {
        email: resetEmail.trim(),
        newPassword: resetPassword,
      });

      if (res.data.success) {
        message.success(res.data.message || 'Kata sandi berhasil diperbarui! Silakan masuk.');
        setLoginEmail(resetEmail.trim());
        setLoginPassword('');
        setResetPassword('');
        setResetConfirmPassword('');
        setAuthMode('login');
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal mengatur ulang kata sandi.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDefaultLocal = () => {
    setLoginEmail('admin@local');
    setLoginPassword('admin123');
    message.info('Akun lokal default terisi. Silakan klik "Masuk".');
  };

  return (
    <div className="auth-portal-page">
      {/* Background AI Circuit Animation */}
      <AICircuitBackground />

      {/* Floating Info Toast */}
      {showToast && (
        <div className="toast" role="status">
          <span className="dot">i</span>
          <span>Anda telah keluar dari akun.</span>
          <button
            type="button"
            className="toast-close"
            onClick={handleDismissToast}
            aria-label="Tutup notifikasi"
          >
            ×
          </button>
        </div>
      )}

      {/* Glassmorphic Card */}
      <div className="card">
        {/* Brand Header */}
        <div className="brand">
          <span className="mark">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 6c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2Z" stroke="#fff" strokeWidth="1.6" />
              <path d="M4 6v12c0 1.1 3.6 2 8 2s8-.9 8-2V6" stroke="#fff" strokeWidth="1.6" />
              <path d="M4 12c0 1.1 3.6 2 8 2s8-.9 8-2" stroke="#fff" strokeWidth="1.6" />
            </svg>
          </span>
          <span><b>App Database</b> · Mode Akun Lokal</span>
        </div>

        {/* =================================================================== */}
        {/* VIEW 1: LOGIN PAGE (LOCAL ACCOUNT)                                  */}
        {/* =================================================================== */}
        {authMode === 'login' && (
          <div>
            <h1>Masuk Akun Lokal</h1>
            <p className="sub">
              Login biasa tanpa akun Google. Database target Anda tetap bisa terhubung secara online.
            </p>

            <form onSubmit={handleLoginSubmit}>
              <label htmlFor="email">Username atau Email</label>
              <div className="field">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  id="email"
                  type="text"
                  placeholder="admin atau admin@local"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="label-row">
                <label htmlFor="pass">Kata Sandi</label>
                <a onClick={() => {
                  setResetEmail(loginEmail);
                  setAuthMode('forgot');
                }}>Reset Kata Sandi?</a>
              </div>
              <div className="field">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  id="pass"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
                <svg
                  className="toggle"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                >
                  {showPassword ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </div>

              <button className="submit" type="submit" disabled={loading}>
                {loading ? (
                  <span>Memproses...</span>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                    Masuk
                  </>
                )}
              </button>
            </form>

            {/* Quick Local Default Account Info */}
            <div style={{
              marginTop: 16,
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(108, 92, 231, 0.06)',
              border: '1px solid rgba(108, 92, 231, 0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              fontSize: 12,
            }}>
              <div style={{ color: '#4c4663', lineHeight: 1.4 }}>
                <div style={{ fontWeight: 600, color: '#3b3366' }}>Akun Lokal Default</div>
                <div>
                  User: <code>admin</code> · Sandi: <code>admin123</code>
                </div>
              </div>
              <button
                type="button"
                onClick={handleFillDefaultLocal}
                style={{
                  background: '#fff',
                  border: '1px solid #d5cef7',
                  color: '#5b47d6',
                  borderRadius: 7,
                  padding: '5px 10px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Isi Otomatis
              </button>
            </div>

            <p className="footer">
              Belum punya akun lokal? <a onClick={() => setAuthMode('register')}>Buat Akun Lokal</a>
            </p>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 2: REGISTER PAGE (LOCAL ACCOUNT)                               */}
        {/* =================================================================== */}
        {authMode === 'register' && (
          <div>
            <h1>Buat Akun Lokal</h1>
            <p className="sub">
              Akun tersimpan di komputer lokal &amp; langsung aktif tanpa verifikasi email/Google.
            </p>

            <form onSubmit={handleRegisterSubmit}>
              <label htmlFor="reg-name">Nama Lengkap</label>
              <div className="field">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  id="reg-name"
                  type="text"
                  placeholder="Contoh: Fajar Wahyudi"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <label htmlFor="reg-email">Username atau Email</label>
              <div className="field">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 6h16v12H4z" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
                <input
                  id="reg-email"
                  type="text"
                  placeholder="contoh: fajar atau fajar@local"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                />
              </div>

              <label htmlFor="reg-pass">Kata Sandi (Min. 6 Karakter)</label>
              <div className="field" style={{ marginBottom: passwordStrength > 0 ? 8 : 18 }}>
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  id="reg-pass"
                  type={showRegisterPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={registerPassword}
                  onChange={(e) => handlePasswordStrength(e.target.value)}
                  required
                />
                <svg
                  className="toggle"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                >
                  {showRegisterPassword ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </div>

              {passwordStrength > 0 && (
                <div style={{ marginBottom: 14, marginTop: -4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: '#7a7690' }}>Kekuatan Sandi:</span>
                    <span style={{
                      color: passwordStrength >= 70 ? '#16a34a' : passwordStrength >= 40 ? '#d97706' : '#dc2626',
                      fontWeight: 600,
                    }}>
                      {passwordStrength >= 70 ? 'Sangat Kuat' : passwordStrength >= 40 ? 'Sedang' : 'Lemah'}
                    </span>
                  </div>
                  <Progress
                    percent={passwordStrength}
                    showInfo={false}
                    strokeColor={passwordStrength >= 70 ? '#16a34a' : passwordStrength >= 40 ? '#d97706' : '#dc2626'}
                    size="small"
                  />
                </div>
              )}

              <label htmlFor="reg-confirm">Konfirmasi Kata Sandi</label>
              <div className="field">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  id="reg-confirm"
                  type="password"
                  placeholder="••••••••"
                  value={registerConfirmPassword}
                  onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button className="submit" type="submit" disabled={loading}>
                {loading ? (
                  <span>Membuat Akun...</span>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                    Buat Akun &amp; Langsung Masuk
                  </>
                )}
              </button>
            </form>

            <p className="footer">
              Sudah memiliki akun? <a onClick={() => setAuthMode('login')}>Masuk di sini</a>
            </p>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 3: LOCAL PASSWORD RESET (DIRECT WITHOUT EMAIL OTP)             */}
        {/* =================================================================== */}
        {authMode === 'forgot' && (
          <div>
            <h1>Reset Kata Sandi Lokal</h1>
            <p className="sub">
              Atur ulang kata sandi akun lokal Anda secara langsung tanpa kode email.
            </p>

            <form onSubmit={handleResetPasswordLocalSubmit}>
              <label htmlFor="reset-email">Username atau Email Terdaftar</label>
              <div className="field">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  id="reset-email"
                  type="text"
                  placeholder="admin atau username Anda"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <label htmlFor="new-pass">Kata Sandi Baru (Min. 6 Karakter)</label>
              <div className="field">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  id="new-pass"
                  type={showResetPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                />
                <svg
                  className="toggle"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                >
                  {showResetPassword ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </div>

              <label htmlFor="confirm-new-pass">Konfirmasi Kata Sandi Baru</label>
              <div className="field">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  id="confirm-new-pass"
                  type="password"
                  placeholder="••••••••"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button className="submit" type="submit" disabled={loading}>
                {loading ? (
                  <span>Menyimpan...</span>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                    Simpan Kata Sandi Baru
                  </>
                )}
              </button>
            </form>

            <p className="footer">
              Ingat kata sandi Anda? <a onClick={() => setAuthMode('login')}>Kembali ke Masuk</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
