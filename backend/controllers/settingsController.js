const bcrypt = require('bcryptjs');
const pkg = require('../package.json');
const pool = require('../config/db');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const {
  REFRESH_COOKIE_NAME,
  hashRefreshToken,
  getClientIp,
  readCookie,
} = require('../utils/authHelpers');
const { checkDatabase } = require('../config/db');

const logAdminActivity = async (req, action, metadata = {}, client = pool) => {
  await client.query(
    `INSERT INTO admin_activity_logs (admin_id, action, metadata, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      req.user.id,
      action,
      JSON.stringify(metadata),
      getClientIp(req),
      req.headers['user-agent']?.slice(0, 500) || null,
    ]
  );
};

const ensurePreferences = async (adminId) => {
  await pool.query(
    `INSERT INTO admin_preferences (admin_id)
     VALUES ($1)
     ON CONFLICT (admin_id) DO NOTHING`,
    [adminId]
  );
};

const getSessionsQuery = async (req) => {
  const rawToken = readCookie(req, REFRESH_COOKIE_NAME);
  const currentHash = rawToken ? hashRefreshToken(rawToken) : null;
  const result = await pool.query(
    `SELECT id, token_hash, expires_at, created_at, last_used_at, user_agent, ip_address
     FROM refresh_tokens
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY last_used_at DESC, created_at DESC`,
    [req.user.id]
  );

  return result.rows.map(({ token_hash, ...session }) => ({
    ...session,
    current: Boolean(currentHash && token_hash === currentHash),
  }));
};

const getOverview = async (req, res) => {
  await ensurePreferences(req.user.id);
  const [profile, store, prefs, activity, sessions] = await Promise.all([
    pool.query('SELECT id, name, email, avatar_url, role, created_at FROM users WHERE id = $1', [req.user.id]),
    pool.query('SELECT store_name, logo_url, support_email, phone, currency, tax_rate, shipping_fee, updated_at FROM store_settings WHERE id = 1'),
    pool.query(
      `SELECT theme_mode, email_notifications, order_notifications, stock_notifications, security_notifications, updated_at
       FROM admin_preferences WHERE admin_id = $1`,
      [req.user.id]
    ),
    pool.query(
      `SELECT id, action, metadata, ip_address, user_agent, created_at
       FROM admin_activity_logs
       WHERE admin_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.user.id]
    ),
    getSessionsQuery(req),
  ]);

  res.json({
    profile: profile.rows[0],
    storeSettings: store.rows[0],
    preferences: prefs.rows[0],
    activity: activity.rows,
    sessions,
  });
};

const updateProfile = async (req, res) => {
  const { name, email, avatar_url } = req.body;

  const result = await pool.query(
    `UPDATE users
     SET name = $1, email = $2, avatar_url = $3
     WHERE id = $4
     RETURNING id, name, email, avatar_url, role, created_at`,
    [name, email, avatar_url || null, req.user.id]
  );

  await logAdminActivity(req, 'profile.updated', { fields: ['name', 'email', 'avatar_url'] });
  res.json(result.rows[0]);
};

const changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const userResult = await client.query('SELECT password FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    if (userResult.rows.length === 0) {
      throw new AppError('User not found.', 404);
    }

    const isMatch = await bcrypt.compare(current_password, userResult.rows[0].password);
    if (!isMatch) {
      await logAdminActivity(req, 'security.password_change_failed', { reason: 'invalid_current_password' }, client);
      await client.query('COMMIT');
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(new_password, await bcrypt.genSalt(env.bcrypt.saltRounds));
    await client.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);
    await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [req.user.id]);
    await logAdminActivity(req, 'security.password_changed', { revoked_sessions: true }, client);
    await client.query('COMMIT');

    res.json({ message: 'Password changed. Please sign in again.' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getStoreSettings = async (req, res) => {
  const result = await pool.query(
    'SELECT store_name, logo_url, support_email, phone, currency, tax_rate, shipping_fee, updated_at FROM store_settings WHERE id = 1'
  );
  res.json(result.rows[0]);
};

const updateStoreSettings = async (req, res) => {
  const { store_name, logo_url, support_email, phone, currency, tax_rate, shipping_fee } = req.body;
  const result = await pool.query(
    `UPDATE store_settings
     SET store_name = $1, logo_url = $2, support_email = $3, phone = $4, currency = $5,
         tax_rate = $6, shipping_fee = $7, updated_at = NOW()
     WHERE id = 1
     RETURNING store_name, logo_url, support_email, phone, currency, tax_rate, shipping_fee, updated_at`,
    [store_name, logo_url || null, support_email, phone || null, currency, tax_rate, shipping_fee]
  );

  await logAdminActivity(req, 'store_settings.updated', { store_name, currency });
  res.json(result.rows[0]);
};

const getPreferences = async (req, res) => {
  await ensurePreferences(req.user.id);
  const result = await pool.query(
    `SELECT theme_mode, email_notifications, order_notifications, stock_notifications, security_notifications, updated_at
     FROM admin_preferences WHERE admin_id = $1`,
    [req.user.id]
  );
  res.json(result.rows[0]);
};

const updatePreferences = async (req, res) => {
  const {
    theme_mode,
    email_notifications,
    order_notifications,
    stock_notifications,
    security_notifications,
  } = req.body;

  const result = await pool.query(
    `INSERT INTO admin_preferences
       (admin_id, theme_mode, email_notifications, order_notifications, stock_notifications, security_notifications, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (admin_id) DO UPDATE SET
       theme_mode = EXCLUDED.theme_mode,
       email_notifications = EXCLUDED.email_notifications,
       order_notifications = EXCLUDED.order_notifications,
       stock_notifications = EXCLUDED.stock_notifications,
       security_notifications = EXCLUDED.security_notifications,
       updated_at = NOW()
     RETURNING theme_mode, email_notifications, order_notifications, stock_notifications, security_notifications, updated_at`,
    [req.user.id, theme_mode, email_notifications, order_notifications, stock_notifications, security_notifications]
  );

  await logAdminActivity(req, 'preferences.updated', { theme_mode });
  res.json(result.rows[0]);
};

const getActivity = async (req, res) => {
  const result = await pool.query(
    `SELECT id, action, metadata, ip_address, user_agent, created_at
     FROM admin_activity_logs
     WHERE admin_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [req.user.id]
  );
  res.json(result.rows);
};

const getSessions = async (req, res) => {
  res.json(await getSessionsQuery(req));
};

const revokeOtherSessions = async (req, res) => {
  const rawToken = readCookie(req, REFRESH_COOKIE_NAME);
  if (!rawToken) throw new AppError('Current session is required.', 401);

  const currentHash = hashRefreshToken(rawToken);
  const result = await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1 AND token_hash != $2 AND revoked_at IS NULL
     RETURNING id`,
    [req.user.id, currentHash]
  );

  await logAdminActivity(req, 'sessions.revoked_other_devices', { count: result.rowCount });
  res.json({ revoked: result.rowCount });
};

const getSystemInfo = async (req, res) => {
  let databaseStatus = 'unavailable';
  try {
    databaseStatus = (await checkDatabase()) ? 'connected' : 'unavailable';
  } catch (_err) {
    databaseStatus = 'unavailable';
  }

  res.json({
    appVersion: pkg.version,
    nodeEnv: env.nodeEnv,
    databaseStatus,
    serverTime: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
};

module.exports = {
  getOverview,
  updateProfile,
  changePassword,
  getStoreSettings,
  updateStoreSettings,
  getPreferences,
  updatePreferences,
  getActivity,
  getSessions,
  revokeOtherSessions,
  getSystemInfo,
};
