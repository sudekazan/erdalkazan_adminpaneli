const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');

const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const { verifySession } = require('./middleware/auth');

const app = express();

// Behind a reverse proxy (nginx, Caddy, Traefik...) set TRUST_PROXY, e.g. "1"
// for one proxy hop, so req.ip is the real client address. Leave it unset
// when the app is reached directly, otherwise X-Forwarded-For can be spoofed.
function parseTrustProxy(value) {
  if (value === undefined || value === '') return false;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));
app.disable('x-powered-by');

// Basic security headers. The panel and the site are only ever used from
// their own origin, so no CORS headers are sent at all.
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  });
  next();
});

// Health check for Docker / uptime monitors: 200 only while MongoDB is connected.
app.get('/healthz', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'veritabanı bağlı değil' });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Admin HTML pages (everything under /admin except the login page) require a
// valid session. The path is decoded and normalized the way the static file
// server resolves it, so "/admin//index.html" or "/admin/%69ndex.html"
// cannot slip past the check.
function isProtectedAdminPage(rawPath) {
  let p;
  try {
    p = path.posix.normalize(decodeURIComponent(rawPath)).toLowerCase();
  } catch {
    return false; // malformed encoding: the static server rejects it anyway
  }
  if (p === '/admin') return true;
  if (!p.startsWith('/admin/')) return false;
  if (p === '/admin/login.html') return false;
  return p.endsWith('/') || p.endsWith('.html');
}

app.use((req, res, next) => {
  if ((req.method === 'GET' || req.method === 'HEAD')
      && isProtectedAdminPage(req.path) && !verifySession(req)) {
    return res.redirect('/admin/login.html');
  }
  next();
});

// Admin panel files (public/) and the public website (makine boya web/)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'makine boya web')));

app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

// Error handler: details stay in the server log
app.use((err, req, res, next) => {
  console.error('Beklenmeyen hata:', err);
  res.status(err.status || 500).json({ message: 'Bir hata oluştu. Lütfen tekrar deneyin.' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Sayfa bulunamadı' });
});

module.exports = app;
