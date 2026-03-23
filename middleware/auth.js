const jwt = require('jsonwebtoken');
const SECRET = 'koupis-group-2026-secret-key';

function parseCookies(header = '') {
  return header.split(';').reduce((acc, part) => {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rawValue.join('='));
    return acc;
  }, {});
}

function getTokenFromRequest(req) {
  const bearer = req.headers.authorization?.replace('Bearer ', '');
  if (bearer) return bearer;
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies.koupis_session || null;
}

function auth(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Απαιτείται σύνδεση' });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { return res.status(401).json({ error: 'Μη έγκυρο token' }); }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Μόνο διαχειριστές' });
  next();
}

function generateToken(user) {
  return jwt.sign({ id: user.Id, username: user.Username, role: user.Role, name: user.DisplayName },
    SECRET, { expiresIn: '24h' });
}

module.exports = { auth, adminOnly, generateToken, parseCookies, getTokenFromRequest };
