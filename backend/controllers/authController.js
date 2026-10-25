const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const {
  REFRESH_COOKIE_NAME,
  signAccessToken,
  hashRefreshToken,
  getClientIp,
  readCookie,
  setRefreshCookie,
  clearRefreshCookie,
  createRefreshToken,
} = require('../utils/authHelpers');
const logger = require('../config/logger');

const validateRefreshOrigin = (req) => {
  if (!env.isProduction) return;
  const origin = req.headers.origin;
  if (!origin) {
    if (!env.cors.allowNoOrigin) {
      throw new AppError('Origin header is required for refresh.', 403);
    }
    return;
  }
  try {
    const url = new URL(origin);
    const allowed = env.cors.origins.some((o) => {
      const allowedUrl = new URL(o);
      return allowedUrl.origin === url.origin;
    });
    if (!allowed) throw new AppError('Origin not allowed.', 403);
  } catch {
    throw new AppError('Invalid origin header.', 403);
  }
};

/**
 * POST /api/auth/register
 */
const register = async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    throw new AppError('Email already registered.', 409);
  }

  const salt = await bcrypt.genSalt(env.bcrypt.saltRounds);
  const hashedPassword = await bcrypt.hash(password, salt);

  const result = await pool.query(
    'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, role',
    [name, email, hashedPassword]
  );

  const user = result.rows[0];
  const token = signAccessToken(user);
  const refreshToken = await createRefreshToken(user.id, pool, req);
  setRefreshCookie(res, refreshToken.token, refreshToken.expiresAt);

  res.status(201).json({ token, user });
};

/**
 * POST /api/auth/login
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query(
    'SELECT id, name, email, avatar_url, role, password, created_at FROM users WHERE email = $1',
    [email]
  );
  if (result.rows.length === 0) {
    throw new AppError('User not found.', 404);
  }

  const user = result.rows[0];
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError('Incorrect password.', 401);
  }

  const token = signAccessToken(user);
  const refreshToken = await createRefreshToken(user.id, pool, req);
  setRefreshCookie(res, refreshToken.token, refreshToken.expiresAt);

  const { password: _pw, ...safeUser } = user;
  res.json({ token, user: safeUser });
};

/**
 * POST /api/auth/refresh
 */
const refresh = async (req, res) => {
  validateRefreshOrigin(req);

  const rawToken = readCookie(req, REFRESH_COOKIE_NAME);
  if (!rawToken) throw new AppError('Refresh token is required.', 401);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tokenHash = hashRefreshToken(rawToken);
    const tokenResult = await client.query(
      `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at, u.name, u.email, u.avatar_url, u.role
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1
       FOR UPDATE`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      clearRefreshCookie(res);
      throw new AppError('Invalid refresh token.', 401);
    }

    const stored = tokenResult.rows[0];
    if (stored.revoked_at || new Date(stored.expires_at) <= new Date()) {
      if (stored.revoked_at) {
        logger.warn({ userId: stored.user_id }, 'Potential refresh token reuse attack detected. Revoking all tokens.');
        await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [stored.user_id]);
      } else {
        await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [stored.id]);
      }
      await client.query('COMMIT');
      clearRefreshCookie(res);
      throw new AppError('Invalid refresh token.', 401);
    }

    await client.query(
      'UPDATE refresh_tokens SET last_used_at = NOW(), user_agent = COALESCE($2, user_agent), ip_address = COALESCE($3, ip_address) WHERE id = $1',
      [stored.id, req.headers['user-agent']?.slice(0, 500) || null, getClientIp(req)]
    );
    await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [stored.id]);
    const rotated = await createRefreshToken(stored.user_id, client, req);

    await client.query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL \'7 days\' OR revoked_at < NOW() - INTERVAL \'7 days\''
    );

    await client.query('COMMIT');

    const user = {
      id: stored.user_id,
      name: stored.name,
      email: stored.email,
      avatar_url: stored.avatar_url,
      role: stored.role,
    };

    setRefreshCookie(res, rotated.token, rotated.expiresAt);
    res.json({ token: signAccessToken(user), user });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  const rawToken = readCookie(req, REFRESH_COOKIE_NAME);

  if (rawToken) {
    await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL', [
      hashRefreshToken(rawToken),
    ]);
  }

  clearRefreshCookie(res);
  res.json({ message: 'Logged out.' });
};

/**
 * GET /api/auth/me  (protected)
 */
const getMe = async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, avatar_url, role, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  if (result.rows.length === 0) throw new AppError('User not found.', 404);
  res.json(result.rows[0]);
};

module.exports = { register, login, refresh, logout, getMe };
