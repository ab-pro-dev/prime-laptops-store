const { Pool } = require('pg');
const env = require('./env');
const logger = require('./logger');

const pool = new Pool({
  connectionString: env.database.url,
  ssl: env.database.ssl,
  max: env.database.maxConnections,
  idleTimeoutMillis: env.database.idleTimeoutMillis,
  connectionTimeoutMillis: env.database.connectionTimeoutMillis,
  statement_timeout: env.database.statementTimeoutMillis,
  query_timeout: env.database.queryTimeoutMillis,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL idle client error');
});

const checkDatabase = async () => {
  const result = await pool.query('SELECT 1 AS ok');
  return result.rows[0]?.ok === 1;
};

const connectWithRetry = async ({ retries = 5, delayMs = 1000 } = {}) => {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await checkDatabase();
      logger.info({ attempt }, 'Database connection verified');
      return;
    } catch (err) {
      lastError = err;
      logger.warn({ err, attempt, retries }, 'Database connection check failed');
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  throw lastError;
};

module.exports = pool;
module.exports.checkDatabase = checkDatabase;
module.exports.connectWithRetry = connectWithRetry;
