const client = require('prom-client');

client.collectDefaultMetrics({ prefix: 'prime_laptops_store_' });

const httpRequestsTotal = new client.Counter({
  name: 'prime_laptops_store_http_requests_total',
  help: 'Total HTTP requests handled.',
  labelNames: ['method', 'path', 'status'],
});

const httpRequestDuration = new client.Histogram({
  name: 'prime_laptops_store_http_request_duration_ms',
  help: 'HTTP request duration in milliseconds.',
  labelNames: ['method', 'path', 'status'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

const activeRequests = new client.Gauge({
  name: 'prime_laptops_store_http_requests_active',
  help: 'Number of HTTP requests currently in flight.',
});

const startedAt = Date.now();

const metricsMiddleware = (req, res, next) => {
  activeRequests.inc();
  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    const labels = {
      method: req.method,
      path: req.route?.path || req.originalUrl,
      status: res.statusCode,
    };

    httpRequestsTotal.inc(labels);
    end(labels);
    activeRequests.dec();
  });

  next();
};

const metricsHandler = async (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);

  const base = await client.register.metrics();
  const uptimeLine = `# TYPE prime_laptops_store_uptime_seconds gauge\nprime_laptops_store_uptime_seconds ${uptimeSeconds}\n`;

  res.type('text/plain');
  res.send(base + uptimeLine);
};

module.exports = { metricsMiddleware, metricsHandler };
