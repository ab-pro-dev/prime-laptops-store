const pino = require('pino');
const env = require('./env');

const logger = pino({
  level: env.logging.level,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      '*.password',
      'DATABASE_URL',
      'JWT_SECRET',
      'refreshToken',
    ],
    censor: '[redacted]',
  },
  base: {
    service: 'prime-laptops-store-api',
    env: env.nodeEnv,
  },
});

module.exports = logger;
