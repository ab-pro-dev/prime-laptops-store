const env = require('../config/env');
const { verifyToken, requireAdmin } = require('./auth');

/**
 * Allows metrics scraping via METRICS_SECRET bearer token or admin JWT.
 */
const protectMetrics = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (env.metrics.secret && authHeader === `Bearer ${env.metrics.secret}`) {
    return next();
  }

  verifyToken(req, res, () => requireAdmin(req, res, next));
};

module.exports = protectMetrics;
