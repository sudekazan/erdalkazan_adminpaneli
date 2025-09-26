require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const fs = require('fs');

// Import routes
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const { authenticateToken } = require('./middleware/auth');

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: true,
  credentials: true
}));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve main website files from makine boya web directory
app.use(express.static(path.join(__dirname, 'makine boya web')));

// API Routes
app.use('/api', apiRoutes);

// Admin Routes
app.use('/admin', adminRoutes);

// Serve login page
app.get('/admin/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/login.html'));
});

// Serve admin panel files with authentication check
app.get('/admin', (req, res) => {
  // Check if user is authenticated
  const token = req.cookies.token;
  if (!token) {
    return res.redirect('/admin/login.html');
  }
  // If authenticated, serve the admin panel
  res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

// Serve other admin panel files
app.get('/admin/:path', (req, res, next) => {
  const filePath = path.join(__dirname, 'public', req.path);
  
  // For HTML files (except login), check authentication
  if (req.path.endsWith('.html') && !req.path.endsWith('login.html')) {
    const token = req.cookies.token;
    if (!token) {
      return res.redirect('/admin/login.html');
    }
  }
  
  // Serve the file if it exists, otherwise next()
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) return next();
    res.sendFile(filePath);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!', 
    error: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Not Found'
  });
});

// Connect to MongoDB
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/erdalkazan';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = app;
