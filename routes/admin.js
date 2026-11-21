const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { verifySession } = require('../middleware/auth');
const { createLoginLimiter } = require('../middleware/loginLimiter');

const router = express.Router();

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginLimiter = createLoginLimiter({ maxFailures: 5, windowMs: LOGIN_WINDOW_MS });

// ADMIN_PASSWORD may be a bcrypt hash ($2a$/$2b$/$2y$...) or plain text.
async function passwordMatches(input, configured) {
  if (/^\$2[aby]\$\d{2}\$/.test(configured)) {
    return bcrypt.compare(input, configured);
  }
  // Compare fixed-length digests so the check takes the same time
  // regardless of how many characters match.
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(configured).digest();
  return crypto.timingSafeEqual(a, b);
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  };
}

router.post('/login', async (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const secret = process.env.JWT_SECRET;
  if (!adminPassword || !secret) {
    console.error('Admin girişi kapalı: ADMIN_PASSWORD ve JWT_SECRET ortam değişkenleri tanımlanmalı.');
    return res.status(503).json({ message: 'Admin girişi sunucuda yapılandırılmamış' });
  }

  const clientKey = req.ip;
  if (loginLimiter.isBlocked(clientKey)) {
    res.set('Retry-After', String(loginLimiter.retryAfterSeconds(clientKey)));
    return res.status(429).json({ message: 'Çok fazla hatalı deneme. Lütfen 15 dakika sonra tekrar deneyin.' });
  }

  const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';
  if (!password || !(await passwordMatches(password, adminPassword))) {
    loginLimiter.recordFailure(clientKey);
    return res.status(401).json({ message: 'Hatalı şifre' });
  }

  loginLimiter.reset(clientKey);
  const token = jwt.sign({ role: 'admin' }, secret, { expiresIn: '24h', algorithm: 'HS256' });
  res.cookie('token', token, { ...cookieOptions(), maxAge: 24 * 60 * 60 * 1000 });
  res.json({ message: 'Giriş başarılı' });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', cookieOptions());
  res.json({ message: 'Çıkış yapıldı' });
});

router.get('/check-auth', (req, res) => {
  const user = verifySession(req);
  if (!user) {
    return res.status(401).json({ authenticated: false });
  }
  res.json({ authenticated: true, user: { role: user.role } });
});

module.exports = router;
