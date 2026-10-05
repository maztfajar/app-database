import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { message, Progress } from 'antd';
import AICircuitBackground from './AICircuitBackground';

export default function AuthPortal({ onAuthSuccess }) {
  // Modes: 'login' | 'register' | 'forgot' | 'reset' | 'verify'
  const [authMode, setAuthMode] = useState('login');
  const [loading, setLoading] = useState(false);

  // Form input states
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

  // Forgot password input states
  const [forgotEmail, setForgotEmail] = useState('');

  // Reset password input states
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Verification & Reset states
  const [targetEmail, setTargetEmail] = useState('');
  const [targetName, setTargetName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [devOtp, setDevOtp] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState(5);

  // Floating Toast State (from logout or initial info toast)
  const [showToast, setShowToast] = useState(() => {
    return sessionStorage.getItem('appdb_toast_dismissed') !== 'true';
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

  // Countdown timer for OTP
  useEffect(() => {
    let timer;
    if ((authMode === 'verify' || authMode === 'reset') && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [authMode, countdown]);

  // Password strength calculation
  const handlePasswordStrength = (val) => {
    setRegisterPassword(val);
    let score = 0;
    if (!val) {
      setPasswordStrength(0);
      return;
    }
    if (val.length >= 8) score += 30;
    if (val.length >= 12) score += 20;
    if (/[A-Z]/.test(val)) score += 20;
    if (/[0-9]/.test(val)) score += 15;
    if (/[^A-Za-z0-9]/.test(val)) score += 15;
    setPasswordStrength(Math.min(100, score));
  };

  // ---------------------------------------------------------------------------
  // 1. LOGIN HANDLER
  // ---------------------------------------------------------------------------
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      message.warning('Harap masukkan email dan kata sandi Anda.');
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
      if (data?.needsVerification) {
        message.warning('Akun Anda belum diverifikasi. Masukkan kode verifikasi.');
        setTargetEmail(data.email || loginEmail.trim());
        setDevOtp(data.devOtp || '');
        setCountdown(60);
        setCanResend(false);
        setAuthMode('verify');
      } else {
        message.error(data?.error || 'Gagal masuk. Periksa email dan kata sandi Anda.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 2. REGISTER HANDLER
  // ---------------------------------------------------------------------------
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!registerName.trim() || !registerEmail.trim() || !registerPassword) {
      message.warning('Harap lengkapi semua kolom pendaftaran.');
      return;
    }
    if (registerPassword.length < 8) {
      message.error('Kata sandi minimal harus 8 karakter!');
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

      if (res.data.success) {
        message.success(res.data.message || 'Kode verifikasi telah dikirim ke email Anda!');
        setTargetEmail(registerEmail.trim());
        setTargetName(registerName.trim());
        setDevOtp(res.data.devOtp || '');
        setCountdown(60);
        setCanResend(false);
        setRemainingAttempts(5);
        setAuthMode('verify');
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Pendaftaran gagal. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 3. VERIFY REGISTRATION OTP HANDLER
  // ---------------------------------------------------------------------------
  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      message.warning('Harap masukkan 6 digit kode verifikasi.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/verify-otp', {
        email: targetEmail,
        code: otpCode.trim(),
      });

      if (res.data.success && res.data.token) {
        localStorage.setItem('appdb_jwt_token', res.data.token);
        sessionStorage.removeItem('appdb_logout_toast');
        message.success('Verifikasi berhasil! Akun Anda telah aktif.');
        onAuthSuccess(res.data.user, res.data.token);
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.remainingAttempts !== undefined) {
        setRemainingAttempts(data.remainingAttempts);
      }
      message.error(data?.error || 'Kode verifikasi salah atau kedaluwarsa.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 4. FORGOT PASSWORD: REQUEST RESET OTP
  // ---------------------------------------------------------------------------
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      message.warning('Harap masukkan alamat email Anda.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/forgot-password', { email: forgotEmail.trim() });
      if (res.data.success) {
        message.success(res.data.message);
        setTargetEmail(forgotEmail.trim());
        setDevOtp(res.data.devOtp || '');
        setCountdown(60);
        setCanResend(false);
        setResetCode('');
        setAuthMode('reset');
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal memproses permintaan reset kata sandi.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 5. RESET PASSWORD: VERIFY OTP AND SAVE NEW PASSWORD
  // ---------------------------------------------------------------------------
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetCode.trim()) {
      message.warning('Harap masukkan kode verifikasi 6 digit.');
      return;
    }
    if (resetPassword.length < 8) {
      message.error('Kata sandi baru minimal 8 karakter!');
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      message.error('Konfirmasi kata sandi baru tidak cocok!');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/reset-password', {
        email: targetEmail,
        code: resetCode.trim(),
        newPassword: resetPassword,
      });

      if (res.data.success) {
        message.success(res.data.message || 'Kata sandi berhasil diperbarui! Silakan masuk.');
        setLoginEmail(targetEmail);
        setLoginPassword('');
        setAuthMode('login');
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal mengatur ulang kata sandi.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 6. RESEND OTP HANDLER
  // ---------------------------------------------------------------------------
  const handleResendOtp = async () => {
    if (!canResend) return;
    setLoading(true);
    try {
      const endpoint = authMode === 'reset' ? '/api/auth/forgot-password' : '/api/auth/resend-otp';
      const res = await axios.post(endpoint, { email: targetEmail });
      if (res.data.success) {
        message.success('Kode verifikasi baru telah dikirimkan.');
        setDevOtp(res.data.devOtp || '');
        setCountdown(60);
        setCanResend(false);
        setOtpCode('');
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal mengirim ulang kode.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 7. GOOGLE SIGN-IN HANDLER
  // ---------------------------------------------------------------------------
  const handleGoogleAuth = async () => {
    const defaultEmail = prompt(
      'Masuk menggunakan Akun Google:\nMasukkan alamat email Google / Gmail Anda:',
      'user.google@gmail.com'
    );

    if (!defaultEmail) return;

    setLoading(true);
    try {
      const defaultName = defaultEmail.split('@')[0].replace('.', ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase());
      const res = await axios.post('/api/auth/google', {
        profile: {
          email: defaultEmail,
          name: defaultName || 'Google User',
          picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${defaultEmail}`,
          id: 'google_' + Date.now(),
        },
      });

      if (res.data.success && res.data.token) {
        localStorage.setItem('appdb_jwt_token', res.data.token);
        sessionStorage.removeItem('appdb_logout_toast');
        message.success(`Berhasil masuk dengan akun Google: ${defaultEmail}`);
        onAuthSuccess(res.data.user, res.data.token);
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Gagal masuk dengan akun Google.');
    } finally {
      setLoading(false);
    }
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
          <span><b>App Database</b> · Platform Database Client Modern</span>
        </div>

        {/* =================================================================== */}
        {/* VIEW 1: LOGIN PAGE (DEFAULT)                                        */}
        {/* =================================================================== */}
        {authMode === 'login' && (
          <div>
            <h1>Masuk ke Akun Anda</h1>
            <p className="sub">Gunakan akun terdaftar Anda untuk melanjutkan.</p>

            {/* Google Login Button */}
            <button className="btn-google" type="button" onClick={handleGoogleAuth} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.5 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.4 0-13.7 4.2-16.9 10.3z" />
                <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2 14-5.3l-6.5-5.4C29.4 34.9 26.9 36 24 36c-5.3 0-9.8-3.4-11.4-8.1l-6.6 5.1C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.8-2.9 5.1-5.3 6.6l6.5 5.4C39.9 37.3 44 31.3 44 24c0-1.3-.1-2.3-.4-3.5z" />
              </svg>
              Masuk dengan Akun Google
            </button>

            <div className="divider">atau dengan email</div>

            <form onSubmit={handleLoginSubmit}>
              <label htmlFor="email">Alamat Email</label>
              <div className="field">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 6h16v12H4z" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
                <input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>

              <div className="label-row">
                <label htmlFor="pass">Kata Sandi</label>
                <a onClick={() => setAuthMode('forgot')}>Lupa Kata Sandi?</a>
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

            <p className="footer">
              Belum memiliki akun? <a onClick={() => setAuthMode('register')}>Daftar di sini</a>
            </p>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 2: REGISTER PAGE                                              */}
        {/* =================================================================== */}
        {authMode === 'register' && (
          <div>
            <h1>Daftar Akun Baru</h1>
            <p className="sub">Buat akun untuk menyimpan konfigurasi dan slot database Anda.</p>

            <button className="btn-google" type="button" onClick={handleGoogleAuth} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.5 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.4 0-13.7 4.2-16.9 10.3z" />
                <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2 14-5.3l-6.5-5.4C29.4 34.9 26.9 36 24 36c-5.3 0-9.8-3.4-11.4-8.1l-6.6 5.1C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.8-2.9 5.1-5.3 6.6l6.5 5.4C39.9 37.3 44 31.3 44 24c0-1.3-.1-2.3-.4-3.5z" />
              </svg>
              Daftar dengan Akun Google
            </button>

            <div className="divider">atau dengan formulir</div>

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
                  required
                />
              </div>

              <label htmlFor="reg-email">Alamat Email</label>
              <div className="field">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 6h16v12H4z" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
                <input
                  id="reg-email"
                  type="email"
                  placeholder="nama@email.com"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                />
              </div>

              <label htmlFor="reg-pass">Kata Sandi (Min. 8 Karakter)</label>
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
                  <span>Mendaftarkan...</span>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                    Daftar Sekarang
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
        {/* VIEW 3: FORGOT PASSWORD REQUEST                                     */}
        {/* =================================================================== */}
        {authMode === 'forgot' && (
          <div>
            <h1>Lupa Kata Sandi?</h1>
            <p className="sub">
              Masukkan alamat email Anda untuk menerima kode OTP verifikasi reset 6 digit.
            </p>

            <form onSubmit={handleForgotPasswordSubmit}>
              <label htmlFor="forgot-email">Alamat Email Terdaftar</label>
              <div className="field">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 6h16v12H4z" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
                <input
                  id="forgot-email"
                  type="email"
                  placeholder="nama@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <button className="submit" type="submit" disabled={loading}>
                {loading ? (
                  <span>Mengirimkan...</span>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                    Kirim Kode Reset OTP
                  </>
                )}
              </button>
            </form>

            <p className="footer">
              Ingat kata sandi Anda? <a onClick={() => setAuthMode('login')}>Kembali ke Masuk</a>
            </p>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 4: RESET PASSWORD (VERIFY OTP + SET NEW PASSWORD)              */}
        {/* =================================================================== */}
        {authMode === 'reset' && (
          <div>
            <h1>Atur Ulang Kata Sandi</h1>
            <p className="sub">
              Masukkan kode OTP 6 digit yang dikirimkan ke <b>{targetEmail}</b>.
            </p>

            {devOtp && (
              <div style={{
                background: '#f4f2fb',
                border: '1px solid #e9e7f2',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 12,
                color: '#5b21b6',
                marginBottom: 16,
              }}>
                Mode Dev: Kode reset Anda adalah{' '}
                <strong
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => setResetCode(devOtp)}
                  title="Klik untuk tempel"
                >
                  {devOtp} (Klik untuk tempel)
                </strong>
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit}>
              <label htmlFor="reset-code">Kode Verifikasi (6 Digit)</label>
              <div className="field">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="m21 2-2 2m-1.5 1.5L14 9M3 21l3-3m0 0 8.5-8.5a2.12 2.12 0 1 0-3-3L0 15v6h6l8.5-8.5" />
                </svg>
                <input
                  id="reset-code"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                  style={{ letterSpacing: 4, fontFamily: 'monospace', fontWeight: 600 }}
                  required
                />
              </div>

              <label htmlFor="new-pass">Kata Sandi Baru</label>
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={!canResend}
                style={{
                  background: 'none',
                  border: 'none',
                  color: canResend ? 'var(--purple)' : 'var(--muted)',
                  fontSize: 12.5,
                  cursor: canResend ? 'pointer' : 'default',
                  padding: 0,
                  fontWeight: 500,
                }}
              >
                {canResend ? 'Kirim Ulang Kode' : `Kirim ulang (${countdown}s)`}
              </button>
              <a onClick={() => setAuthMode('login')} style={{ color: 'var(--muted)', fontSize: 12.5 }}>
                Batal / Masuk
              </a>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 5: VERIFY REGISTRATION OTP                                     */}
        {/* =================================================================== */}
        {authMode === 'verify' && (
          <div>
            <h1>Verifikasi Akun Anda</h1>
            <p className="sub">
              Masukkan 6 digit kode OTP yang dikirimkan ke <b>{targetEmail}</b>.
            </p>

            {devOtp && (
              <div style={{
                background: '#f4f2fb',
                border: '1px solid #e9e7f2',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 12,
                color: '#5b21b6',
                marginBottom: 16,
              }}>
                Mode Dev: Kode verifikasi Anda adalah{' '}
                <strong
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => setOtpCode(devOtp)}
                  title="Klik untuk tempel"
                >
                  {devOtp} (Klik untuk tempel)
                </strong>
              </div>
            )}

            <form onSubmit={handleVerifyOtpSubmit}>
              <div className="field" style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  style={{
                    fontSize: 24,
                    letterSpacing: 10,
                    textAlign: 'center',
                    fontWeight: 700,
                    padding: '14px',
                    color: 'var(--purple)',
                    fontFamily: 'monospace',
                  }}
                  autoFocus
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, fontSize: 12, color: 'var(--muted)' }}>
                <span>Sisa kesempatan: <b>{remainingAttempts} kali</b></span>
                <span>Masa berlaku: <b>10 menit</b></span>
              </div>

              <button className="submit" type="submit" disabled={loading}>
                {loading ? (
                  <span>Memverifikasi...</span>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                    Verifikasi &amp; Aktifkan Akun
                  </>
                )}
              </button>
            </form>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={!canResend}
                style={{
                  background: 'none',
                  border: 'none',
                  color: canResend ? 'var(--purple)' : 'var(--muted)',
                  fontSize: 12.5,
                  cursor: canResend ? 'pointer' : 'default',
                  padding: 0,
                  fontWeight: 500,
                }}
              >
                {canResend ? 'Kirim Ulang Kode' : `Kirim ulang (${countdown}s)`}
              </button>
              <a onClick={() => setAuthMode('login')} style={{ color: 'var(--muted)', fontSize: 12.5 }}>
                Kembali ke Masuk
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
