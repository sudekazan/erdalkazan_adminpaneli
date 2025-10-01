const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');

// routes/admin.js
router.post('/login', async (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // 1. Şifre kontrolü (Üretim ortamı için bcrypt kullanılması şiddetle tavsiye edilir!)
  // README'nizde belirtilen bcrypt kullanımı en güvenlisidir.
  // Ancak mevcut yapıyı bozmamak için basit karşılaştırmayı yapıyorum.
  // EĞER ŞİFRENİZİ HASH'LEDİYSENİZ, 'bcryptjs' kullanmanız GEREKİR.
  // const isMatch = await bcrypt.compare(password, adminPassword);

  if (!password || password !== adminPassword) {
    return res.status(401).json({ message: 'Hatalı şifre' });
  }
  
  try {
    // Create token
    const token = jwt.sign(
      { role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Set token in HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    res.json({ message: 'Giriş başarılı' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Giriş sırasında sunucu hatası' });
  }
});

// Admin logout route
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout successful' });
});

// Check if user is authenticated
router.get('/check-auth', (req, res) => {
  // In development mode, always return authenticated
  if (process.env.NODE_ENV !== 'production') {
    return res.json({ authenticated: true, user: { role: 'admin' } });
  }

  // Use the authenticateToken middleware for production
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ authenticated: true, user: decoded });
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired token' });
  }
});

module.exports = router;
