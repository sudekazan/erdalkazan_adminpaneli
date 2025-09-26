const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  // In development, bypass token verification
  if (process.env.NODE_ENV !== 'production') {
    console.log('Bypassing authentication in development mode');
    req.user = { role: 'admin' }; // Set default admin user
    return next();
  }
  
  // Get token from cookies
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

const isAdmin = (req, res, next) => {
  // This is a simple check - in a real app, you'd have proper user roles
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access required' });
  }
};

module.exports = {
  authenticateToken,
  isAdmin
};
