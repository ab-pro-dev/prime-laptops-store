const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * verifyToken — ensures the request carries a valid JWT.
 * Attaches decoded payload to req.user.
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, env.jwt.secret, {
      algorithms: ['HS256'],
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
    });
    req.user = decoded;
    next();
  } catch (_err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

/**
 * refreshUser — re-loads the user's role from the database.
 * Must be used AFTER verifyToken.
 */
const refreshUser = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found.', 404);
    }

    req.user = { ...req.user, role: result.rows[0].role };
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * requireAdmin — must be used AFTER verifyToken (and ideally refreshUser).
 * Confirms admin role against the database.
 */
const requireAdmin = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden. Admin access required.' });
    }

    req.user.role = result.rows[0].role;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { verifyToken, refreshUser, requireAdmin };
