const pool = require('../config/db');
const AppError = require('../utils/AppError');

/**
 * POST /api/orders/checkout
 * Places an order from the user's current cart
 */
const checkout = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cartResult = await client.query(
      `SELECT c.quantity, p.id AS product_id, p.price, p.stock, p.name
       FROM cart c JOIN products p ON c.product_id = p.id
       WHERE c.user_id = $1
       FOR UPDATE OF c, p`,
      [req.user.id]
    );

    if (cartResult.rows.length === 0) {
      throw new AppError('Cart is empty.', 400);
    }

    for (const item of cartResult.rows) {
      if (item.stock < item.quantity) {
        throw new AppError(`Insufficient stock for "${item.name}".`, 400);
      }
    }

    const total = cartResult.rows.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const orderResult = await client.query(
      'INSERT INTO orders (user_id, total_price) VALUES ($1, $2) RETURNING *',
      [req.user.id, total.toFixed(2)]
    );
    const order = orderResult.rows[0];

    const productIds = cartResult.rows.map((item) => item.product_id);
    const quantities = cartResult.rows.map((item) => item.quantity);
    const prices = cartResult.rows.map((item) => item.price);

    await client.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
       SELECT $1, product_id, quantity, unit_price
       FROM unnest($2::int[], $3::int[], $4::numeric[]) AS t(product_id, quantity, unit_price)`,
      [order.id, productIds, quantities, prices]
    );

    const stockUpdate = await client.query(
      `UPDATE products p
       SET stock = p.stock - v.qty
       FROM unnest($1::int[], $2::int[]) AS v(id, qty)
       WHERE p.id = v.id AND p.stock >= v.qty
       RETURNING p.id`,
      [productIds, quantities]
    );

    if (stockUpdate.rowCount !== cartResult.rows.length) {
      throw new AppError('Insufficient stock for one or more items.', 400);
    }

    await client.query('DELETE FROM cart WHERE user_id = $1', [req.user.id]);

    await client.query('COMMIT');
    res.status(201).json({ order, message: 'Order placed successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * GET /api/orders
 * Customer: own orders. Admin: all orders (paginated).
 */
const getOrders = async (req, res) => {
  const limit = req.query.limit || 50;
  const page = req.query.page || 1;
  const offset = (page - 1) * limit;

  if (req.user.role === 'admin') {
    const [countResult, result] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM orders'),
      pool.query(
        `SELECT o.*, u.name AS customer_name, u.email AS customer_email
         FROM orders o JOIN users u ON o.user_id = u.id
         ORDER BY o.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    const total = countResult.rows[0].total;
    return res.json({
      orders: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  }

  const [countResult, result] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS total FROM orders WHERE user_id = $1', [req.user.id]),
    pool.query(
      'SELECT id, user_id, total_price, status, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.user.id, limit, offset]
    ),
  ]);

  const total = countResult.rows[0].total;
  return res.json({
    orders: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  });
};

/**
 * GET /api/orders/:id
 */
const getOrderById = async (req, res) => {
  const orderRes = await pool.query(
    'SELECT id, user_id, total_price, status, created_at FROM orders WHERE id = $1 AND (user_id = $2 OR $3 = \'admin\')',
    [req.params.id, req.user.id, req.user.role]
  );
  if (orderRes.rows.length === 0) throw new AppError('Order not found.', 404);

  const itemsRes = await pool.query(
    `SELECT oi.*, p.name, p.brand, p.image
     FROM order_items oi JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = $1`,
    [req.params.id]
  );

  res.json({ ...orderRes.rows[0], items: itemsRes.rows });
};

/**
 * PUT /api/orders/:id/status  (Admin)
 * Body: { status }
 */
const updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const result = await pool.query(
    'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  );
  if (result.rows.length === 0) throw new AppError('Order not found.', 404);
  res.json(result.rows[0]);
};

/**
 * GET /api/orders/stats  (Admin)
 */
const getStats = async (req, res) => {
  const [orders, products, users, revenue] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM orders'),
    pool.query('SELECT COUNT(*) FROM products'),
    pool.query('SELECT COUNT(*) FROM users WHERE role = \'customer\''),
    pool.query('SELECT COALESCE(SUM(total_price),0) AS total FROM orders WHERE status != \'Cancelled\''),
  ]);
  res.json({
    totalOrders: parseInt(orders.rows[0].count),
    totalProducts: parseInt(products.rows[0].count),
    totalCustomers: parseInt(users.rows[0].count),
    totalRevenue: parseFloat(revenue.rows[0].total),
  });
};

module.exports = { checkout, getOrders, getOrderById, updateOrderStatus, getStats };
