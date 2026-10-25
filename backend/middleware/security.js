const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const helmetMiddleware = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

const corsOptions = {
  origin(origin, callback) {
    // In development, allow any origin
    if (!env.isProduction) {
      return callback(null, origin || true);
    }
    // In production, validate against the allowlist
    if (!origin) {
      if (!env.cors.allowNoOrigin) {
        return callback(new Error('Not allowed by CORS'));
      }
      return callback(null, true);
    }
    if (env.cors.origins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.max,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: env.rateLimit.authWindowMs,
  limit: env.rateLimit.authMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Too many authentication attempts. Please try again later.' },
});

module.exports = { helmetMiddleware, corsOptions, generalLimiter, authLimiter };
