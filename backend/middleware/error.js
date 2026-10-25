const logger = require('../config/logger');

const notFound = (req, res) => {
  res.status(404).json({ message: 'Route not found.' });
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : err.code === '23505' ? 409 : 500;
  const message = err.code === '23505' ? 'Resource already exists.' : err.message;
  const requestId = req.id;

  if (statusCode >= 500) {
    logger.error({ err, requestId, path: req.originalUrl }, 'Unhandled request error');
  } else {
    logger.warn({ err: { message: err.message }, requestId, path: req.originalUrl }, 'Request rejected');
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'CORS origin is not allowed.', requestId });
  }

  return res.status(statusCode).json({
    message: statusCode >= 500 ? 'Internal server error.' : message,
    requestId,
  });
};

module.exports = { notFound, errorHandler };
