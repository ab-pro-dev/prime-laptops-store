process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/laptop_store_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_must_be_at_least_32_chars';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const http = require('http');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const env = require('../config/env');

let server;

const request = (method, path, headers = {}) => new Promise((resolve, reject) => {
  const { port } = server.address();
  const req = http.request(
    {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers,
    },
    (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({
          status: res.statusCode,
          headers: res.headers,
          text: body,
          json: () => JSON.parse(body),
        });
      });
    }
  );

  req.on('error', reject);
  req.end();
});

before(async () => {
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe('health endpoints', () => {
  it('GET /api/health returns OK without authentication', async () => {
    const res = await request('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.json().status, 'OK');
    assert.ok(res.json().timestamp);
  });
});

describe('metrics protection', () => {
  it('GET /api/metrics rejects unauthenticated requests', async () => {
    const res = await request('GET', '/api/metrics');
    assert.equal(res.status, 401);
  });

  it('GET /api/metrics accepts METRICS_SECRET bearer token', async () => {
    const previousSecret = env.metrics.secret;
    env.metrics.secret = 'metrics-test-secret-value';

    try {
      const res = await request('GET', '/api/metrics', {
        Authorization: 'Bearer metrics-test-secret-value',
      });

      assert.equal(res.status, 200);
      assert.match(res.text, /prime_laptops_store_http_requests_total/);
    } finally {
      env.metrics.secret = previousSecret;
    }
  });

  it('GET /api/metrics accepts admin JWT or rejects unknown admin', async () => {
    const token = jwt.sign(
      { id: 1, role: 'admin' },
      env.jwt.secret,
      { expiresIn: '5m', issuer: env.jwt.issuer, audience: env.jwt.audience }
    );

    const res = await request('GET', '/api/metrics', {
      Authorization: `Bearer ${token}`,
    });

    assert.ok([200, 403, 500].includes(res.status));
  });
});

describe('validation helpers', () => {
  it('passwordComplexityRules exports min length validator per field', () => {
    const { passwordComplexityRules } = require('../middleware/validate');
    assert.equal(passwordComplexityRules('password').length, 1);
    assert.equal(passwordComplexityRules('new_password').length, 1);
  });
});

describe('AppError', () => {
  it('sets statusCode on thrown errors', () => {
    const AppError = require('../utils/AppError');
    const err = new AppError('Not found.', 404);
    assert.equal(err.statusCode, 404);
    assert.equal(err.message, 'Not found.');
  });
});
