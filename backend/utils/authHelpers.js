const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const REFRESH_COOKIE_NAME = 'refreshToken';

const signAccessToken = (user) => jwt.sign(
  { id: user.id, role: user.role },
  env.jwt.secret,
  {
    expiresIn: env.jwt.expiresIn,
    issuer: env.jwt.issuer,
    audience: env.jwt.audience,
  }
);

const hashRefreshToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const getRefreshExpiry = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.refreshToken.days);
  return expiresAt;
};

const getClientIp = (req) => req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;

const readCookie = (req, name) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
};

const setRefreshCookie = (res, token, expiresAt) => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    expires: expiresAt,
    path: '/api/auth',
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    path: '/api/auth',
  });
};

const createRefreshToken = async (userId, client, req = null) => {
  const token = crypto.randomBytes(64).toString('hex');
  const tokenHash = hashRefreshToken(token);
  const expiresAt = getRefreshExpiry();

  await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address, last_used_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [userId, tokenHash, expiresAt, req?.headers['user-agent']?.slice(0, 500) || null, req ? getClientIp(req) : null]
  );

  return { token, expiresAt };
};

module.exports = {
  REFRESH_COOKIE_NAME,
  signAccessToken,
  hashRefreshToken,
  getRefreshExpiry,
  getClientIp,
  readCookie,
  setRefreshCookie,
  clearRefreshCookie,
  createRefreshToken,
};
