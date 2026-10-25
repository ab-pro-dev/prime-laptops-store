const express = require('express');

const authRoutes    = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes    = require('./routes/cart');
const orderRoutes   = require('./routes/orders');
const settingsRoutes = require('./routes/settings');
const env = require('./config/env');
const logger = require('./config/logger');
const pool = require('./config/db');
const { checkDatabase, connectWithRetry } = require('./config/db');
const requestLogger = require('./middleware/requestLogger');
const asyncHandler = require('./middleware/asyncHandler');
const { notFound, errorHandler } = require('./middleware/error');
const { helmetMiddleware, corsOptions, generalLimiter, authLimiter } = require('./middleware/security');
const { metricsMiddleware, metricsHandler } = require('./middleware/metrics');
const protectMetrics = require('./middleware/metricsAuth');

const ACTIVITY_LOG_RETENTION_DAYS = 90;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const pruneActivityLogs = async () => {
  try {
    const result = await pool.query(
      'DELETE FROM admin_activity_logs WHERE created_at < NOW() - $1::interval',
      [`${ACTIVITY_LOG_RETENTION_DAYS} days`]
    );
    if (result.rowCount > 0) {
      logger.info({ deleted: result.rowCount }, 'Pruned old admin activity logs');
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to prune admin activity logs');
  }
};

const app = express();

// ─── Middleware ───────────────────────────────────────────────
app.disable('x-powered-by');
if (env.server.trustProxy > 0) {
  app.set('trust proxy', env.server.trustProxy);
}

app.use(requestLogger);
app.use(metricsMiddleware);
app.use(helmetMiddleware);
app.use(require('cors')(corsOptions));
app.use(express.json({ limit: env.server.bodyLimit }));
app.use(express.urlencoded({ extended: false, limit: env.server.bodyLimit }));

// ─── Health checks ────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));
app.get('/api/ready', asyncHandler(async (req, res) => {
  await checkDatabase();
  res.json({ status: 'READY', timestamp: new Date().toISOString() });
}));
app.get('/api/metrics', protectMetrics, metricsHandler);

app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/refresh', authLimiter);

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart',     cartRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/settings', settingsRoutes);

// ─── 404 handler ─────────────────────────────────────────────
app.use(notFound);

// ─── Global error handler ─────────────────────────────────────
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────
const start = async () => {
  await connectWithRetry();

  const server = app.listen(env.server.port, () => {
    logger.info({ port: env.server.port }, 'API server started');
  });

  pruneActivityLogs();
  const cleanupTimer = setInterval(pruneActivityLogs, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down API server');

    clearInterval(cleanupTimer);

    // Force terminate after 10s if graceful shutdown hangs
    const forceExitTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out. Forcing termination.');
      process.exit(1);
    }, 10000);
    forceExitTimeout.unref();

    server.close(async (err) => {
      if (err) {
        logger.error({ err }, 'HTTP server shutdown failed');
        process.exitCode = 1;
      }

      try {
        await pool.end();
        logger.info('PostgreSQL pool closed');
      } catch (poolErr) {
        logger.error({ err: poolErr }, 'PostgreSQL pool shutdown failed');
        process.exitCode = 1;
      } finally {
        process.exit();
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception detected! Shutting down gracefully.');
    shutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection detected! Shutting down gracefully.');
    shutdown('UNHANDLED_REJECTION');
  });

  return server;
};

if (require.main === module) {
  start().catch((err) => {
    logger.fatal({ err }, 'API server failed to start');
    process.exit(1);
  });
}

module.exports = { app, start };
