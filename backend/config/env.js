const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

const parseInteger = (name, fallback, { min, max } = {}) => {
  const raw = process.env[name];
  const value = raw === undefined || raw === '' ? fallback : Number.parseInt(raw, 10);

  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer.`);
  }
  if (min !== undefined && value < min) {
    throw new Error(`${name} must be at least ${min}.`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`${name} must be at most ${max}.`);
  }

  return value;
};

const parseBoolean = (name, fallback = false) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (['true', '1', 'yes'].includes(raw.toLowerCase())) return true;
  if (['false', '0', 'no'].includes(raw.toLowerCase())) return false;
  throw new Error(`${name} must be true or false.`);
};

const requireValue = (name) => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
};

const parseOrigins = () => {
  const raw = process.env.CLIENT_ORIGINS || process.env.CLIENT_URL;

  if (!raw && isProduction) {
    throw new Error('CLIENT_ORIGINS or CLIENT_URL is required in production.');
  }

  const origins = (raw || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error();
      }
    } catch (_err) {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }
  }

  return origins;
};

const parseSsl = () => {
  const mode = (process.env.DATABASE_SSL_MODE || (isProduction ? 'require' : 'disable')).toLowerCase();

  if (mode === 'disable') return false;
  if (mode === 'require') return { rejectUnauthorized: true };

  throw new Error('DATABASE_SSL_MODE must be one of: disable, require.');
};

const databaseUrl = requireValue('DATABASE_URL');
const jwtSecret = requireValue('JWT_SECRET');

if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters.');
}

if (/replace_with|change_me|changeme|example|local_development/i.test(jwtSecret)) {
  if (isProduction) {
    throw new Error('JWT_SECRET must be a real random secret, not a placeholder in production.');
  } else {
    process.emitWarning('JWT_SECRET is currently a placeholder. Generate a strong secret before deploying to production.');
  }
}

const bcryptSaltRounds = parseInteger('BCRYPT_SALT_ROUNDS', 12, { min: isProduction ? 12 : 10, max: 15 });

const metricsSecret = process.env.METRICS_SECRET?.trim() || null;
if (isProduction && !metricsSecret) {
  process.emitWarning(
    'METRICS_SECRET is not set. /api/metrics requires an admin JWT. Set METRICS_SECRET for scraper access.'
  );
}

const trustProxy = parseInteger('TRUST_PROXY', 0, { min: 0, max: 10 });
if (isProduction && trustProxy === 0) {
  process.emitWarning(
    'TRUST_PROXY is 0 in production. Rate limiting and client IP logging may be inaccurate behind a reverse proxy.'
  );
}

const env = {
  nodeEnv: NODE_ENV,
  isProduction,
  server: {
    port: parseInteger('PORT', 5000, { min: 1, max: 65535 }),
    trustProxy,
    bodyLimit: process.env.REQUEST_BODY_LIMIT || '100kb',
  },
  database: {
    url: databaseUrl,
    ssl: parseSsl(),
    maxConnections: parseInteger('DB_POOL_MAX', 20, { min: 1, max: 100 }),
    idleTimeoutMillis: parseInteger('DB_IDLE_TIMEOUT_MS', 30000, { min: 1000 }),
    connectionTimeoutMillis: parseInteger('DB_CONNECTION_TIMEOUT_MS', 5000, { min: 500 }),
    statementTimeoutMillis: parseInteger('DB_STATEMENT_TIMEOUT_MS', 15000, { min: 1000 }),
    queryTimeoutMillis: parseInteger('DB_QUERY_TIMEOUT_MS', 15000, { min: 1000 }),
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    issuer: process.env.JWT_ISSUER || 'prime-laptops-store',
    audience: process.env.JWT_AUDIENCE || 'prime-laptops-store-client',
  },
  refreshToken: {
    days: parseInteger('REFRESH_TOKEN_DAYS', 30, { min: 1, max: 90 }),
  },
  bcrypt: {
    saltRounds: bcryptSaltRounds,
  },
  cors: {
    origins: parseOrigins(),
    allowNoOrigin: parseBoolean('CORS_ALLOW_NO_ORIGIN', !isProduction),
  },
  metrics: {
    secret: metricsSecret,
  },
  rateLimit: {
    windowMs: parseInteger('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, { min: 1000 }),
    max: parseInteger('RATE_LIMIT_MAX', isProduction ? 300 : 1000, { min: 1 }),
    authWindowMs: parseInteger('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, { min: 1000 }),
    authMax: parseInteger('AUTH_RATE_LIMIT_MAX', 10, { min: 1 }),
  },
  logging: {
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    pretty: parseBoolean('LOG_PRETTY', !isProduction),
  },
};

module.exports = env;
