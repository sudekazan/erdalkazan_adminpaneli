const jwt = require('jsonwebtoken');

// Returns the decoded session for a valid `token` cookie, otherwise null.
// There is deliberately no development bypass: every environment requires
// a real login, so a missing or wrong NODE_ENV can never open the panel.
function verifySession(req) {
  const token = req.cookies && req.cookies.token;
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;
  try {
    return jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

const authenticateToken = (req, res, next) => {
  const user = verifySession(req);
  if (!user) {
    return res.status(401).json({ message: 'Oturum açmanız gerekiyor' });
  }
  req.user = user;
  next();
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Bu işlem için yönetici yetkisi gerekiyor' });
  }
};

module.exports = {
  verifySession,
  authenticateToken,
  isAdmin
};
